import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { JsonLd } from './JsonLd';
import { breadcrumbSchema } from '@/lib/schema';

export function PageHero({
  title,
  subtitle,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  breadcrumb: { label: string; href?: string }[];
}) {
  return (
    <>
      <JsonLd data={breadcrumbSchema(breadcrumb)} />
      <section className="relative overflow-hidden bg-brand-950 py-16 sm:py-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #2f63f6 0, transparent 45%), radial-gradient(circle at 80% 70%, #f59e0b 0, transparent 40%)' }}
        />
        <div className="container-page relative">
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            {breadcrumb.map((b, i) => (
              <span key={b.label} className="flex items-center gap-1.5">
                {b.href ? (
                  <Link href={b.href} className="hover:text-accent-300">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-slate-200" aria-current={i === breadcrumb.length - 1 ? 'page' : undefined}>
                    {b.label}
                  </span>
                )}
                {i < breadcrumb.length - 1 ? <ChevronRight className="h-3 w-3" /> : null}
              </span>
            ))}
          </nav>
          <h1 className="font-display text-3xl font-bold text-white text-balance sm:text-4xl lg:text-5xl">{title}</h1>
          {subtitle ? <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">{subtitle}</p> : null}
        </div>
      </section>
    </>
  );
}
