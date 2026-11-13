import type { NextFunction, Request, Response } from 'express';
import { corsOrigins, env } from '../config/env';
import { ApiError } from '../lib/http';

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const allowAll = corsOrigins.includes('*');

/**
 * Lightweight CSRF defence: since auth lives in SameSite=Strict HttpOnly cookies,
 * we additionally verify that any state-changing request originates from an
 * allowed origin (double protection against cross-site form posts).
 */
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.includes(req.method)) return next();
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) {
    // No Origin/Referer: non-browser clients (curl, health checks). Browsers
    // always attach Origin to cross-site state-changing requests, and the
    // SameSite=Strict auth cookie already blocks cross-site cookie sending.
    return next();
  }
  try {
    const host = new URL(origin).origin;
    if (allowAll || corsOrigins.includes(host)) return next();
    return next(ApiError.forbidden('Request blocked: untrusted origin'));
  } catch {
    return next(ApiError.forbidden('Request blocked: invalid origin'));
  }
}

/**
 * Verifies a Google reCAPTCHA / Turnstile token when CAPTCHA_SECRET is set.
 * In dev (no secret configured) it is a no-op so the form works out of the box.
 */
export async function verifyCaptcha(req: Request, _res: Response, next: NextFunction) {
  if (!env.CAPTCHA_SECRET) return next();
  const token = (req.body?.captchaToken as string) || (req.headers['x-captcha-token'] as string);
  if (!token) return next(ApiError.badRequest('Captcha verification required'));

  try {
    const params = new URLSearchParams({ secret: env.CAPTCHA_SECRET, response: token });
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await resp.json()) as { success: boolean; score?: number };
    if (!json.success || (json.score !== undefined && json.score < 0.5)) {
      return next(ApiError.badRequest('Captcha verification failed'));
    }
    return next();
  } catch {
    return next(ApiError.badRequest('Captcha verification error'));
  }
}
