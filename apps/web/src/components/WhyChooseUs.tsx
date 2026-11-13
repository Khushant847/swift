import { getIcon } from './icons';
import type { WhyItem } from '@/lib/types';
import { SectionHeading } from './SectionHeading';

export function WhyChooseUs({ items }: { items: WhyItem[] }) {
  if (!items.length) return null;
  return (
    <section className="section bg-white">
      <div className="container-page">
        <SectionHeading
          eyebrow="Why Choose Us"
          title="Engineered for accuracy. Built to last."
          description="Three decades of metrology expertise, delivered through instruments and services you can rely on."
        />
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => {
            const Icon = getIcon(item.icon);
            return (
              <article
                key={item.id}
                className="group card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-soft"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-800 transition-colors group-hover:bg-brand-800 group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="font-display text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
