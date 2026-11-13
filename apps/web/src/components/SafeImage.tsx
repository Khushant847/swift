'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * `<img>` with a broken-media fallback, usable from server components.
 *
 * Raw `onError` handlers cannot be passed to elements rendered by a server
 * component (Next.js prerender error), so anything that needs to react to a
 * deleted/failed image goes through this client wrapper instead.
 *
 * Two failure modes are handled:
 *  - the image breaks after hydration → `onError` fires;
 *  - the image is *already* broken when React mounts (a 404 during SSR/first
 *    paint, e.g. media deleted from storage) → the error event has already
 *    fired and will never fire again, so a mount-time check catches it.
 * In both cases the image is dropped and `fallback` shows.
 */
export function SafeImage({
  src,
  alt,
  className,
  fallback = null,
  eager = false,
  priority = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  eager?: boolean;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // A new src is a new resource: clear any failure from the previous URL so
    // the fallback does not stick after a logo/media replacement.
    setFailed(false);
    const el = ref.current;
    // complete + zero naturalWidth === the browser already failed to decode it.
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (!src || failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailed(true)}
    />
  );
}
