'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Quote, Star } from 'lucide-react';
import type { ReviewsResponse } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SectionHeading } from './SectionHeading';

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-0.5', className)} aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn('h-4 w-4', i < rating ? 'fill-accent-400 text-accent-400' : 'text-slate-300')}
        />
      ))}
    </div>
  );
}

export function Reviews({ reviews }: { reviews: ReviewsResponse }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const items = reviews.items;

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length, paused]);

  if (!items.length) return null;
  const go = (n: number) => setIndex((n + items.length) % items.length);

  return (
    <section className="section bg-slate-50">
      <div className="container-page">
        <SectionHeading
          eyebrow="Reviews & Ratings"
          title="What our customers say"
          description={
            reviews.count
              ? `Rated ${reviews.average} / 5 from ${reviews.count} customer reviews.`
              : 'Trusted by laboratories and industries across India.'
          }
        />

        <div className="relative mx-auto mt-12 max-w-3xl">
          <div className="card relative overflow-hidden p-8 sm:p-12">
            <Quote className="absolute right-6 top-6 h-16 w-16 text-brand-50" />
            <div className="relative" aria-live="off">
              <Stars rating={items[index].rating} className="mb-4" />
              <blockquote className="font-display text-lg font-medium leading-relaxed text-slate-800 sm:text-xl">
                “{items[index].text}”
              </blockquote>
              <footer className="mt-6 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-800 font-semibold text-white">
                  {items[index].authorName.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{items[index].authorName}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {items[index].source === 'google' ? 'Google Review' : 'Customer review'}
                  </p>
                </div>
              </footer>
            </div>
          </div>

          {items.length > 1 ? (
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => go(index - 1)}
                className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 hover:border-brand-300 hover:text-brand-800"
                aria-label="Previous review"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                {items.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Review ${i + 1}`}
                    className={cn('h-2 rounded-full transition-all', i === index ? 'w-6 bg-brand-800' : 'w-2 bg-slate-300')}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => go(index + 1)}
                className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 hover:border-brand-300 hover:text-brand-800"
                aria-label="Next review"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="rounded-full border border-slate-200 bg-white p-2.5 text-slate-600 hover:border-brand-300 hover:text-brand-800"
                aria-label={paused ? 'Play reviews' : 'Pause reviews'}
              >
                {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
