import type { Metadata } from 'next';

/**
 * Canonical public origin for the website.
 *
 * Resolution order:
 *  1. `NEXT_PUBLIC_SITE_URL` (required in production — set it to the final
 *     custom domain, e.g. https://swiftinstruments.in).
 *  2. Vercel's production URL, so a deployment never publishes localhost
 *     canonicals by accident.
 *  3. The deployment URL for preview builds.
 *  4. localhost for local development.
 *
 * A localhost value is ignored on Vercel: `.env` files are not deployed, but
 * this also protects against someone pasting a local URL into the dashboard.
 */
const LOCAL_URL_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit && !(process.env.VERCEL && LOCAL_URL_PATTERN.test(explicit))) {
    return explicit.replace(/\/+$/, '');
  }

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) return `https://${vercelProduction.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  const vercelDeployment = process.env.VERCEL_URL?.trim();
  if (vercelDeployment) return `https://${vercelDeployment.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = 'Swift Instruments';

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL && LOCAL_URL_PATTERN.test(process.env.NEXT_PUBLIC_SITE_URL)))
) {
  console.warn(
    '[seo] NEXT_PUBLIC_SITE_URL is not set to a public domain. Canonical, sitemap, robots and Open Graph URLs are using a Vercel/localhost fallback.',
  );
}

/** Absolute URL for an internal path (external URLs are returned untouched). */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface PageSeoInput {
  title: string;
  description: string;
  /** Route path, e.g. `/products` or `/products/ab-220`. */
  path: string;
  /** Optional image path or absolute URL used for OG/Twitter cards. */
  image?: string | null;
  type?: 'website' | 'article';
  noIndex?: boolean;
  /** Use when `title` already contains the brand name. */
  absoluteTitle?: boolean;
}

/**
 * Per-page metadata with a canonical URL and its own Open Graph/Twitter tags.
 * Without this, every page inherits the root layout's generic OG title and
 * description (which is what the old site did).
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  type = 'website',
  noIndex = false,
  absoluteTitle = false,
}: PageSeoInput): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const imageUrl = image ? absoluteUrl(image) : undefined;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      locale: 'en_IN',
      type,
      ...(imageUrl ? { images: [{ url: imageUrl, alt: title }] } : {}),
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title: fullTitle,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
