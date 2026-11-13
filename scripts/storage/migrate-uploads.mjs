#!/usr/bin/env node
/**
 * Copy existing local uploads to the configured remote store (S3-compatible
 * bucket or Vercel Blob).
 *
 * Why this exists: production on Vercel has no persistent disk, so the files in
 * apps/backend/uploads are unreachable there. This script uploads them with the
 * exact same object keys the app uses (`uploads/<folder>/<file>`), which means
 * no database rows need to change — the API's /uploads route resolves the same
 * URLs against the store instead of the disk.
 *
 * Safe by default:
 *   - dry run unless --apply is passed
 *   - never overwrites an existing object unless --force is passed
 *   - never touches the database or deletes local files
 *
 * Usage:
 *   node scripts/storage/migrate-uploads.mjs                       # plan only
 *   node scripts/storage/migrate-uploads.mjs --driver blob         # plan, Blob target
 *   node scripts/storage/migrate-uploads.mjs --apply --driver blob # upload to Blob
 *   node scripts/storage/migrate-uploads.mjs --apply               # upload to S3
 *   node scripts/storage/migrate-uploads.mjs --apply --force
 *   node scripts/storage/migrate-uploads.mjs --env apps/backend/.env.production
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const requireFromRoot = createRequire(path.join(repoRoot, 'package.json'));

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const force = args.includes('--force');
const envFileArg = args.indexOf('--env');
const driverArg = args.indexOf('--driver');

// Default env file: the one `vercel env pull` writes, then the backend's local one.
const defaultEnvFiles = ['.env.local', path.join('apps', 'backend', '.env')];
const envFile = path.resolve(
  repoRoot,
  envFileArg >= 0 && args[envFileArg + 1]
    ? args[envFileArg + 1]
    : (defaultEnvFiles.find((candidate) => fs.existsSync(path.resolve(repoRoot, candidate))) ??
        defaultEnvFiles[1]),
);

if (fs.existsSync(envFile)) {
  const dotenv = requireFromRoot('dotenv');
  dotenv.config({ path: envFile, override: false });
  console.log(`[storage-migrate] env: ${path.relative(repoRoot, envFile)}`);
} else {
  console.log('[storage-migrate] no env file found; using process.env only');
}

const env = process.env;
const driver = (driverArg >= 0 && args[driverArg + 1]) || env.STORAGE_DRIVER || 's3';
if (!['s3', 'blob'].includes(driver)) {
  console.error(`[storage-migrate] Unsupported --driver "${driver}". Use "s3" or "blob".`);
  process.exit(1);
}

const required =
  driver === 'blob'
    ? apply
      ? []
      : []
    : apply
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

if (driver === 'blob' && !env.BLOB_READ_WRITE_TOKEN && !env.BLOB_STORE_ID) {
  console.error(
    '[storage-migrate] Blob needs BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID. ' +
      'Pull the project env first: `vercel env pull .env.local --yes`.',
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
const targetLabel = driver === 'blob' ? 'Vercel Blob' : `bucket "${env.S3_BUCKET}"`;
console.log(
  `[storage-migrate] ${files.length} file(s), ${(totalBytes / 1024 / 1024).toFixed(2)} MiB → ${targetLabel}`,
);

if (!apply) {
  for (const file of files.slice(0, 10)) {
    console.log(`  would upload uploads/${file.rel} (${file.size} bytes)`);
  }
  if (files.length > 10) console.log(`  …and ${files.length - 10} more`);
  console.log('[storage-migrate] Dry run only. Re-run with --apply to upload.');
  process.exit(0);
}

let uploadOne;
let existsOne;

if (driver === 'blob') {
  // Import after dotenv ran: the SDK resolves credentials from process.env.
  const { put, head } = await import('@vercel/blob');
  uploadOne = async (key, buffer, contentType) => {
    await put(key, buffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: force,
      contentType,
      cacheControlMaxAge: 31_536_000,
    });
  };
  existsOne = async (key) => {
    try {
      await head(key);
      return true;
    } catch (err) {
      // The SDK can throw a plain Error for a missing blob in some versions.
      const e = err;
      if (e?.name === 'BlobNotFoundError' || /does not exist|not found/i.test(e?.message ?? '')) {
        return false;
      }
      throw err;
    }
  };
} else {
  const { HeadObjectCommand, PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    region: env.S3_REGION || 'auto',
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: ['1', 'true', 'yes', 'on'].includes(
      String(env.S3_FORCE_PATH_STYLE || '').toLowerCase(),
    ),
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  uploadOne = async (key, buffer, contentType) => {
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  };
  existsOne = async (key) => {
    try {
      await client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return true;
    } catch (err) {
      if (['NotFound', 'NoSuchKey', '403'].includes(err?.name)) return false;
      throw err;
    }
  };
}

let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const file of files) {
  const key = `uploads/${file.rel}`;
  const contentType = EXT_TO_MIME[path.extname(file.rel).toLowerCase()] ?? 'application/octet-stream';

  try {
    if (!force && (await existsOne(key))) {
      skipped += 1;
      console.log(`  skip (exists) ${key}`);
      continue;
    }

    await uploadOne(key, fs.readFileSync(file.full), contentType);
    uploaded += 1;
    console.log(`  uploaded ${key}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAILED ${key}: ${err?.message ?? err}`);
  }
}

console.log(`[storage-migrate] uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
if (failed > 0) process.exit(1);
