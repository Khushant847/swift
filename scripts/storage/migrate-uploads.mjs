#!/usr/bin/env node
/**
 * Copy existing local uploads to the configured S3-compatible bucket.
 *
 * Why this exists: production on Vercel has no persistent disk, so the files in
 * apps/backend/uploads are unreachable there. This script uploads them with the
 * exact same object keys the app uses (`uploads/<folder>/<file>`), which means
 * no database rows need to change — the API's /uploads route resolves the same
 * URLs against the bucket instead of the disk.
 *
 * Safe by default:
 *   - dry run unless --apply is passed
 *   - never overwrites an existing object unless --force is passed
 *   - never touches the database or deletes local files
 *
 * Usage:
 *   node scripts/storage/migrate-uploads.mjs                # plan only
 *   node scripts/storage/migrate-uploads.mjs --apply        # upload missing files
 *   node scripts/storage/migrate-uploads.mjs --apply --force
 *   node scripts/storage/migrate-uploads.mjs --env apps/backend/.env.production
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const requireFromRoot = createRequire(path.join(repoRoot, 'package.json'));

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const force = args.includes('--force');
const envFileArg = args.indexOf('--env');
const envFile = path.resolve(
  repoRoot,
  envFileArg >= 0 && args[envFileArg + 1] ? args[envFileArg + 1] : 'apps/backend/.env',
);

if (fs.existsSync(envFile)) {
  const dotenv = requireFromRoot('dotenv');
  dotenv.config({ path: envFile, override: false });
  console.log(`[storage-migrate] env: ${path.relative(repoRoot, envFile)}`);
} else {
  console.log('[storage-migrate] no env file found; using process.env only');
}

const env = process.env;
const required = apply
  ? ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
  : ['S3_BUCKET'];
const missing = required.filter((key) => !env[key]);
if (missing.length > 0) {
  console.error(
    `[storage-migrate] Missing ${missing.join(', ')}. Nothing was uploaded.` +
      (apply ? '' : ' (A dry run only needs S3_BUCKET.)'),
  );
  process.exit(1);
}

const uploadRoot = path.join(repoRoot, 'apps', 'backend', 'uploads');
if (!fs.existsSync(uploadRoot)) {
  console.error(`[storage-migrate] Uploads directory not found: ${uploadRoot}`);
  process.exit(1);
}

const EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
};

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name !== '.gitkeep') out.push(full);
  }
  return out;
}

const files = walk(uploadRoot).map((full) => ({
  full,
  rel: path.relative(uploadRoot, full).split(path.sep).join('/'),
  size: fs.statSync(full).size,
}));

if (files.length === 0) {
  console.log('[storage-migrate] Nothing to upload — apps/backend/uploads is empty.');
  process.exit(0);
}

const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
console.log(
  `[storage-migrate] ${files.length} file(s), ${(totalBytes / 1024 / 1024).toFixed(2)} MiB → bucket "${env.S3_BUCKET}"`,
);

if (!apply) {
  for (const file of files.slice(0, 10)) {
    console.log(`  would upload uploads/${file.rel} (${file.size} bytes)`);
  }
  if (files.length > 10) console.log(`  …and ${files.length - 10} more`);
  console.log('[storage-migrate] Dry run only. Re-run with --apply to upload.');
  process.exit(0);
}

const client = new S3Client({
  region: env.S3_REGION || 'auto',
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: ['1', 'true', 'yes', 'on'].includes(String(env.S3_FORCE_PATH_STYLE || '').toLowerCase()),
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const file of files) {
  const key = `uploads/${file.rel}`;
  const contentType = EXT_TO_MIME[path.extname(file.rel).toLowerCase()] ?? 'application/octet-stream';

  try {
    if (!force) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
        skipped += 1;
        console.log(`  skip (exists) uploads/${file.rel}`);
        continue;
      } catch (err) {
        if (!['NotFound', 'NoSuchKey', '403'].includes(err?.name)) throw err;
      }
    }

    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: fs.readFileSync(file.full),
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    uploaded += 1;
    console.log(`  uploaded uploads/${file.rel}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAILED uploads/${file.rel}: ${err?.message ?? err}`);
  }
}

console.log(`[storage-migrate] uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
if (failed > 0) process.exit(1);
