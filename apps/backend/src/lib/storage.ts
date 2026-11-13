import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Storage abstraction for uploaded media.
 *
 * `local` writes to apps/backend/uploads and is meant for development or a host
 * with a persistent disk. `s3` writes to any S3-compatible bucket (AWS S3,
 * Cloudflare R2, DigitalOcean Spaces, MinIO) and is required on Vercel, whose
 * filesystem is read-only/ephemeral and where `express.static()` is ignored.
 *
 * Both drivers return URLs that point at this API's `/uploads/...` route, which
 * streams the file (from disk or the bucket) with immutable cache headers. Set
 * `S3_PUBLIC_URL` to a bucket/CDN origin to skip that proxy and link directly.
 */
export interface StoredFile {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface OpenRange {
  start: number;
  end?: number;
}

export interface OpenedFile {
  stream: Readable;
  contentType: string;
  /** Bytes in this response (equal to totalSize for a full response). */
  size?: number;
  /** Full object size, present for partial responses too. */
  totalSize?: number;
  /** e.g. `bytes 0-1023/4096` — set only for partial responses. */
  contentRange?: string;
  etag?: string;
  lastModified?: Date;
}

export interface StorageDriver {
  put(buffer: Buffer, originalName: string, mimeType: string, folder: string): Promise<StoredFile>;
  remove(urlOrFilename: string): Promise<void>;
  open(filename: string, range?: OpenRange): Promise<OpenedFile | null>;
}

// ─── Upload allow-list (strict MIME + extension validation) ──
export const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml'];
export const VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'];
export const DOC_MIME = ['application/pdf'];
export const ALLOWED_MIME = [...IMAGE_MIME, ...VIDEO_MIME, ...DOC_MIME];

export const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'];
export const VIDEO_EXT = ['.mp4', '.webm', '.mov'];
export const DOC_EXT = ['.pdf'];

const MIME_TO_EXT: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
  'application/pdf': ['.pdf'],
};

const EXT_TO_MIME: Record<string, string> = {
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

export function contentTypeFor(filename: string): string {
  return EXT_TO_MIME[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

/** Ensures the declared MIME type and the file extension agree (defence in depth). */
export function validateUpload(originalName: string, mimeType: string): { ok: boolean; error?: string } {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_MIME.includes(mimeType)) return { ok: false, error: `Unsupported MIME type: ${mimeType}` };
  const allowedExts = MIME_TO_EXT[mimeType] ?? [];
  if (!allowedExts.includes(ext)) {
    return { ok: false, error: `Extension ${ext} does not match MIME type ${mimeType}` };
  }
  return { ok: true };
}

export function isVideoMime(mime: string): boolean {
  return VIDEO_MIME.includes(mime);
}

const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const URL_PREFIX = '/uploads/';
/** Bucket objects mirror the on-disk layout so `/uploads/x.jpg` → `uploads/x.jpg`. */
const KEY_PREFIX = 'uploads/';

function safeFolder(folder: string): string {
  return folder.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'general';
}

/**
 * Normalise a client-supplied path under /uploads and reject traversal.
 * Returns null when the path is not a plain relative file path.
 */
export function safeRelativePath(input: string): string | null {
  const decoded = (() => {
    try {
      return decodeURIComponent(input);
    } catch {
      return input;
    }
  })();
  if (!decoded || decoded.includes('\0')) return null;
  const normalised = decoded.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalised || normalised.startsWith('..') || normalised.includes('/../')) return null;
  const parts = normalised.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  return normalised;
}

class LocalStorage implements StorageDriver {
  async put(buffer: Buffer, originalName: string, mimeType: string, folder: string): Promise<StoredFile> {
    const dir = path.join(UPLOAD_ROOT, safeFolder(folder));
    fs.mkdirSync(dir, { recursive: true });
    const ext = path.extname(originalName).toLowerCase();
    const filename = `${crypto.randomUUID()}${ext}`;
    fs.writeFileSync(path.join(dir, filename), buffer);
    const rel = `${safeFolder(folder)}/${filename}`;
    // Store a host-relative URL. Baking PUBLIC_BASE_URL (which defaults to
    // http://localhost:4000) into the DB would produce links that only work on
    // the developer's machine and break for every visitor in production.
    // Relative URLs resolve against whichever host serves the site; /uploads is
    // served by this API (proxy) and by the web/admin origin in front of it.
    return {
      url: `${URL_PREFIX}${rel}`,
      filename: rel,
      size: buffer.length,
      mimeType,
    };
  }

  async remove(urlOrFilename: string): Promise<void> {
    const filename = urlOrFilename.includes(URL_PREFIX)
      ? urlOrFilename.split(URL_PREFIX)[1]
      : urlOrFilename;
    const rel = safeRelativePath(filename);
    if (!rel) return;
    const resolved = path.resolve(path.join(UPLOAD_ROOT, rel));
    // Prevent path traversal — require the separator so sibling directories
    // whose names merely start with "uploads" are not matched.
    if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) return;
    try {
      fs.unlinkSync(resolved);
    } catch (err) {
      logger.debug('remove(): file not found or already deleted', { filename: rel, err });
    }
  }

  async open(filename: string, range?: OpenRange): Promise<OpenedFile | null> {
    const rel = safeRelativePath(filename);
    if (!rel) return null;
    const resolved = path.resolve(path.join(UPLOAD_ROOT, rel));
    if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) return null;

    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolved);
    } catch {
      return null;
    }
    if (!stat.isFile()) return null;

    const contentType = contentTypeFor(rel);
    if (range) {
      if (range.start >= stat.size) return null;
      const start = Math.max(0, Math.floor(range.start));
      const end = Math.min(range.end === undefined ? stat.size - 1 : Math.floor(range.end), stat.size - 1);
      if (start > end) return null;
      return {
        stream: fs.createReadStream(resolved, { start, end }),
        contentType,
        size: end - start + 1,
        totalSize: stat.size,
        contentRange: `bytes ${start}-${end}/${stat.size}`,
        lastModified: stat.mtime,
      };
    }

    return {
      stream: fs.createReadStream(resolved),
      contentType,
      size: stat.size,
      totalSize: stat.size,
      lastModified: stat.mtime,
    };
  }
}

class S3Storage implements StorageDriver {
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly publicBase: string;

  constructor() {
    const missing = (['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const).filter(
      (key) => !env[key],
    );
    if (missing.length > 0) {
      // Fail at boot rather than on the first upload: a silent 500 during an
      // admin upload is much harder to diagnose than a refused start.
      throw new Error(
        `STORAGE_DRIVER=s3 requires ${missing.join(', ')}. ` +
          'Set them in the environment (or use STORAGE_DRIVER=local on a host with a persistent disk).',
      );
    }
    this.bucket = env.S3_BUCKET;
    this.publicBase = env.S3_PUBLIC_URL.replace(/\/+$/, '');
    this.client = new S3Client({
      // R2 ignores the region but the SDK requires one; "auto" is its convention.
      region: env.S3_REGION || 'auto',
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });

    if (!this.publicBase && !env.S3_ENDPOINT && !env.S3_REGION) {
      throw new Error(
        'STORAGE_DRIVER=s3 needs S3_REGION (AWS) or S3_ENDPOINT (R2/Spaces/MinIO), and preferably S3_PUBLIC_URL.',
      );
    }
  }

  /** Absolute CDN URL when configured, otherwise the same /uploads path the local driver uses. */
  private urlFor(key: string): string {
    if (this.publicBase) return `${this.publicBase}/${key}`;
    return `${URL_PREFIX}${key.slice(KEY_PREFIX.length)}`;
  }

  private keyFor(urlOrFilename: string): string {
    const value = urlOrFilename.trim();
    const marker = value.indexOf(URL_PREFIX);
    if (marker >= 0) return `${KEY_PREFIX}${value.slice(marker + URL_PREFIX.length)}`;
    if (value.startsWith(KEY_PREFIX)) return value;
    return `${KEY_PREFIX}${value.replace(/^\/+/, '')}`;
  }

  async put(buffer: Buffer, originalName: string, mimeType: string, folder: string): Promise<StoredFile> {
    const ext = path.extname(originalName).toLowerCase();
    const rel = `${safeFolder(folder)}/${crypto.randomUUID()}${ext}`;
    const key = `${KEY_PREFIX}${rel}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // Object names are random UUIDs, so the bytes behind a URL never change.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return { url: this.urlFor(key), filename: rel, size: buffer.length, mimeType };
  }

  async remove(urlOrFilename: string): Promise<void> {
    const key = this.keyFor(urlOrFilename);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      logger.warn('S3 delete failed (object may already be gone)', { key, err });
    }
  }

  async open(filename: string, range?: OpenRange): Promise<OpenedFile | null> {
    const rel = safeRelativePath(filename);
    if (!rel) return null;
    const key = `${KEY_PREFIX}${rel}`;

    try {
      const out = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: range ? `bytes=${range.start}-${range.end ?? ''}` : undefined,
        }),
      );
      if (!out.Body) return null;
      return {
        stream: out.Body as unknown as Readable,
        contentType: out.ContentType || contentTypeFor(rel),
        size: out.ContentLength,
        totalSize: out.ContentRange ? Number(out.ContentRange.split('/')[1]) || undefined : out.ContentLength,
        contentRange: out.ContentRange,
        etag: out.ETag,
        lastModified: out.LastModified,
      };
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'NoSuchKey' || name === 'NotFound' || name === 'NoSuchBucket' || name === 'InvalidRange') {
        return null;
      }
      throw err;
    }
  }
}

class UnconfiguredStorage implements StorageDriver {
  async put(): Promise<StoredFile> {
    throw new Error(
      'STORAGE_DRIVER=cloudinary is not implemented yet. Use STORAGE_DRIVER=local, or s3 with an S3-compatible bucket.',
    );
  }
  async remove(): Promise<void> {
    /* no-op */
  }
  async open(): Promise<OpenedFile | null> {
    return null;
  }
}

export const storage: StorageDriver =
  env.STORAGE_DRIVER === 's3'
    ? new S3Storage()
    : env.STORAGE_DRIVER === 'local'
      ? new LocalStorage()
      : new UnconfiguredStorage();

export const uploadRoot = UPLOAD_ROOT;
