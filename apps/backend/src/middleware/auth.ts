import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/http';
import { readToken, verifyToken, type JwtPayload } from '../lib/auth';
import { prisma } from '../lib/prisma';

// Stored as a string column in the SQLite dev schema (native enum in Postgres).
export type AdminRole = 'super_admin' | 'content_editor';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: JwtPayload;
    }
  }
}

/**
 * Verifies the JWT and re-checks the admin row so that deactivation, role
 * changes and deletions revoke live sessions immediately (stateless JWTs
 * otherwise stay valid until expiry).
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = readToken(req);
    if (!token) return next(ApiError.unauthorized('Authentication required'));
    const payload = verifyToken(token);
    if (!payload) return next(ApiError.unauthorized('Session expired or invalid'));

    const admin = await prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, role: true },
    });
    if (!admin || !admin.isActive) return next(ApiError.unauthorized('Account unavailable'));
    // Role in the token must match the current DB role — a demoted admin
    // loses the old privileges at once instead of at token expiry.
    if (admin.role !== payload.role) {
      return next(ApiError.unauthorized('Your permissions changed. Please sign in again.'));
    }

    req.admin = payload;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.admin) return next(ApiError.unauthorized());
    if (!roles.includes(req.admin.role)) return next(ApiError.forbidden('Insufficient permissions'));
    next();
  };
}
