import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ApiError } from '../lib/http';
import { logger } from '../lib/logger';
import { isProd } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Already-formatted API errors
  if (err instanceof ApiError) {
    return res.status(err.status).json({ success: false, error: err.message, details: err.details });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ success: false, error: 'Validation failed', details: err.flatten().fieldErrors });
  }

  // Bad query params reaching Prisma (e.g. negative page sizes, invalid enum
  // values on the Postgres schema) are client errors, not server crashes.
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.warn('Prisma validation error (likely bad query params):', err.message);
    return res.status(400).json({ success: false, error: 'Invalid request parameters' });
  }

  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    return res.status(400).json({ success: false, error: msg });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'A record with these unique values already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    return res.status(400).json({ success: false, error: 'Database request error' });
  }

  logger.error('Unhandled error', err);
  return res.status(500).json({
    success: false,
    error: isProd ? 'Internal server error' : (err as Error)?.message ?? 'Internal server error',
  });
}
