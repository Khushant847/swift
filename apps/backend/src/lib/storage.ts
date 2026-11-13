import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Storage abstraction. `local` writes to apps/backend/uploads and returns
 * host-relative URLs (`/uploads/...`) that the admin (Vite proxy) and web
 * (Next rewrite) apps serve from their own origin. The S3/Cloudinary drivers
 * are drop-in replacements — implement `put`/`remove` against the same
 * interface.
 */
export interface StoredFile {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface StorageDriver {
  put(buffer: Buffer, originalName: string, mimeType: string, folder: string): Promise<StoredFile>;
  remove(urlOrFilename: string): Promise<void>;
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

function safeFolder(folder: string): string {
  return folder.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'general';
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
    // Relative URLs resolve against whichever host serves the site; the admin
    // app proxies /uploads to the backend in dev, and the web app proxies
    // /uploads via a Next.js rewrite in every environment.
    return {
      url: `/uploads/${rel}`,
      filename: rel,
      size: buffer.length,
      mimeType,
    };
  }

  async remove(urlOrFilename: string): Promise<void> {
    const filename = urlOrFilename.includes('/uploads/')
      ? urlOrFilename.split('/uploads/')[1]
      : urlOrFilename;
    const target = path.join(UPLOAD_ROOT, filename);
    const resolved = path.resolve(target);
    // Prevent path traversal — require the separator so sibling directories
    // whose names merely start with "uploads" are not matched.
    if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) return;
    try {
      fs.unlinkSync(resolved);
    } catch (err) {
      logger.debug('remove(): file not found or already deleted', { filename, err });
    }
  }
}

class UnconfiguredStorage implements StorageDriver {
  async put(): Promise<StoredFile> {
    throw new Error('Cloud storage driver not configured. Set STORAGE_DRIVER=local or provide cloud credentials.');
  }
  async remove(): Promise<void> {
    /* no-op */
  }
}

export const storage: StorageDriver =
  env.STORAGE_DRIVER === 'local' ? new LocalStorage() : new UnconfiguredStorage();

export const uploadRoot = UPLOAD_ROOT;
