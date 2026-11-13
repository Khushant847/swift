import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, PhoneCall } from 'lucide-react';
import { getCompanyInfo, getProduct } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';
import { productSchema } from '@/lib/schema';
import { safeParseSpecs, mediaUrl, productPath } from '@/lib/utils';
import { JsonLd } from '@/components/JsonLd';
import { PageHero } from '@/components/PageHero';
import { SafeImage } from '@/components/SafeImage';
import { EnquiryForm } from '@/components/EnquiryForm';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  // Trigger the real 404 here as well. If only the page calls notFound(), the
  // response has already started streaming with a 200 in production.
  if (!product) notFound();

  const description =
    product.shortDesc ||
    product.description
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 155);

  return pageMetadata({
    title: product.title,
    description: description || `Product details for ${product.title} from Swift Instruments.`,
    path: productPath(product.slug),
    image: product.imageUrl,
  });
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, company] = await Promise.all([getProduct(slug), getCompanyInfo()]);
  if (!product) notFound();

  const specs = safeParseSpecs(product.specs);
  const schema = productSchema(product);

  return (
    <>
      <JsonLd data={schema} />
      <PageHero
        title={product.title}
        subtitle={product.shortDesc || undefined}
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          { label: product.title },
        ]}
      />

      <section className="section bg-white">
        <div className="container-page">
          <Link href="/products" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-brand-800 hover:gap-3 transition-all">
            <ArrowLeft className="h-4 w-4" /> Back to all products
          </Link>

          <div className="grid gap-10 lg:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-3xl bg-slate-100">
              <SafeImage
                src={mediaUrl(product.imageUrl)}
                alt={product.title}
                className="h-full w-full object-cover object-center"
                fallback={
                  <div className="flex h-full items-center justify-center text-slate-300">Swift Instruments</div>
                }
              />
            </div>

            <div>
              <span className="eyebrow">{product.category}</span>
              <h2 className="heading-lg">{product.title}</h2>
              <div
                className="prose prose-slate mt-5 max-w-none text-slate-600 [&_p]:mb-3"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />

              {specs.length ? (
                <div className="mt-8">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Key Specifications
                  </h3>
                  <dl className="grid grid-cols-2 gap-3">
                    {specs.map((s) => (
                      <div key={s.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <dt className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Check className="h-3.5 w-3.5 text-brand-700" /> {s.label}
                        </dt>
                        <dd className="mt-0.5 text-sm font-semibold text-slate-800">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="#enquire" className="btn-primary">
                  Request a Quotation
                </Link>
                <a href={`tel:${company.mobile || company.phone}`} className="btn-outline">
                  <PhoneCall className="h-4 w-4" /> Call {company.mobile || company.phone}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="enquire" className="section bg-slate-50">
        <div className="container-page grid items-start gap-10 lg:grid-cols-2">
          <div>
            <span className="eyebrow">Enquire</span>
            <h2 className="heading-lg">Interested in the {product.title}?</h2>
            <p className="mt-4 text-slate-600">
              Fill in your details and our team will share pricing, lead time and arrange a demonstration.
            </p>
          </div>
          <div className="card p-6 sm:p-8">
            <EnquiryForm compact />
          </div>
        </div>
      </section>
    </>
  );
}
