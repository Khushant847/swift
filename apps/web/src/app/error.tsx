'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error in the browser console / server logs; never hide it.
    console.error(error);
  }, [error]);

  return (
    <section className="section bg-slate-50">
      <div className="container-page">
        <div className="card mx-auto max-w-xl p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="heading-lg mt-5">We couldn&apos;t load this content</h1>
          <p className="mt-3 text-slate-600">
            The server or database may still be starting. This usually resolves on its own — try again in a
            moment.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={reset} className="btn-primary">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            <Link href="/" className="btn-outline">
              Back to home
            </Link>
          </div>
          {error.digest ? (
            <p className="mt-5 text-xs text-slate-400">Reference: {error.digest}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
