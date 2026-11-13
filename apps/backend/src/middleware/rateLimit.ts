import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Sliding-window style limiters. Uses the in-memory store by default; set
 * REDIS_URL in a multi-instance deployment and plug a RedisStore here.
 */
function makeLimiter(opts: { windowMs: number; max: number; message: string; keyPrefix?: string }) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    // Key by IP only. Including the body email would give every distinct
    // email its own bucket, enabling password spraying (8 guesses per account
    // from one IP) and unlimited enquiry spam by varying the address.
    keyGenerator: (req: Request) => `${opts.keyPrefix ?? 'rl'}:${req.ip}`,
    handler: (_req, res) => {
      res.status(429).json({ success: false, error: opts.message });
    },
  });
}

export const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: 'Too many login attempts. Please try again in 15 minutes.',
  keyPrefix: 'login',
});

export const mfaLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many verification attempts. Please try again later.',
  keyPrefix: 'mfa',
});

export const enquiryLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 6,
  message: 'Too many enquiries submitted. Please try again later.',
  keyPrefix: 'enq',
});

export const apiLimiter = makeLimiter({
  // NOTE: this global limiter also fronts server-side (SSR/ISR) fetches, which
  // all share the Next.js server's IP. Keep it generous — abuse-sensitive
  // endpoints (login, MFA, enquiries) have their own tight limiters below.
  windowMs: 60 * 1000,
  max: 1200,
  message: 'Too many requests.',
  keyPrefix: 'api',
});

// Uploads are the cheapest way to exhaust disk (25 MB × 20 files per request).
// Tighter than the global limiter; authenticated admins rarely need more.
export const uploadLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many uploads. Please wait a moment and try again.',
  keyPrefix: 'upl',
});
