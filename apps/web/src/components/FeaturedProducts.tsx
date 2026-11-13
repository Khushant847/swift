import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Product } from '@/lib/types';
import { mediaUrl, productPath } from '@/lib/utils';
import { SafeImage } from './SafeImage';
import { SectionHeading } from './SectionHeading';

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group card flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-soft">
      <Link href={productPath(product.slug)} className="relative block aspect-[4/3] overflow-hidden bg-slate-100">
        <SafeImage
          src={mediaUrl(product.imageUrl)}
          alt={product.title}
          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          fallback={
            <div className="flex h-full items-center justify-center text-slate-300">Swift Instruments</div>
          }
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-brand-800 shadow-sm backdrop-blur">
          {product.category}
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-base font-semibold text-slate-900">
          <Link href={productPath(product.slug)} className="hover:text-brand-800">
            {product.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm text-slate-600">{product.shortDesc}</p>
        <Link
          href={productPath(product.slug)}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-800 hover:gap-2.5 transition-all"
        >
          View details <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

export function FeaturedProducts({ products }: { products: Product[] }) {
  if (!products.length) return null;
  return (
    <section className="section bg-slate-50">
      <div className="container-page">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            align="left"
            eyebrow="Products & Services"
            title="Featured instruments"
            description="A curated selection of our most trusted weighing and laboratory solutions."
          />
          <Link href="/products" className="btn-outline whitespace-nowrap">
            View All Products & Services <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
