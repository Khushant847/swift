import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler, ok, sanitizeHtml, sanitizeText, slugify } from '../../lib/http';
import { crudRouter } from './crudFactory';
import {
  bannerSchema,
  gallerySchema,
  productSchema,
  upcomingSchema,
  whySchema,
  reorderSchema,
} from '../../schemas';
import { validate } from '../../middleware/validate';

export const catalogRouter = Router();

// ─── Products & Services ─────────────────────────────────────
catalogRouter.use(
  '/products',
  crudRouter({
    entity: 'product',
    delegate: prisma.product,
    createSchema: productSchema,
    updateSchema: productSchema.partial(),
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    listWhere: (req) => {
      const { search, category, status } = req.query as Record<string, string>;
      return {
        ...(category && category !== 'all' ? { category } : {}),
        ...(status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : {}),
        ...(search
          ? { OR: [{ title: { contains: search } }, { category: { contains: search } }] }
          : {}),
      };
    },
    transform: (data: Record<string, unknown>, req: Request) => {
      const out = { ...data };
      // Normalize any admin-supplied slug into a URL-safe value. Without this,
      // a slug like "Digital Heating Incubator " (trailing space/capitals) gets
      // stored verbatim and the public `/products/:slug` lookup 404s.
      if (typeof out.slug === 'string') {
        const normalized = slugify(out.slug);
        if (normalized) out.slug = normalized;
        else delete out.slug;
      }
      // Only derive a slug at creation time. Regenerating it on update would
      // silently change the public URL (broken links/SEO) on every title edit.
      if (req.method === 'POST' && typeof out.title === 'string' && !out.slug) {
        out.slug = slugify(out.title) || `product-${Date.now().toString(36)}`;
      }
      if (out.title) out.title = sanitizeText(String(out.title));
      if (typeof out.description === 'string') out.description = sanitizeHtml(out.description);
      if (typeof out.shortDesc === 'string') out.shortDesc = sanitizeText(out.shortDesc);
      return out;
    },
  }),
);

// ─── Hero banners ────────────────────────────────────────────
catalogRouter.use(
  '/banners',
  crudRouter({
    entity: 'banner',
    delegate: prisma.heroBanner,
    createSchema: bannerSchema,
    updateSchema: bannerSchema.partial(),
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
  }),
);

catalogRouter.post(
  '/banners/reorder',
  validate(reorderSchema),
  asyncHandler(async (req, res) => {
    const { items } = req.body as { items: { id: string; position: number }[] };
    await prisma.$transaction(
      items.map((i) =>
        prisma.heroBanner.update({ where: { id: i.id }, data: { displayOrder: i.position } }),
      ),
    );
    return ok(res, { reordered: items.length });
  }),
);

// ─── Why Choose Us ───────────────────────────────────────────
catalogRouter.use(
  '/why-choose-us',
  crudRouter({
    entity: 'why',
    delegate: prisma.whyChooseUs,
    createSchema: whySchema,
    updateSchema: whySchema.partial(),
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    transform: (data: Record<string, unknown>) => ({
      ...data,
      ...(data.title ? { title: sanitizeText(String(data.title)) } : {}),
      ...(data.description ? { description: sanitizeText(String(data.description)) } : {}),
    }),
  }),
);

// ─── Upcoming products ───────────────────────────────────────
catalogRouter.use(
  '/upcoming',
  crudRouter({
    entity: 'upcoming',
    delegate: prisma.upcomingProduct,
    createSchema: upcomingSchema,
    updateSchema: upcomingSchema.partial(),
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    transform: (data: Record<string, unknown>) => ({
      ...data,
      ...(data.title ? { title: sanitizeText(String(data.title)) } : {}),
      ...(data.teaserDesc ? { teaserDesc: sanitizeText(String(data.teaserDesc)) } : {}),
    }),
  }),
);

catalogRouter.post(
  '/upcoming/reorder',
  validate(reorderSchema),
  asyncHandler(async (req, res) => {
    const { items } = req.body as { items: { id: string; position: number }[] };
    await prisma.$transaction(
      items.map((i) =>
        prisma.upcomingProduct.update({ where: { id: i.id }, data: { displayOrder: i.position } }),
      ),
    );
    return ok(res, { reordered: items.length });
  }),
);

// ─── Gallery ─────────────────────────────────────────────────
catalogRouter.use(
  '/gallery',
  crudRouter({
    entity: 'gallery',
    delegate: prisma.galleryMedia,
    createSchema: gallerySchema,
    updateSchema: gallerySchema.partial(),
    orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
    listWhere: (req) => {
      const { category } = req.query as Record<string, string>;
      return category && category !== 'all' ? { categoryTag: category } : {};
    },
  }),
);

catalogRouter.post(
  '/gallery/bulk',
  validate(z.object({ items: z.array(gallerySchema).min(1) })),
  asyncHandler(async (req, res) => {
    const { items } = req.body as { items: z.infer<typeof gallerySchema>[] };
    const created = await prisma.galleryMedia.createMany({ data: items });
    return ok(res, { created: created.count }, 201);
  }),
);
