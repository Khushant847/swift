import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { asyncHandler, ok, ApiError, sanitizeHtml, sanitizeText } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireRole } from '../../middleware/auth';
import { audit } from '../../lib/audit';
import { crudRouter } from './crudFactory';
import {
  companyInfoBulkSchema,
  navSchema,
  reorderSchema,
  reviewSchema,
  settingsBulkSchema,
} from '../../schemas';
import { env } from '../../config/env';

export const contentRouter = Router();

const HTML_KEYS = new Set(['founder_bio', 'history', 'about', 'why_text']);

// ─── Company info (about, address, contacts, map) ────────────
contentRouter.get(
  '/company-info',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.companyInfo.findMany();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.keyName] = r.keyValue;
    return ok(res, map);
  }),
);

contentRouter.put(
  '/company-info',
  validate(companyInfoBulkSchema),
  asyncHandler(async (req, res) => {
    const { items } = req.body as { items: { keyName: string; keyValue: string }[] };
    await prisma.$transaction(
      items.map((item) =>
        prisma.companyInfo.upsert({
          where: { keyName: item.keyName },
          create: {
            keyName: item.keyName,
            keyValue: HTML_KEYS.has(item.keyName) ? sanitizeHtml(item.keyValue) : sanitizeText(item.keyValue),
          },
          update: {
            keyValue: HTML_KEYS.has(item.keyName) ? sanitizeHtml(item.keyValue) : sanitizeText(item.keyValue),
          },
        }),
      ),
    );
    await audit({
      adminId: req.admin?.sub,
      adminEmail: req.admin?.email ?? 'system',
      action: 'config',
      entity: 'company-info',
      details: { keys: items.map((i) => i.keyName) },
      req,
    });
    return ok(res, { updated: items.length });
  }),
);

// ─── Navigation links (header/footer) ────────────────────────
contentRouter.use(
  '/nav',
  crudRouter({
    entity: 'nav',
    delegate: prisma.navigationLink,
    createSchema: navSchema,
    updateSchema: navSchema.partial(),
    orderBy: [{ location: 'asc' }, { position: 'asc' }, { id: 'asc' }],
    listWhere: (req) => {
      const { location } = req.query as Record<string, string>;
      return location ? { location } : {};
    },
    transform: (data: Record<string, unknown>) => ({
      ...data,
      ...(data.title ? { title: sanitizeText(String(data.title)) } : {}),
    }),
  }),
);

contentRouter.post(
  '/nav/reorder',
  validate(reorderSchema),
  asyncHandler(async (req, res) => {
    const { items } = req.body as { items: { id: string; position: number }[] };
    await prisma.$transaction(
      items.map((i) =>
        prisma.navigationLink.update({ where: { id: i.id }, data: { position: i.position } }),
      ),
    );
    return ok(res, { reordered: items.length });
  }),
);

// ─── Settings (footer, social, recipients, backups) ──────────
contentRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.keyName] = r.keyValue;
    return ok(res, map);
  }),
);

// Settings control site-wide behaviour (footer, social links, enquiry
// recipients) — super-admin only, matching the admin UI's documented contract.
contentRouter.put(
  '/settings',
  requireRole('super_admin'),
  validate(settingsBulkSchema),
  asyncHandler(async (req, res) => {
    const { items } = req.body as { items: { keyName: string; keyValue: string }[] };

    // social_links is stored as JSON and rendered straight into footer <a
    // href>s on the public site — validate the shape and reject script URLs.
    const social = items.find((i) => i.keyName === 'social_links');
    if (social) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(social.keyValue);
      } catch {
        throw ApiError.badRequest('social_links must be valid JSON');
      }
      const links = Array.isArray(parsed) ? parsed : [];
      const urlOk = (u: unknown) =>
        typeof u === 'string' && (/^https?:\/\/[^\s]+$/i.test(u) || u.startsWith('/'));
      if (!links.every((l) => l && typeof l === 'object' && urlOk((l as Record<string, unknown>).url))) {
        throw ApiError.badRequest('Each social link needs an http(s) url');
      }
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.setting.upsert({
          where: { keyName: item.keyName },
          create: { keyName: item.keyName, keyValue: item.keyValue },
          update: { keyValue: item.keyValue },
        }),
      ),
    );
    await audit({
      adminId: req.admin?.sub,
      adminEmail: req.admin?.email ?? 'system',
      action: 'config',
      entity: 'settings',
      details: { keys: items.map((i) => i.keyName) },
      req,
    });
    return ok(res, { updated: items.length });
  }),
);

// ─── Reviews (+ Google Places sync) ──────────────────────────
contentRouter.use(
  '/reviews',
  crudRouter({
    entity: 'review',
    delegate: prisma.review,
    createSchema: reviewSchema,
    updateSchema: reviewSchema.partial(),
    orderBy: [{ isFeatured: 'desc' }, { reviewTime: 'desc' }, { id: 'asc' }],
    transform: (data: Record<string, unknown>) => ({
      ...data,
      ...(data.text ? { text: sanitizeText(String(data.text)) } : {}),
      ...(data.authorName ? { authorName: sanitizeText(String(data.authorName)) } : {}),
    }),
  }),
);

contentRouter.post(
  '/reviews/sync',
  asyncHandler(async (req, res) => {
    if (!env.GOOGLE_PLACES_API_KEY || !env.GOOGLE_PLACE_ID) {
      throw ApiError.badRequest(
        'Google Places API not configured. Set GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID to enable sync.',
      );
    }
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
      env.GOOGLE_PLACE_ID,
    )}&fields=reviews,rating,user_ratings_total&key=${env.GOOGLE_PLACES_API_KEY}`;
    let resp: Response;
    try {
      resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch {
      throw ApiError.badGateway('Google Places API is unreachable — sync aborted');
    }
    if (!resp.ok) throw ApiError.badGateway(`Google Places API returned HTTP ${resp.status}`);
    const json = (await resp.json()) as {
      result?: { reviews?: Array<{ author_name: string; rating: number; text: string; profile_photo_url: string; time: number; author_url?: string }> };
      status: string;
      error_message?: string;
    };
    // An invalid key/quota error arrives as HTTP 200 with a non-OK status —
    // without this check it silently reported "synced: 0".
    if (json.status !== 'OK') {
      throw ApiError.badRequest(`Google Places sync failed: ${json.status}${json.error_message ? ` — ${json.error_message}` : ''}`);
    }
    const reviews = json.result?.reviews ?? [];
    let synced = 0;
    for (const r of reviews) {
      const reviewTime = new Date(r.time * 1000);
      const text = sanitizeText(r.text);
      const existing = await prisma.review.findFirst({
        where: { authorName: r.author_name, text },
      });
      if (existing) continue;
      await prisma.review.create({
        data: {
          authorName: r.author_name,
          rating: r.rating,
          text,
          profilePhotoUrl: r.profile_photo_url,
          source: 'google',
          reviewTime,
        },
      });
      synced += 1;
    }
    await audit({
      adminId: req.admin?.sub,
      adminEmail: req.admin?.email ?? 'system',
      action: 'config',
      entity: 'reviews',
      details: { synced },
      req,
    });
    return ok(res, { synced, total: reviews.length });
  }),
);
