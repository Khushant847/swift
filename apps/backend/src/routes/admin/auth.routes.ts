import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '../../lib/prisma';
import { asyncHandler, ok, ApiError } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { changePasswordSchema, loginSchema, mfaSetupSchema, mfaVerifySchema } from '../../schemas';
import { loginLimiter, mfaLimiter } from '../../middleware/rateLimit';
import {
  clearAuthCookie,
  readToken,
  setAuthCookie,
  signChallenge,
  signToken,
  verifyChallenge,
  verifyToken,
  type JwtPayload,
} from '../../lib/auth';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../lib/audit';
import { sendMail, wrapEmailHtml } from '../../lib/mailer';
import { sanitizeText } from '../../lib/http';

export const authRouter = Router();

function payloadFor(admin: { id: string; email: string; username: string; role: string }): JwtPayload {
  return {
    sub: admin.id,
    email: admin.email,
    username: admin.username,
    role: admin.role as JwtPayload['role'],
  };
}

// Precomputed hash used to equalise bcrypt timing when the email is unknown,
// preventing user-enumeration via response-time differences.
const DUMMY_HASH = bcrypt.hashSync('timing-equalisation-pad', 10);

// ─── Login (password step) ───────────────────────────────────
authRouter.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase().trim() } });

    // Constant-ish response regardless of which check fails; always run the
    // bcrypt compare so unknown emails take the same time as wrong passwords.
    const valid = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !valid || !admin.isActive) {
      await audit({
        adminId: admin?.id ?? null,
        adminEmail: email,
        action: 'login',
        entity: 'auth',
        details: { outcome: 'failed' },
        req,
      });
      throw ApiError.unauthorized('Invalid email or password');
    }

    const payload = payloadFor(admin);

    // ── MFA required? ──
    if (admin.mfaEnabled) {
      if (admin.mfaSecret) {
        return ok(res, {
          mfaRequired: true,
          method: 'totp',
          challengeId: signChallenge(payload, 'totp'),
        });
      }
      // Email OTP fallback
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const codeHash = await bcrypt.hash(code, 10);
      // Clean up expired/consumed OTPs so the table doesn't grow unbounded.
      await prisma.emailOtp.deleteMany({
        where: { OR: [{ expiresAt: { lt: new Date() } }, { consumed: true }] },
      });
      await prisma.emailOtp.create({
        data: {
          adminId: admin.id,
          codeHash,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      await sendMail({
        to: admin.email,
        subject: 'Your Swift Instruments login code',
        html: wrapEmailHtml('Login verification code', `<p style="font-size:28px;letter-spacing:6px"><strong>${code}</strong></p><p>This code expires in 5 minutes.</p>`),
      });
      return ok(res, {
        mfaRequired: true,
        method: 'email',
        challengeId: signChallenge(payload, 'email'),
      });
    }

    await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    setAuthCookie(res, signToken(payload));
    await audit({ adminId: admin.id, adminEmail: admin.email, action: 'login', entity: 'auth', req });
    return ok(res, { admin: { id: admin.id, email: admin.email, username: admin.username, role: admin.role } });
  }),
);

// ─── MFA verification (TOTP or email code) ───────────────────
authRouter.post(
  '/mfa/verify',
  mfaLimiter,
  validate(mfaVerifySchema),
  asyncHandler(async (req, res) => {
    const { challengeId, code } = req.body as { challengeId: string; code: string };
    const challenge = verifyChallenge(challengeId);
    if (!challenge) throw ApiError.unauthorized('MFA challenge expired. Please log in again.');

    const admin = await prisma.admin.findUnique({ where: { id: challenge.sub } });
    if (!admin || !admin.isActive) throw ApiError.unauthorized('Account unavailable');

    let verified = false;
    if (challenge.method === 'totp' && admin.mfaSecret) {
      verified = authenticator.verify({ token: code.replace(/\s/g, ''), secret: admin.mfaSecret });
    } else {
      const otp = await prisma.emailOtp.findFirst({
        where: { adminId: admin.id, consumed: false, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      if (otp && (await bcrypt.compare(code, otp.codeHash))) {
        verified = true;
        await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumed: true } });
      }
    }

    if (!verified) throw ApiError.unauthorized('Invalid verification code');

    const payload = payloadFor(admin);
    await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    setAuthCookie(res, signToken(payload));
    await audit({ adminId: admin.id, adminEmail: admin.email, action: 'login', entity: 'auth', details: { mfa: true }, req });
    return ok(res, { admin: { id: admin.id, email: admin.email, username: admin.username, role: admin.role } });
  }),
);

// ─── Current session ─────────────────────────────────────────
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin!.sub },
      select: { id: true, email: true, username: true, role: true, mfaEnabled: true, lastLoginAt: true },
    });
    if (!admin) throw ApiError.unauthorized();
    return ok(res, admin);
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    clearAuthCookie(res);
    // Best-effort identity: decode the token directly (no requireAuth) so an
    // expired session can still log out cleanly while a valid one is
    // attributed to the right admin in the audit trail.
    const token = readToken(req);
    const payload = token ? verifyToken(token) : null;
    await audit({
      adminId: payload?.sub ?? null,
      adminEmail: payload?.email ?? 'system',
      action: 'logout',
      entity: 'auth',
      req,
    });
    return ok(res, { message: 'Logged out' });
  }),
);

// ─── MFA self-service setup ──────────────────────────────────
authRouter.post(
  '/mfa/setup',
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = await prisma.admin.findUnique({ where: { id: req.admin!.sub } });
    if (!admin) throw ApiError.unauthorized();
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(admin.email, 'Swift Instruments Admin', secret);
    const qr = await QRCode.toDataURL(otpauth);
    // Stage the secret on the admin but keep MFA disabled until verified.
    await prisma.admin.update({ where: { id: admin.id }, data: { mfaSecret: secret, mfaEnabled: false } });
    return ok(res, { secret, otpauth, qr });
  }),
);

authRouter.post(
  '/mfa/setup/confirm',
  requireAuth,
  validate(mfaSetupSchema),
  asyncHandler(async (req, res) => {
    const { enable, code } = req.body as { enable: boolean; code?: string };
    const admin = await prisma.admin.findUnique({ where: { id: req.admin!.sub } });
    if (!admin) throw ApiError.unauthorized();

    if (!enable) {
      // Disabling an already-active MFA requires a live second factor — a
      // hijacked session must not be able to silently strip 2FA.
      if (admin.mfaEnabled && admin.mfaSecret) {
        if (!code || !authenticator.verify({ token: code.replace(/\s/g, ''), secret: admin.mfaSecret })) {
          throw ApiError.badRequest('Valid authenticator code required to disable MFA');
        }
      }
      await prisma.admin.update({ where: { id: admin.id }, data: { mfaEnabled: false, mfaSecret: null } });
      await audit({ adminId: admin.id, adminEmail: admin.email, action: 'config', entity: 'mfa', details: { enabled: false }, req });
      return ok(res, { mfaEnabled: false });
    }

    if (!admin.mfaSecret) throw ApiError.badRequest('Run MFA setup first');
    if (!code || !authenticator.verify({ token: code.replace(/\s/g, ''), secret: admin.mfaSecret })) {
      throw ApiError.badRequest('Invalid authenticator code');
    }
    await prisma.admin.update({ where: { id: admin.id }, data: { mfaEnabled: true } });
    await audit({ adminId: admin.id, adminEmail: admin.email, action: 'config', entity: 'mfa', details: { enabled: true }, req });
    return ok(res, { mfaEnabled: true });
  }),
);

// ─── Change password ─────────────────────────────────────────
authRouter.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    const admin = await prisma.admin.findUnique({ where: { id: req.admin!.sub } });
    if (!admin) throw ApiError.unauthorized();
    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) throw ApiError.badRequest('Current password is incorrect');
    if (await bcrypt.compare(newPassword, admin.passwordHash)) {
      throw ApiError.badRequest('New password must differ from the current one');
    }
    await prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    });
    await audit({ adminId: admin.id, adminEmail: admin.email, action: 'config', entity: 'password', req });
    // Invalidate the current session so a hijacked cookie dies with the
    // password it was issued under.
    clearAuthCookie(res);
    return ok(res, { message: 'Password updated. Please sign in again.' });
  }),
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _s = sanitizeText;
