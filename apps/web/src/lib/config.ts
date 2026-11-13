/**
 * Client-safe configuration.
 *
 * Only `NEXT_PUBLIC_*` variables are inlined by Next.js into the browser
 * bundle — server-only vars such as `API_URL` are `undefined` client-side,
 * so anything read by a client component must be defined here (importing
 * `lib/api` from a client component would otherwise silently fall back to a
 * localhost URL in production).
 *
 * Empty string = same-origin: the browser calls `/api/v1/...` on this site
 * and `next.config.mjs` proxies those paths to the backend (see `rewrites()`).
 * Set `NEXT_PUBLIC_API_URL` to have the browser talk to the API directly on
 * another origin instead (then that origin must be listed in the backend's
 * `CORS_ORIGINS`).
 */
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || '';
