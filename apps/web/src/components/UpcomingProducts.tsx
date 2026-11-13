import { CalendarClock, Rocket } from 'lucide-react';
import type { UpcomingProduct } from '@/lib/types';
import { mediaUrl } from '@/lib/utils';
import { SafeImage } from './SafeImage';
import { SectionHeading } from './SectionHeading';

export function UpcomingProducts({ items }: { items: UpcomingProduct[] }) {
  if (!items.length) return null;
  return (
    <section className="section bg-brand-950 text-white">
      <div className="container-page">
        <SectionHeading
          light
          eyebrow="In Development"
          title="Upcoming products from our R&D lab"
          description="A preview of the next generation of Swift Instruments measurement technology."
        />
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-accent-400/40"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-brand-900">
                <SafeImage
                  src={mediaUrl(item.imageUrl)}
                  alt={item.title}
                  className="h-full w-full object-cover object-center opacity-80 transition-transform duration-500 group-hover:scale-105"
                  fallback={
                    <div className="flex h-full items-center justify-center text-white/20">
                      <Rocket className="h-10 w-10" />
                    </div>
                  }
                />
                <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-3 py-1 text-[11px] font-bold text-brand-950">
                  <CalendarClock className="h-3.5 w-3.5" /> {item.expectedLaunch}
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-display text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.teaserDesc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
