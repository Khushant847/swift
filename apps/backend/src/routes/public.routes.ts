import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, ok, sanitizeText, slugify, ApiError } from '../lib/http';
import { validate } from '../middleware/validate';
import { enquirySchema } from '../schemas';
import { enquiryLimiter } from '../middleware/rateLimit';
import { verifyCaptcha } from '../middleware/security';
import { sendMail, wrapEmailHtml } from '../lib/mailer';
import { clientIp } from '../lib/audit';
import { logger } from '../lib/logger';

export const publicRouter = Router();

// ─── Navigation ──────────────────────────────────────────────
publicRouter.get(
  '/nav',
  asyncHandler(async (_req, res) => {
    const links = await prisma.navigationLink.findMany({
      where: { isActive: true },
      // `id` as a tie-breaker: SQLite returned insertion order for equal
      // positions, MySQL returns primary-key order. Ordering must not depend
      // on the storage engine (header and footer both start at position 0).
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return ok(res, links);
  }),
);

// ─── Hero banners ────────────────────────────────────────────
publicRouter.get(
  '/banners',
  asyncHandler(async (_req, res) => {
    const banners = await prisma.heroBanner.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return ok(res, banners);
  }),
);

// ─── Why Choose Us ───────────────────────────────────────────
publicRouter.get(
  '/why-choose-us',
  asyncHandler(async (_req, res) => {
    const items = await prisma.whyChooseUs.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return ok(res, items);
  }),
);

// ─── Products & Services ─────────────────────────────────────
publicRouter.get(
  '/products/categories',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.product.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return ok(res, rows.map((r) => r.category));
  }),
);

publicRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { search, category, featured, limit, page } = req.query as Record<string, string>;
    // Clamp: negative/NaN page or limit would produce a negative skip/take
    // and a PrismaClientValidationError 500.
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const pageNum = Math.max(Number(page) || 1, 1);
    const skip = (pageNum - 1) * take;
    const where = {
      isActive: true,
      ...(category && category !== 'all' ? { category } : {}),
      ...(featured === 'true' ? { isFeatured: true } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search } },
              { description: { contains: search } },
              { shortDesc: { contains: search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take, skip }),
      prisma.product.count({ where }),
    ]);
    return ok(res, { items, total, page: pageNum, pageSize: take });
  }),
);

publicRouter.get(
  '/products/:slug',
  asyncHandler(async (req, res) => {
    const requested = req.params.slug;
    let product = await prisma.product.findFirst({
      where: { slug: requested, isActive: true },
    });

    // Legacy rows may still contain non-URL-safe slugs (spaces, capitals,
    // trailing whitespace) from before slug normalization was enforced. If the
    // exact lookup misses, compare normalized forms so those products keep
    // resolving instead of returning a 404.
    if (!product) {
      const normalized = slugify(requested);
      if (normalized) {
        const candidates = await prisma.product.findMany({
          where: { isActive: true },
          select: { id: true, slug: true },
        });
        const legacy = candidates.find((p) => slugify(p.slug) === normalized);
        if (legacy) {
          product = await prisma.product.findFirst({ where: { id: legacy.id, isActive: true } });
        }
      }
    }

    if (!product) throw ApiError.notFound('Product not found');
    return ok(res, product);
  }),
);

// ─── Company info (address, contacts, founder, map) ──────────
publicRouter.get(
  '/company-info',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.companyInfo.findMany();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.keyName] = r.keyValue;
    return ok(res, map);
  }),
);

// ─── Upcoming products ───────────────────────────────────────
publicRouter.get(
  '/upcoming',
  asyncHandler(async (_req, res) => {
    const items = await prisma.upcomingProduct.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
    return ok(res, items);
  }),
);

// ─── Gallery ─────────────────────────────────────────────────
publicRouter.get(
  '/gallery',
  asyncHandler(async (req, res) => {
    const { category } = req.query as Record<string, string>;
    const items = await prisma.galleryMedia.findMany({
      where: category && category !== 'all' ? { categoryTag: category } : {},
      orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
    });
    return ok(res, items);
  }),
);

publicRouter.get(
  '/gallery/tags',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.galleryMedia.findMany({
      select: { categoryTag: true },
      distinct: ['categoryTag'],
      orderBy: { categoryTag: 'asc' },
    });
    return ok(res, rows.map((r) => r.categoryTag));
  }),
);

// ─── Reviews ─────────────────────────────────────────────────
publicRouter.get(
  '/reviews',
  asyncHandler(async (_req, res) => {
    const items = await prisma.review.findMany({
      where: { isHidden: false },
      // Seeded reviews share the exact same reviewTime, so a secondary key is
      // required for a stable order after the MySQL migration.
      orderBy: [{ isFeatured: 'desc' }, { reviewTime: 'desc' }, { id: 'asc' }],
    });
    const avg = items.length ? items.reduce((s, r) => s + r.rating, 0) / items.length : 0;
    return ok(res, { items, average: Number(avg.toFixed(2)), count: items.length });
  }),
);

// ─── Public settings (footer/social) ─────────────────────────
publicRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const allowed = ['footer_text', 'social_links', 'copyright', 'legal_disclaimer'];
    const rows = await prisma.setting.findMany({ where: { keyName: { in: allowed } } });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.keyName] = r.keyValue;
    return ok(res, map);
  }),
);

// ─── Enquiry submission (rate-limited + captcha) ─────────────
publicRouter.post(
  '/enquiries',
  enquiryLimiter,
  verifyCaptcha,
  validate(enquirySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      name: string;
      email: string;
      phone: string;
      companyName?: string;
      subject?: string;
      message: string;
    };

    const enquiry = await prisma.enquiry.create({
      data: {
        name: sanitizeText(body.name),
        email: sanitizeText(body.email),
        phone: sanitizeText(body.phone),
        companyName: body.companyName ? sanitizeText(body.companyName) : null,
        subject: body.subject ? sanitizeText(body.subject) : null,
        message: sanitizeText(body.message),
        ipAddress: clientIp(req),
      },
    });

    // Notify configured recipients (best-effort)
    try {
      const recipientsSetting = await prisma.setting.findUnique({ where: { keyName: 'enquiry_recipients' } });
      const recipients = (recipientsSetting?.keyValue || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (recipients.length) {
        await sendMail({
          to: recipients,
          subject: `New enquiry from ${enquiry.name}`,
          replyTo: enquiry.email,
          html: wrapEmailHtml(
            'New Website Enquiry',
            `<p><strong>Name:</strong> ${enquiry.name}</p>
             <p><strong>Email:</strong> ${enquiry.email}</p>
             <p><strong>Phone:</strong> ${enquiry.phone}</p>
             <p><strong>Company:</strong> ${enquiry.companyName ?? '-'}</p>
             <p><strong>Message:</strong><br/>${enquiry.message}</p>`,
          ),
        });
      }

      // Auto-responder to the customer
      await sendMail({
        to: enquiry.email,
        subject: 'Thank you for contacting Swift Instruments',
        html: wrapEmailHtml(
          `Thank you, ${enquiry.name}`,
          `<p>We have received your enquiry and our team will get back to you shortly.</p>
           <p>For urgent assistance call <a href="tel:+919810325260">+91 98103 25260</a>.</p>`,
        ),
      });
    } catch (err) {
      logger.warn('Enquiry notification failed (non-fatal)', err);
    }

    return ok(res, { id: enquiry.id, message: 'Enquiry submitted successfully' }, 201);
  }),
);
