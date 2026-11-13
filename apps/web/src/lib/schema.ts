import type { CompanyInfo, Product, PublicSettings } from './types';
import { parseSocialLinks, productPath } from './utils';
import { SITE_NAME, SITE_URL, absoluteUrl } from './seo';

type Schema = Record<string, unknown>;

export function organizationId(): string {
  return `${SITE_URL}/#organization`;
}

/**
 * Only real profile URLs belong in `sameAs`. The seed data ships with bare
 * domains (https://linkedin.com etc.) which are not company profiles, so they
 * are excluded rather than published as false entity signals.
 */
function profileUrls(raw?: string): string[] {
  return parseSocialLinks(raw)
    .map((s) => s.url)
    .filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.pathname.replace(/\/+$/, '') !== '';
      } catch {
        return false;
      }
    });
}

/**
 * Organization schema built only from fields already shown in the header,
 * footer and contact page. Certification claims are deliberately NOT emitted
 * here — they must be verified and handled as content, not markup.
 */
export function organizationSchema(company: CompanyInfo, settings?: PublicSettings): Schema | null {
  if (!company.company_name) return null;

  const logo = company.logo_url || company.logo;
  const sameAs = profileUrls(settings?.social_links);
  const telephone = company.mobile || company.phone;

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationId(),
    name: company.company_name,
    url: SITE_URL,
    ...(company.tagline ? { slogan: company.tagline } : {}),
    ...(company.established_year ? { foundingDate: company.established_year } : {}),
    ...(logo ? { logo: absoluteUrl(logo) } : {}),
    ...(company.email ? { email: company.email } : {}),
    ...(telephone ? { telephone } : {}),
    // Text is valid for schema.org `address`; using the full displayed address
    // avoids inventing separate street/locality/postal fields.
    ...(company.address ? { address: company.address } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(telephone || company.email
      ? {
          contactPoint: [
            {
              '@type': 'ContactPoint',
              contactType: 'sales',
              ...(telephone ? { telephone } : {}),
              ...(company.email ? { email: company.email } : {}),
              areaServed: 'IN',
            },
          ],
        }
      : {}),
  };
}

export function websiteSchema(company: CompanyInfo): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: company.company_name || SITE_NAME,
    publisher: { '@id': organizationId() },
    inLanguage: 'en-IN',
  };
}

export function breadcrumbSchema(items: { label: string; href?: string }[]): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

export function itemListSchema(products: Product[]): Schema | null {
  if (!products.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.title,
      url: absoluteUrl(productPath(product.slug)),
    })),
  };
}

/** Product schema without price/offers/ratings, because none are published. */
export function productSchema(product: Product): Schema {
  const description =
    product.shortDesc ||
    product.description
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 320);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    ...(description ? { description } : {}),
    ...(product.imageUrl ? { image: [absoluteUrl(product.imageUrl)] } : {}),
    category: product.category,
    brand: { '@type': 'Brand', name: SITE_NAME },
    manufacturer: { '@id': organizationId() },
    url: absoluteUrl(productPath(product.slug)),
  };
}

export function contactPageSchema(company: CompanyInfo): Schema | null {
  if (!company.company_name) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    url: absoluteUrl('/contact'),
    name: `Contact ${company.company_name}`,
    mainEntity: { '@id': organizationId() },
  };
}

export function aboutPageSchema(company: CompanyInfo): Schema | null {
  if (!company.company_name) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url: absoluteUrl('/about'),
    name: `About ${company.company_name}`,
    mainEntity: { '@id': organizationId() },
  };
}
