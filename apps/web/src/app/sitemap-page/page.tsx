import Link from 'next/link';
import { getNav, getProducts } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';
import { productPath } from '@/lib/utils';
import { PageHero } from '@/components/PageHero';

// `/sitemap` is a rewrite to this file. Keep one canonical human URL and keep
// the utility page out of the index.
export const metadata = pageMetadata({
  title: 'Sitemap',
  description: 'Every page on the Swift Instruments website in one place.',
  path: '/sitemap',
  noIndex: true,
});

export default async function SitemapPage() {
  const [nav, products] = await Promise.all([getNav(), getProducts()]);
  const pages = Array.from(
    new Map(
      nav
        .filter((n) => n.isActive && n.url.startsWith('/'))
        .filter((n) => !['/privacy', '/terms', '/sitemap'].includes(n.url))
        .map((n) => [n.url, n]),
    ).values(),
  );
  const productLinks = products.items.filter((p) => p.isActive).map((p) => ({ title: p.title, url: productPath(p.slug) }));

  return (
    <>
      <PageHero
        title="Sitemap"
        subtitle="Find any page on our website."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Sitemap' }]}
      />
      <section className="container-section">
        <div className="mx-auto grid max-w-3xl gap-10 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Pages</h2>
            <ul className="mt-4 space-y-2 text-slate-700">
              {pages.map((p) => (
                <li key={p.id}>
                  <Link href={p.url} className="hover:text-brand-700">
                    {p.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/privacy" className="hover:text-brand-700">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-brand-700">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">Products</h2>
            <ul className="mt-4 space-y-2 text-slate-700">
              {productLinks.length === 0 ? <li className="text-slate-500">No products to show.</li> : null}
              {productLinks.map((p) => (
                <li key={p.url}>
                  <Link href={p.url} className="hover:text-brand-700">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
