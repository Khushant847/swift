import { useState } from 'react';
import { ImageIcon, Monitor, Play, Smartphone } from 'lucide-react';
import { cn } from '../lib/utils';
import type { MediaKind, MediaPreset } from '../lib/mediaPresets';

function PreviewMedia({
  src,
  kind,
  fit,
  className,
}: {
  src?: string | null;
  kind: MediaKind;
  fit: 'cover' | 'contain';
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900 text-white/25',
          className,
        )}
      >
        <ImageIcon className="h-8 w-8" />
      </div>
    );
  }

  const fitClass = fit === 'contain' ? 'object-contain' : 'object-cover';

  if (kind === 'video') {
    return (
      <video
        src={src}
        className={cn('h-full w-full', fitClass, className)}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
      />
    );
  }

  return <img src={src} alt="Media preview" className={cn('h-full w-full', fitClass, className)} />;
}

function LogoSample({ src, kind }: { src?: string | null; kind: MediaKind }) {
  if (!src) {
    return <span className="inline-block h-7 w-16 rounded bg-slate-200" />;
  }
  if (kind === 'video') {
    return <span className="inline-block h-7 w-16 rounded bg-slate-700 text-[9px] text-white/60">video</span>;
  }
  return <img src={src} alt="Logo preview" className="max-h-8 w-auto max-w-[110px] object-contain" />;
}

function Lines({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="h-2 w-4/5 rounded bg-slate-200" />
      <div className="h-2 w-3/5 rounded bg-slate-100" />
      <div className="h-2 w-2/3 rounded bg-slate-100" />
    </div>
  );
}

function Scene({
  preset,
  src,
  kind,
  device,
}: {
  preset: MediaPreset;
  src?: string | null;
  kind: MediaKind;
  device: 'desktop' | 'mobile';
}) {
  const mobile = device === 'mobile';

  switch (preset.preview) {
    case 'hero':
      return (
        <div className={cn('relative w-full overflow-hidden bg-brand-950', mobile ? 'aspect-[10/14]' : 'aspect-video')}>
          <PreviewMedia src={src} kind={kind} fit="cover" className="absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950/95 via-brand-950/55 to-brand-950/5" />
          <div className={cn('absolute inset-0 flex flex-col justify-center', mobile ? 'px-4' : 'px-8')}>
            <span className="mb-2.5 h-2 w-14 rounded-full bg-accent-400/80" />
            <span className={cn('rounded bg-white/90', mobile ? 'h-3 w-11/12' : 'h-4 w-4/5')} />
            <span className={cn('mt-1.5 rounded bg-white/90', mobile ? 'h-3 w-3/4' : 'h-4 w-3/5')} />
            <span className="mt-3 h-2 w-2/3 rounded bg-white/40" />
            <span className={cn('mt-4 rounded bg-accent-500', mobile ? 'h-5 w-20' : 'h-6 w-24')} />
          </div>
          <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            <span className="h-1.5 w-6 rounded-full bg-accent-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
          </div>
        </div>
      );

    case 'product':
      return (
        <div className="bg-slate-50 p-3 sm:p-4">
          <div className={cn('grid gap-3', mobile ? 'grid-cols-1' : 'grid-cols-[1.15fr_1fr]')}>
            <figure>
              <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white">
                <PreviewMedia src={src} kind={kind} fit="cover" />
              </div>
              <figcaption className="mt-1.5 text-center text-[10px] font-medium text-slate-400">
                Detail page · 1:1
              </figcaption>
            </figure>
            <figure className="self-start">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="relative aspect-[4/3] bg-slate-100">
                  <PreviewMedia src={src} kind={kind} fit="cover" />
                </div>
                <div className="space-y-1.5 p-2.5">
                  <div className="h-2 w-3/4 rounded bg-slate-300" />
                  <div className="h-1.5 w-1/2 rounded bg-slate-200" />
                  <div className="h-1.5 w-2/3 rounded bg-slate-100" />
                </div>
              </div>
              <figcaption className="mt-1.5 text-center text-[10px] font-medium text-slate-400">
                Product card · 4:3
              </figcaption>
            </figure>
          </div>
        </div>
      );

    case 'upcoming':
      return (
        <div className="bg-brand-950 p-3 sm:p-4">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="relative aspect-[16/10] bg-brand-900">
              <PreviewMedia src={src} kind={kind} fit="cover" className="opacity-80" />
              <span className="absolute right-2.5 top-2.5 rounded-full bg-accent-500 px-2 py-0.5 text-[9px] font-bold text-brand-950">
                Coming soon
              </span>
            </div>
            <div className="space-y-1.5 p-3">
              <div className="h-2.5 w-2/3 rounded bg-white/60" />
              <div className="h-2 w-full rounded bg-white/20" />
              <div className="h-2 w-4/5 rounded bg-white/20" />
            </div>
          </div>
        </div>
      );

    case 'gallery':
      return (
        <div className="bg-white p-2.5 sm:p-3">
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                <PreviewMedia src={src} kind={kind} fit="cover" />
                {kind === 'video' && index === 0 ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-brand-900">
                      <Play className="h-3 w-3 translate-x-0.5" />
                    </span>
                  </span>
                ) : null}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-[8px] font-semibold text-white">
                  Gallery
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
            Square thumbnails · lightbox keeps the native ratio
          </p>
        </div>
      );

    case 'founder':
      return (
        <div className="bg-white p-3 sm:p-4">
          <div className={cn('gap-4', mobile ? 'space-y-3' : 'grid grid-cols-[145px_1fr] items-center')}>
            <div>
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
                <PreviewMedia src={src} kind={kind} fit="cover" />
              </div>
              <div className="mx-2 -mt-3 rounded-lg border border-slate-100 bg-white p-2 shadow-sm">
                <div className="h-2 w-2/3 rounded bg-slate-300" />
                <div className="mt-1 h-1.5 w-1/2 rounded bg-slate-200" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-2.5 w-2/3 rounded bg-slate-300" />
              <Lines />
              <div className="h-12 rounded-lg border-l-4 border-accent-400 bg-slate-50" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 rounded bg-slate-100" />
                <div className="h-8 rounded bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      );

    case 'logo':
      return (
        <div className="bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <LogoSample src={src} kind={kind} />
              <div className="min-w-0">
                <div className="h-2 w-20 rounded bg-slate-300" />
                <div className="mt-1 h-1.5 w-14 rounded bg-slate-100" />
              </div>
            </div>
            {!mobile ? (
              <div className="hidden items-center gap-2 sm:flex">
                <div className="h-1.5 w-7 rounded bg-slate-200" />
                <div className="h-1.5 w-8 rounded bg-slate-200" />
                <div className="h-1.5 w-6 rounded bg-slate-200" />
              </div>
            ) : null}
            <span className="h-6 w-14 shrink-0 rounded bg-brand-800" />
          </div>
          <div className="flex items-center gap-3 bg-brand-950 px-3 py-3">
            <span className="flex h-9 w-24 items-center justify-center rounded-lg bg-white/10 p-1">
              <LogoSample src={src} kind={kind} />
            </span>
            <div className="flex-1 space-y-1.5">
              <div className="h-1.5 w-2/3 rounded bg-white/30" />
              <div className="h-1.5 w-1/2 rounded bg-white/15" />
            </div>
          </div>
          <p className="px-3 py-2 text-center text-[10px] font-medium text-slate-400">
            Header + footer · object-contain, never cropped
          </p>
        </div>
      );

    default:
      return (
        <div className="bg-slate-900 p-3">
          <div className="aspect-video overflow-hidden rounded-lg bg-slate-800">
            <PreviewMedia src={src} kind={kind} fit="cover" />
          </div>
          <p className="mt-2 text-center text-[10px] font-medium text-slate-400">Generic media preview</p>
        </div>
      );
  }
}

/**
 * Desktop/mobile mock of how the media appears on the public site, including
 * the real object-fit behaviour of that slot.
 */
export function MediaPreview({
  preset,
  src,
  kind,
}: {
  preset: MediaPreset;
  src?: string | null;
  kind: MediaKind;
}) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">Website preview</p>
        <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200" role="group" aria-label="Preview device">
          <button
            type="button"
            onClick={() => setDevice('desktop')}
            aria-pressed={device === 'desktop'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
              device === 'desktop' ? 'bg-brand-800 text-white' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Monitor className="h-3.5 w-3.5" /> Desktop
          </button>
          <button
            type="button"
            onClick={() => setDevice('mobile')}
            aria-pressed={device === 'mobile'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
              device === 'mobile' ? 'bg-brand-800 text-white' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Smartphone className="h-3.5 w-3.5" /> Mobile
          </button>
        </div>
      </div>

      {device === 'mobile' ? (
        <div className="mx-auto w-full max-w-[240px] rounded-[2rem] border-[6px] border-slate-800 bg-slate-800 shadow-lg">
          <div className="flex justify-center py-1">
            <span className="h-1 w-10 rounded-full bg-slate-600" />
          </div>
          <div className="overflow-hidden rounded-[1.35rem] bg-white">
            <Scene preset={preset} src={src} kind={kind} device={device} />
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[580px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          </div>
          <Scene preset={preset} src={src} kind={kind} device={device} />
        </div>
      )}

      <p className="mt-2 text-center text-[11px] text-slate-400">
        Approximate on-page framing. Real screens vary with viewport width.
      </p>
    </div>
  );
}
