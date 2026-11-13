'use client';

import { useMemo, useState } from 'react';
import { Play, X } from 'lucide-react';
import type { GalleryItem } from '@/lib/types';
import { cn, mediaUrl } from '@/lib/utils';
import { SafeImage } from './SafeImage';
import { SectionHeading } from './SectionHeading';

export function GalleryGrid({ items, tags, compact = false }: { items: GalleryItem[]; tags: string[]; compact?: boolean }) {
  const [active, setActive] = useState('All');
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);

  const allTags = useMemo(() => ['All', ...tags], [tags]);
  const filtered = active === 'All' ? items : items.filter((i) => i.categoryTag === active);
  const shown = compact ? filtered.slice(0, 6) : filtered;

  if (!items.length) return null;

  return (
    <section className={cn(compact ? 'section bg-white' : 'pt-10 pb-20 bg-white')}>
      <div className="container-page">
        <SectionHeading
          eyebrow="Internal Gallery"
          title="Inside Swift Instruments"
          description="A look at our laboratories, manufacturing floor, office and team."
        />
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActive(t)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition',
                active === t ? 'bg-brand-800 text-white shadow-soft' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLightbox(item)}
              className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-100 text-left"
            >
              {item.mediaType === 'video' ? (
                <>
                  <video
                    src={mediaUrl(item.mediaUrl)}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-brand-900">
                      <Play className="h-5 w-5 translate-x-0.5" />
                    </span>
                  </span>
                </>
              ) : (
                <SafeImage
                  src={mediaUrl(item.mediaUrl)}
                  alt={item.caption || 'Swift Instruments gallery'}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <span className="block text-xs font-semibold text-white">{item.caption || item.categoryTag}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
            onClick={() => setLightbox(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <div className="max-h-[85vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {lightbox.mediaType === 'video' ? (
              <video src={mediaUrl(lightbox.mediaUrl)} className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain" controls autoPlay />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(lightbox.mediaUrl)} alt={lightbox.caption || ''} className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain" />
            )}
            {lightbox.caption ? (
              <p className="mt-3 text-center text-sm text-slate-300">{lightbox.caption}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
