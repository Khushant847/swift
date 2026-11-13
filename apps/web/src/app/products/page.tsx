import { getProducts } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';
import { itemListSchema } from '@/lib/schema';
import { JsonLd } from '@/components/JsonLd';
import { PageHero } from '@/components/PageHero';
import { ProductCatalog } from '@/components/ProductCatalog';

export const metadata = pageMetadata({
  title: 'Products & Services',
  description:
    'Explore analytical balances, industrial platform scales, moisture analysers, load-cell indicators and calibration services from Swift Instruments, Faridabad.',
  path: '/products',
});

export default async function ProductsPage() {
  // Backend caps limit at 100 — fetch the largest single page so the catalog
  // never silently truncates at the default 50.
  const { items, total } = await getProducts(1, 100);
  const listSchema = itemListSchema(items);

  return (
    <>
      {listSchema ? <JsonLd data={listSchema} /> : null}
      <PageHero
        title="Products & Services"
        subtitle="Browse our complete catalogue of precision weighing instruments, laboratory equipment and support services."
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Products & Services' }]}
      />
      <section className="section bg-slate-50">
        <div className="container-page">
          <p className="mx-auto mb-10 max-w-3xl text-center text-slate-600">
            Our range includes analytical and top-loading balances, industrial platform scales,
            commercial bench and jewellery scales, moisture analysers, load-cell indicators and
            calibration services for laboratories and industry across India.
          </p>
          <ProductCatalog products={items} total={total} />
        </div>
      </section>
    </>
  );
}
