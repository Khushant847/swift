'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, WifiOff } from 'lucide-react';

const POLL_INTERVAL_MS = 5_000;
const PROBE_TIMEOUT_MS = 4_000;

/**
 * Detects a backend that is starting (or momentarily down) and recovers the
 * page without a manual hard reload.
 *
 * Server components render immediately with fallback data while the API boots.
 * If the readiness probe fails, this shows a small status banner and polls
 * `/api/health` (proxied by Next to the API's `/health/ready`). Once the API is
 * ready it calls `router.refresh()`, which re-runs the server components and
 * replaces the fallback content with the real data.
 */
export function ApiStatusWatcher() {
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOffline = useRef(false);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/health', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      const body = res.ok ? await res.json().catch(() => null) : null;
      const ready = res.ok && body?.status === 'ok';

      if (!mounted.current) return;

      if (ready) {
        setOffline(false);
        // Only refresh when we actually recovered from a failure — otherwise
        // this would re-render the page on every initial mount.
        if (wasOffline.current) {
          wasOffline.current = false;
          router.refresh();
        }
      } else {
        wasOffline.current = true;
        setOffline(true);
        clearTimer();
        timer.current = setTimeout(() => void check(), POLL_INTERVAL_MS);
      }
    } catch {
      if (!mounted.current) return;
      wasOffline.current = true;
      setOffline(true);
      clearTimer();
      timer.current = setTimeout(() => void check(), POLL_INTERVAL_MS);
    }
  }, [router]);

  useEffect(() => {
    mounted.current = true;
    void check();
    return () => {
      mounted.current = false;
      clearTimer();
    };
  }, [check]);

  const retryNow = async () => {
    setChecking(true);
    clearTimer();
    await check();
    if (mounted.current) setChecking(false);
  };

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-20 z-50 flex items-center gap-3 rounded-xl border border-amber-200 bg-white/95 p-3 text-sm text-slate-700 shadow-soft backdrop-blur sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2"
    >
      <WifiOff className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      <p className="min-w-0 flex-1 sm:flex-none">
        <span className="font-semibold text-slate-900">Reconnecting to the server…</span>{' '}
        <span className="text-slate-600">Content will refresh automatically.</span>
      </p>
      <button
        type="button"
        onClick={() => void retryNow()}
        disabled={checking}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-brand-800 transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
      >
        <RefreshCw className={checking ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
        {checking ? 'Checking…' : 'Retry now'}
      </button>
    </div>
  );
}
