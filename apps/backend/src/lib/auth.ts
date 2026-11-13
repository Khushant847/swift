import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { env, isProd } from '../config/env';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'super_admin' | 'content_editor';
  username: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: `${env.JWT_EXPIRES_MINUTES}m`,
    issuer: 'swift-instruments',
    audience: 'swift-admin',
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'swift-instruments',
      audience: 'swift-admin',
    }) as JwtPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: env.JWT_EXPIRES_MINUTES * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/',
  });
}

export function readToken(req: Request): string | null {
  const fromCookie = req.cookies?.[env.COOKIE_NAME];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// ─── Short-lived MFA challenge token (issued between password & 2FA step) ───
export interface ChallengePayload extends JwtPayload {
  mfa: true;
  method: 'totp' | 'email';
}

export function signChallenge(payload: JwtPayload, method: 'totp' | 'email'): string {
  return jwt.sign({ ...payload, mfa: true, method }, env.JWT_SECRET, {
    expiresIn: '5m',
    issuer: 'swift-instruments',
    audience: 'swift-admin-mfa',
  });
}

export function verifyChallenge(token: string): ChallengePayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'swift-instruments',
      audience: 'swift-admin-mfa',
    }) as ChallengePayload;
  } catch {
    return null;
  }
}
