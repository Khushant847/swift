'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { Banner } from '@/lib/types';
import { cn, mediaUrl } from '@/lib/utils';
import { SafeImage } from './SafeImage';

// One video element per video slide: playback must follow the slide's active
// state (autoplay alone only runs on mount).
function HeroVideo({ src, active }: { src: string; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Broken/missing file: hide the video so the branded slide background and
    // copy stay visible instead of a black broken-media box. Handles the case
    // where the error fired before hydration (networkState NO_SOURCE).
    if (v.error || v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
      setFailed(true);
      return;
    }
    const onError = () => setFailed(true);
    v.addEventListener('error', onError);
    if (active) void v.play().catch(() => {});
    else v.pause();
    return () => v.removeEventListener('error', onError);
  }, [active, src]);

  if (failed) return null;

  return (
    <video
      ref={ref}
      className="h-full w-full object-cover object-center"
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
    />
  );
}

export function HeroCarousel({ banners, certifications }: { banners: Banner[]; certifications?: string }) {
  const isoCertification = useMemo(() => {
    try {
      const parsed = JSON.parse(certifications || '[]');
      return Array.isArray(parsed)
        ? parsed.find((c): c is string => typeof c === 'string' && /iso\s*9001/i.test(c))
        : undefined;
    } catch {
      return undefined;
    }
  }, [certifications]);

  const slides = useMemo(
    () =>
      banners.length
        ? banners
        : [
            {
              id: 'fallback',
              title: 'Precision Weighing Instruments',
              subtitle: 'Trusted measurement solutions engineered for laboratories and industry.',
              ctaLabel: 'Explore Products',
              ctaUrl: '/products',
              mediaUrl: '',
              mediaType: 'image' as const,
              intervalSeconds: 5000,
              displayOrder: 0,
            },
          ],
    [banners],
  );

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback(
    (next: number) => setIndex((next + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (!playing || slides.length <= 1) return;
    const current = slides[index];
    const delay = Math.max(current.intervalSeconds || 5000, 2000);
    timer.current = setTimeout(() => go(index + 1), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [index, playing, slides, go]);

  const current = slides[index];

  return (
    <section
      className="relative isolate h-[68vh] min-h-[420px] w-full overflow-hidden bg-brand-950 sm:h-[75vh] lg:h-[86vh]"
      aria-roledescription="carousel"
      aria-label="Featured highlights"
    >
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.id}
            className={cn(
              'gpu absolute inset-0 transition-opacity duration-700 ease-out',
              active ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0',
            )}
            aria-hidden={!active}
          >
            <div className="absolute inset-0 bg-brand-950" />
            {slide.mediaType === 'video' ? (
              <HeroVideo src={mediaUrl(slide.mediaUrl) || ''} active={active} />
            ) : (
              <SafeImage
                src={mediaUrl(slide.mediaUrl)}
                alt={slide.title || 'Swift Instruments'}
                className={cn('h-full w-full object-cover object-center', active && 'animate-ken-burns')}
                eager={i === 0}
                priority={i === 0}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-brand-950/90 via-brand-950/70 to-brand-900/30" />
          </div>
        );
      })}

      {/* Copy */}
      <div className="relative z-20 flex h-full items-center">
        <div className="container-page">
          <div key={current.id} className="max-w-2xl animate-fade-up">
            {isoCertification ? (
              <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-500/20 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent-300 ring-1 ring-accent-400/30">
                {isoCertification} Certified Manufacturer
              </span>
            ) : null}
            <h1 className="font-display text-3xl font-bold leading-tight text-white text-balance sm:text-4xl lg:text-6xl">
              {current.title}
            </h1>
            {current.subtitle ? (
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
                {current.subtitle}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {current.ctaUrl ? (
                <Link href={current.ctaUrl} className="btn-accent px-6 py-3 text-base">
                  {current.ctaLabel || 'Learn more'}
                </Link>
              ) : null}
              <Link
                href="/contact"
                className="btn border border-white/30 bg-white/5 px-6 py-3 text-base text-white backdrop-blur hover:bg-white/10"
              >
                Request a Quote
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      {slides.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/20 lg:left-6"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/20 lg:right-6"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20"
              aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    i === index ? 'w-8 bg-accent-400' : 'w-2 bg-white/50 hover:bg-white/80',
                  )}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
