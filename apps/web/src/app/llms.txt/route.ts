import { getCompanyInfo, getProducts } from '@/lib/api';
import { absoluteUrl } from '@/lib/seo';
import { productPath } from '@/lib/utils';

export const revalidate = 3600;

/**
 * Optional AI-readable summary. This is a convenience file, not a ranking
 * factor and not a replacement for normal crawlable HTML. Only facts already
 * published on the website are included.
 */
export async function GET() {
  const [company, products] = await Promise.all([getCompanyInfo(), getProducts(1, 100)]);
  const name = company.company_name || 'Swift Instruments';
  const categories = [...new Set(products.items.map((p) => p.category))];

  const lines: string[] = [
    `# ${name}`,
    '',
    company.tagline ? `> ${company.tagline}` : '> Precision weighing and measurement instruments.',
    '',
    '## What we do',
    '',
    `${name} supplies and supports weighing and measurement instruments for laboratories and industry in India.`,
    company.address ? `Address: ${company.address}` : '',
    '',
    categories.length ? `Product categories: ${categories.join(', ')}.` : '',
    '',
    '## Contact',
    '',
    ...(company.address ? [`- Address: ${company.address}`] : []),
    ...(company.phone ? [`- Phone: ${company.phone}`] : []),
    ...(company.mobile ? [`- Mobile: ${company.mobile}`] : []),
    ...(company.email ? [`- Email: ${company.email}`] : []),
    '',
    '## Key pages',
    '',
    `- [Home](${absoluteUrl('/')})`,
    `- [Products and services](${absoluteUrl('/products')})`,
    `- [About](${absoluteUrl('/about')})`,
    `- [Contact](${absoluteUrl('/contact')})`,
    `- [Gallery](${absoluteUrl('/gallery')})`,
    `- [Privacy policy](${absoluteUrl('/privacy')})`,
    `- [Terms of service](${absoluteUrl('/terms')})`,
    '',
    '## Products',
    '',
    ...products.items
      .filter((product) => product.isActive)
      .map(
        (product) =>
          `- [${product.title}](${absoluteUrl(productPath(product.slug))})${
            product.shortDesc ? `: ${product.shortDesc}` : ` — ${product.category}`
          }`,
      ),
    '',
    '## Note',
    '',
    'This file is an optional convenience for AI tools. It does not control indexing or guarantee inclusion in any AI answer.',
  ];

  return new Response(lines.filter((line) => line !== undefined).join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
