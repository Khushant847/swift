import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { corsOrigins, env, isProd } from './config/env';
import { ApiError } from './lib/http';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/error';
import { uploadRoot } from './lib/storage';
import { apiRouter } from './routes';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';

/**
 * Liveness: the HTTP process is accepting requests. No dependency checks —
 * use /health/ready when you need to know whether the API can serve data.
 */
const livenessHandler: RequestHandler = (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    ts: new Date().toISOString(),
  });
};

/**
 * Readiness: the API is only considered ready once the database responds.
 * Returns 503 (not 200) while the DB is unreachable, so process orchestrators
 * and the web app's reconnect watcher keep waiting instead of treating a
 * half-started backend as healthy.
 */
const readinessHandler: RequestHandler = async (_req, res) => {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      db: 'up',
      latencyMs: Date.now() - started,
      uptime: Math.round(process.uptime()),
      ts: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Readiness check failed — database unreachable', err);
    res.status(503).json({
      status: 'degraded',
      db: 'down',
      latencyMs: Date.now() - started,
      ts: new Date().toISOString(),
    });
  }
};

export function createApp() {
  const app = express();

  // Trust X-Forwarded-* only for the configured number of proxy hops
  // (env.TRUST_PROXY; 0 in dev/test so clients cannot spoof their IP).
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  // ── Security headers (strict CSP + HSTS) ─────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:', 'https:'],
          connectSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow web/admin to load uploads
      crossOriginEmbedderPolicy: false,
      hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    }),
  );

  // ── CORS (credentials + strict allow-list) ───────────────
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || corsOrigins.includes('*') || corsOrigins.includes(origin)) return cb(null, true);
        // Reject with a typed error so the error handler returns a clean 403
        // JSON envelope instead of an unhandled 500 with a stack trace.
        return cb(ApiError.forbidden('Origin not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Captcha-Token'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  if (!isProd) app.use(morgan('dev'));

  // ── Static media (locally-stored uploads) ────────────────
  app.use(
    '/uploads',
    express.static(uploadRoot, {
      maxAge: '7d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      },
    }),
  );

  // ── Health checks ────────────────────────────────────────
  // /health          → liveness (process only)
  // /health/ready    → readiness (requires a working database)
  // /api/health      → same readiness probe on the same-origin /api path so
  //                    the Next.js web client can poll it through the proxy
  //                    without a separate rewrite.
  app.get('/health', livenessHandler);
  app.get('/health/ready', readinessHandler);
  app.get('/api/health', readinessHandler);

  app.use('/api', apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const uploadsDir = uploadRoot;
