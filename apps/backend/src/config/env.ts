import 'dotenv/config';
import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  PUBLIC_BASE_URL: z.string().default('http://localhost:4000'),
  DATABASE_URL: z.string().default('file:./dev.db'),

  JWT_SECRET: z.string().min(8).default('dev-insecure-secret-change-me'),
  JWT_EXPIRES_MINUTES: z.coerce.number().default(20),
  COOKIE_NAME: z.string().default('swift_at'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),

  STORAGE_DRIVER: z.enum(['local', 's3', 'cloudinary']).default('local'),
  UPLOAD_MAX_MB: z.coerce.number().default(25),
  // S3-compatible object storage (AWS S3, Cloudflare R2, DO Spaces, MinIO).
  // Required on Vercel: the function filesystem is read-only/ephemeral.
  S3_BUCKET: z.string().optional().default(''),
  S3_REGION: z.string().optional().default(''),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  // Public bucket/CDN origin (e.g. https://cdn.example.com). Empty = serve
  // media through this API's /uploads route (relative URLs, cacheable).
  S3_PUBLIC_URL: z.string().optional().default(''),
  S3_FORCE_PATH_STYLE: bool(false),

  MAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  MAIL_FROM: z.string().default('Swift Instruments <no-reply@swiftinstruments.in>'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),

  REDIS_URL: z.string().optional().default(''),

  // Number of reverse-proxy hops to trust for X-Forwarded-* headers.
  // Default: 1 in production (typically behind a proxy), 0 in dev/test where
  // clients connect directly (prevents X-Forwarded-For spoofing of
  // rate-limit keys and audit/enquiry IP records).
  TRUST_PROXY: z.coerce
    .number()
    .min(0)
    .default(process.env.NODE_ENV === 'production' ? 1 : 0),

  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),
  GOOGLE_PLACES_API_KEY: z.string().optional().default(''),
  GOOGLE_PLACE_ID: z.string().optional().default(''),
  CAPTCHA_SECRET: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Refuse to boot production with the well-known dev secret — a leaked default
// would allow anyone to mint valid super_admin tokens.
if (
  parsed.data.NODE_ENV === 'production' &&
  (parsed.data.JWT_SECRET === 'dev-insecure-secret-change-me' || parsed.data.JWT_SECRET.length < 32)
) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ JWT_SECRET must be set to a strong value (>= 32 chars) when NODE_ENV=production.',
  );
  process.exit(1);
}

export const env = parsed.data;
export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
export const isProd = env.NODE_ENV === 'production';
