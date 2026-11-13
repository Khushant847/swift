import { z } from 'zod';

/**
 * URL validator that accepts internal paths (`/products`, `#anchor`) and
 * external http(s)/mailto/tel links, but rejects `javascript:`, `data:` and
 * other script-bearing schemes — admin-controlled hrefs are rendered on the
 * public site, so a `javascript:` URL would be stored XSS.
 */
const safeUrl = z
  .string()
  .min(1)
  .max(300)
  .refine(
    (v) =>
      v.startsWith('/') ||
      v.startsWith('#') ||
      /^https?:\/\/[^\s]+$/i.test(v) ||
      /^mailto:[^\s@]+@[^\s@]+$/i.test(v) ||
      /^tel:[+\d][\d\s-]+$/.test(v),
    'Must be a relative path or an http(s)/mailto/tel URL',
  );

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(200),
});

export const mfaVerifySchema = z.object({
  challengeId: z.string().min(8),
  code: z.string().min(6).max(8),
});

export const mfaSetupSchema = z.object({
  enable: z.boolean(),
  code: z.string().min(6).max(8).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8).max(200),
});

export const enquirySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().regex(/^[+\d][\d\s-]{6,19}$/, 'Phone must contain digits (optionally with +, spaces or dashes)'),
  companyName: z.string().max(160).optional().or(z.literal('')),
  subject: z.string().max(200).optional().or(z.literal('')),
  message: z.string().min(5).max(4000),
  captchaToken: z.string().optional(),
});

export const adminUserSchema = z.object({
  username: z.string().min(3).max(60),
  email: z.string().email(),
  password: z.string().min(8).max(200).optional(),
  role: z.enum(['super_admin', 'content_editor']),
  isActive: z.boolean().optional(),
});

export const navSchema = z.object({
  title: z.string().min(1).max(80),
  url: safeUrl,
  position: z.number().int().optional(),
  location: z.enum(['header', 'footer']).default('header'),
  isActive: z.boolean().optional(),
});

export const bannerSchema = z.object({
  title: z.string().max(160).optional().nullable(),
  subtitle: z.string().max(300).optional().nullable(),
  ctaLabel: z.string().max(60).optional().nullable(),
  ctaUrl: safeUrl.optional().nullable(),
  mediaUrl: z.string().min(1),
  mediaType: z.enum(['image', 'video']).default('image'),
  displayOrder: z.number().int().optional(),
  intervalSeconds: z.number().int().min(1000).max(60000).default(5000),
  isActive: z.boolean().optional(),
});

export const whySchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(600),
  icon: z.string().max(60).default('BadgeCheck'),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const productSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z.string().max(120).optional(),
  category: z.string().min(1).max(80),
  shortDesc: z.string().max(300).optional().nullable(),
  description: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
  specs: z.string().optional().nullable(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const upcomingSchema = z.object({
  title: z.string().min(2).max(200),
  teaserDesc: z.string().min(1).max(1000),
  expectedLaunch: z.string().max(80).default('Coming soon'),
  imageUrl: z.string().optional().nullable(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const gallerySchema = z.object({
  mediaUrl: z.string().min(1),
  mediaType: z.enum(['image', 'video']).default('image'),
  categoryTag: z.string().min(1).max(60).default('Office'),
  caption: z.string().max(200).optional().nullable(),
});

export const reviewSchema = z.object({
  authorName: z.string().min(1).max(120),
  rating: z.number().int().min(1).max(5).default(5),
  text: z.string().min(1).max(2000),
  profilePhotoUrl: z.string().optional().nullable(),
  source: z.enum(['manual', 'google']).default('manual'),
  isFeatured: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const companyInfoSchema = z.object({
  keyName: z.string().min(1).max(60),
  keyValue: z.string().max(20000),
});

export const companyInfoBulkSchema = z.object({
  items: z.array(companyInfoSchema).min(1),
});

export const settingSchema = z.object({
  keyName: z.string().min(1).max(60),
  keyValue: z.string().max(20000),
});

export const settingsBulkSchema = z.object({
  items: z.array(settingSchema).min(1),
});

export const enquiryUpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'closed']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const bulkEnquirySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  status: z.enum(['new', 'contacted', 'closed']).optional(),
  action: z.enum(['delete', 'status']).default('status'),
});

export const mediaUpdateSchema = z.object({
  folder: z.string().max(60).optional(),
  tags: z.string().max(300).optional().nullable(),
  originalName: z.string().max(200).optional(),
});

export const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string(), position: z.number().int() })).min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type EnquiryInput = z.infer<typeof enquirySchema>;
