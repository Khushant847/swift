import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { corsOrigins, env, isProd } from './config/env';
import { ApiError } from './lib/http';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/error';
import { storage, uploadRoot, type OpenRange } from './lib/storage';
import { apiRouter } from './routes';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';

/**
 * Serves uploaded media on /uploads/*.
 *
 * `express.static()` cannot be used: Vercel ignores it and does not serve files
 * from the function bundle (the filesystem is read-only and ephemeral anyway).
 * This handler streams from whichever StorageDriver is configured — local disk
 * in development, an S3-compatible bucket in production — so the URL contract
 * (`/uploads/<folder>/<uuid>.<ext>`) stays identical in every environment.
 */
const uploadsHandler: RequestHandler = async (req, res, next) => {
  try {
    // Express 4 exposes `*` captures as params[0].
    const wildcard = (req.params as Record<string, string | undefined>)[0] ?? '';

    let range: OpenRange | undefined;
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim());
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : undefined;
        if (Number.isFinite(start) && (end === undefined || Number.isFinite(end))) {
          range = { start, end };
        }
      }
      // Suffix ("bytes=-500") and multi-part ranges fall back to a full body;
      // browsers only need single open-ended ranges for video seeking.
    }

    const file = await storage.open(wildcard, range);
    if (!file) return next(ApiError.notFound('File not found'));

    res.setHeader('Content-Type', file.contentType);
    // Object names are random UUIDs, so the bytes at a URL never change.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // User-supplied SVGs must never run script on this origin.
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Accept-Ranges', 'bytes');
    if (file.size !== undefined) res.setHeader('Content-Length', String(file.size));
    if (file.etag) res.setHeader('ETag', file.etag);
    if (file.lastModified) res.setHeader('Last-Modified', file.lastModified.toUTCString());
    if (file.contentRange) {
      res.status(206);
      res.setHeader('Content-Range', file.contentRange);
    }

    file.stream.on('error', next);
    file.stream.pipe(res);
  } catch (err) {
    next(err);
  }
};

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

  // ── Uploaded media (local disk or S3-compatible bucket) ──
  // Must stay ahead of the SPA/API routes; `express.static()` is not used
  // because Vercel ignores it (see uploadsHandler above).
  app.get('/uploads/*', uploadsHandler);

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

/**
 * Vercel's Express framework looks for `app`, `index`, or `server` (with a
 * `.ts`/`.js` extension) and requires a default export or a port listener.
 * `src/app.ts` is the first match, so export a ready-to-serve instance here.
 * Local development reuses this same instance from `server.ts`.
 */
export default createApp();

export const uploadsDir = uploadRoot;
