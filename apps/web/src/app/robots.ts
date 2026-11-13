import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      // Search and AI crawlers are allowed by default. `/api/` is blocked
      // because it only returns JSON, not indexable pages. Do not disallow
      // `/_next/`: crawlers need the CSS/JS that renders these pages.
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
