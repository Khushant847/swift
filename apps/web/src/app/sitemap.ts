import type { MetadataRoute } from 'next';
import { getNav, getProducts } from '@/lib/api';
import { absoluteUrl } from '@/lib/seo';
import { productPath } from '@/lib/utils';

type SitemapEntry = MetadataRoute.Sitemap[number];

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFrequency: SitemapEntry['changeFrequency'] }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/products', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/gallery', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/upcoming', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
];

/** Utility URLs that must never appear in the XML sitemap. */
const EXCLUDED = new Set(['/sitemap', '/sitemap-page', '/api']);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [nav, products] = await Promise.all([getNav(), getAllProducts()]);
  const entries = new Map<string, SitemapEntry>();

  for (const route of STATIC_ROUTES) {
    entries.set(route.path, {
      url: absoluteUrl(route.path),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    });
  }

  // Include admin-managed navigation pages that are not in the static list,
  // without creating duplicates or linking utility routes.
  for (const link of nav) {
    if (!link.isActive || !link.url.startsWith('/') || link.url.includes('#')) continue;
    if (EXCLUDED.has(link.url) || entries.has(link.url)) continue;
    entries.set(link.url, {
      url: absoluteUrl(link.url),
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  }

  for (const product of products) {
    if (!product.isActive) continue;
    const path = productPath(product.slug);
    if (entries.has(path)) continue;
    entries.set(path, {
      url: absoluteUrl(path),
      changeFrequency: 'weekly',
      priority: 0.7,
      ...(product.updatedAt ? { lastModified: new Date(product.updatedAt) } : {}),
    });
  }

  return [...entries.values()];
}

/**
 * The products endpoint caps `limit` at 100. Walk the pages so product #101+
 * is not silently missing from sitemap.xml.
 */
async function getAllProducts() {
  const all: Awaited<ReturnType<typeof getProducts>>['items'] = [];
  let page = 1;
  let total = 0;

  do {
    const response = await getProducts(page, 100);
    total = response.total;
    all.push(...response.items);
    if (!response.items.length) break;
    page += 1;
    // Safety bound; the current catalogue has 12 products.
  } while (all.length < total && page <= 20);

  return all;
}
