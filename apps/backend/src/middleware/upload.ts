import multer from 'multer';
import type { Request } from 'express';
import { env } from '../config/env';
import { ApiError } from '../lib/http';
import { ALLOWED_MIME, validateUpload } from '../lib/storage';

const memory = multer.memoryStorage();

export const upload = multer({
  storage: memory,
  limits: {
    fileSize: env.UPLOAD_MAX_MB * 1024 * 1024,
    files: 20,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new ApiError(400, `File type ${file.mimetype} is not allowed`));
    }
    const check = validateUpload(file.originalname, file.mimetype);
    if (!check.ok) return cb(new ApiError(400, check.error ?? 'Invalid file'));
    cb(null, true);
  },
});

export const uploadSingle = upload.single('file');
export const uploadMany = upload.array('files', 20);
