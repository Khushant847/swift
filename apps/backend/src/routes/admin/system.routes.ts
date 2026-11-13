import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { asyncHandler, ok, ApiError, sanitizeText } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { adminUserSchema, mediaUpdateSchema } from '../../schemas';
import { requireRole } from '../../middleware/auth';
import { audit } from '../../lib/audit';
import { uploadSingle } from '../../middleware/upload';
import { uploadLimiter } from '../../middleware/rateLimit';
import { storage, isVideoMime, type StoredFile } from '../../lib/storage';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';

export const systemRouter = Router();

// ─── Dashboard analytics ─────────────────────────────────────
systemRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [
      totalEnquiries,
      newEnquiries,
      contactedEnquiries,
      activeProducts,
      featuredProducts,
      mediaCount,
      galleryCount,
      upcomingCount,
      reviewCount,
      navigationCount,
      bannerCount,
    ] = await Promise.all([
      prisma.enquiry.count(),
      prisma.enquiry.count({ where: { status: 'new' } }),
      prisma.enquiry.count({ where: { status: 'contacted' } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isFeatured: true } }),
      prisma.media.count(),
      prisma.galleryMedia.count(),
      prisma.upcomingProduct.count(),
      prisma.review.count(),
      prisma.navigationLink.count(),
      prisma.heroBanner.count(),
    ]);

    const recentEnquiries = await prisma.enquiry.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 6,
    });

    const recentAudit = await prisma.auditLog.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 6 });

    // last 7 days enquiry trend
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    const recent = await prisma.enquiry.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const trend: { date: string; count: number }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      trend.push({ date: key, count: recent.filter((r) => r.createdAt.toISOString().slice(0, 10) === key).length });
    }

    return ok(res, {
      stats: {
        totalEnquiries,
        newEnquiries,
        contactedEnquiries,
        activeProducts,
        featuredProducts,
        mediaCount,
        galleryCount,
        upcomingCount,
        reviewCount,
        navigationCount,
        bannerCount,
      },
      recentEnquiries,
      recentAudit,
      trend,
    });
  }),
);

// ─── Audit logs ──────────────────────────────────────────────
systemRouter.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string>;
    // Clamp: negative/NaN page or limit would produce a negative skip/take
    // and a PrismaClientValidationError 500.
    const take = Math.min(Math.max(Number(q.limit) || 30, 1), 200);
    const page = Math.max(Number(q.page) || 1, 1);
    const skip = (page - 1) * take;
    const where = {
      ...(q.entity && q.entity !== 'all' ? { entity: q.entity } : {}),
      ...(q.action && q.action !== 'all' ? { action: q.action } : {}),
      ...(q.search
        ? {
            OR: [
              { adminEmail: { contains: q.search } },
              { entity: { contains: q.search } },
              { details: { contains: q.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take, skip }),
      prisma.auditLog.count({ where }),
    ]);
    return ok(res, { items, total, page, pageSize: take });
  }),
);

// ─── Admin users (RBAC — super admin only) ───────────────────
systemRouter.get(
  '/users',
  requireRole('super_admin'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.admin.findMany({
      select: { id: true, username: true, email: true, role: true, isActive: true, mfaEnabled: true, lastLoginAt: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return ok(res, users);
  }),
);

systemRouter.post(
  '/users',
  requireRole('super_admin'),
  validate(adminUserSchema),
  asyncHandler(async (req, res) => {
    const { username, email, password, role, isActive } = req.body as {
      username: string;
      email: string;
      password?: string;
      role: 'super_admin' | 'content_editor';
      isActive?: boolean;
    };
    if (!password) throw ApiError.badRequest('Password is required');
    const created = await prisma.admin.create({
      data: {
        username: sanitizeText(username),
        email: email.toLowerCase().trim(),
        passwordHash: await bcrypt.hash(password, 12),
        role,
        isActive: isActive ?? true,
      },
      select: { id: true, username: true, email: true, role: true, isActive: true },
    });
    await audit({ adminId: req.admin?.sub, adminEmail: req.admin?.email ?? 'system', action: 'create', entity: 'admin', entityId: created.id, req });
    return ok(res, created, 201);
  }),
);

systemRouter.put(
  '/users/:id',
  requireRole('super_admin'),
  validate(adminUserSchema.partial()),
  asyncHandler(async (req, res) => {
    const { username, email, password, role, isActive } = req.body as {
      username?: string;
      email?: string;
      password?: string;
      role?: 'super_admin' | 'content_editor';
      isActive?: boolean;
    };
    // Guard against self-lockout: a super-admin must not demote or deactivate
    // their own account (only DELETE checks this today).
    if (req.params.id === req.admin?.sub && (role === 'content_editor' || isActive === false)) {
      throw ApiError.badRequest('You cannot demote or deactivate your own account');
    }
    const data: Record<string, unknown> = {};
    if (username) data.username = sanitizeText(username);
    if (email) data.email = email.toLowerCase().trim();
    if (role) data.role = role;
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (password) data.passwordHash = await bcrypt.hash(password, 12);

    const updated = await prisma.admin.update({
      where: { id: req.params.id },
      data,
      select: { id: true, username: true, email: true, role: true, isActive: true },
    });
    await audit({ adminId: req.admin?.sub, adminEmail: req.admin?.email ?? 'system', action: 'update', entity: 'admin', entityId: req.params.id, req });
    return ok(res, updated);
  }),
);

systemRouter.delete(
  '/users/:id',
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.admin?.sub) throw ApiError.badRequest('You cannot delete your own account');
    await prisma.admin.delete({ where: { id: req.params.id } });
    await audit({ adminId: req.admin?.sub, adminEmail: req.admin?.email ?? 'system', action: 'delete', entity: 'admin', entityId: req.params.id, req });
    return ok(res, { deleted: true });
  }),
);

// ─── Media Manager ───────────────────────────────────────────
systemRouter.get(
  '/media',
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string>;
    const items = await prisma.media.findMany({
      where: {
        ...(q.folder && q.folder !== 'all' ? { folder: q.folder } : {}),
        ...(q.search ? { OR: [{ originalName: { contains: q.search } }, { tags: { contains: q.search } }] } : {}),
      },
      orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
    });
    return ok(res, items);
  }),
);

systemRouter.post(
  '/media/upload',
  uploadLimiter,
  uploadSingle,
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw ApiError.badRequest('No file uploaded');
    const folder = (req.body?.folder as string) || 'general';
    const stored: StoredFile = await storage.put(file.buffer, file.originalname, file.mimetype, folder);
    const media = await prisma.media.create({
      data: {
        url: stored.url,
        filename: stored.filename,
        originalName: sanitizeText(file.originalname),
        mimeType: file.mimetype,
        size: file.size,
        folder: folder.replace(/[^a-z0-9_-]/gi, '') || 'general',
        tags: (req.body?.tags as string) || null,
      },
    });
    await audit({ adminId: req.admin?.sub, adminEmail: req.admin?.email ?? 'system', action: 'upload', entity: 'media', entityId: media.id, details: { filename: stored.filename }, req });
    return ok(res, { ...media, mediaType: isVideoMime(file.mimetype) ? 'video' : 'image' }, 201);
  }),
);

systemRouter.patch(
  '/media/:id',
  validate(mediaUpdateSchema),
  asyncHandler(async (req, res) => {
    const updated = await prisma.media.update({ where: { id: req.params.id }, data: req.body });
    return ok(res, updated);
  }),
);

systemRouter.delete(
  '/media/:id',
  asyncHandler(async (req, res) => {
    const media = await prisma.media.findUnique({ where: { id: req.params.id } });
    if (!media) throw ApiError.notFound('Media not found');
    await storage.remove(media.filename);
    await prisma.media.delete({ where: { id: media.id } });
    await audit({ adminId: req.admin?.sub, adminEmail: req.admin?.email ?? 'system', action: 'delete', entity: 'media', entityId: media.id, req });
    return ok(res, { deleted: true });
  }),
);

// ─── Database backup (super admin) ───────────────────────────
function resolveSqlitePath(): string | null {
  if (!env.DATABASE_URL.startsWith('file:')) return null;
  const rel = env.DATABASE_URL.replace('file:', '');
  return path.resolve(__dirname, '..', '..', '..', 'prisma', rel);
}

systemRouter.get(
  '/backup/info',
  requireRole('super_admin'),
  asyncHandler(async (_req, res) => {
    const dbPath = resolveSqlitePath();
    if (!dbPath) return ok(res, { driver: 'postgres', downloadable: false });
    const exists = fs.existsSync(dbPath);
    return ok(res, {
      driver: 'sqlite',
      downloadable: true,
      sizeBytes: exists ? fs.statSync(dbPath).size : 0,
      modifiedAt: exists ? fs.statSync(dbPath).mtime.toISOString() : null,
    });
  }),
);

systemRouter.get(
  '/backup/download',
  requireRole('super_admin'),
  asyncHandler(async (req, res) => {
    const dbPath = resolveSqlitePath();
    if (!dbPath || !fs.existsSync(dbPath)) throw ApiError.badRequest('No file-based database available for download');
    await audit({ adminId: req.admin?.sub, adminEmail: req.admin?.email ?? 'system', action: 'export', entity: 'backup', req });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="swift-backup-${stamp}.db"`);
    const stream = fs.createReadStream(dbPath);
    // Without this a mid-stream read error would end the response as a
    // silently truncated "backup" file.
    stream.on('error', (err) => {
      logger.error('Backup download stream failed', err);
      res.destroy(err);
    });
    return stream.pipe(res);
  }),
);
