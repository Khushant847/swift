/** @type {import('next').NextConfig} */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
// Server-side backend origin. On Vercel services, BACKEND_URL is injected by
// the `web` → `backend` binding at runtime; API_URL remains the override for
// standalone deployments.
const serverApiUrl = (process.env.BACKEND_URL || process.env.API_URL || apiUrl).replace(/\/+$/, '');
const apiHost = (() => {
  try {
    return new URL(serverApiUrl);
  } catch {
    return new URL('http://localhost:4000');
  }
})();

const isVercel = Boolean(process.env.VERCEL);
const vercelEnv = process.env.VERCEL_ENV || '';

if (
  isVercel &&
  !process.env.BACKEND_URL &&
  !process.env.API_URL &&
  !process.env.NEXT_PUBLIC_API_URL
) {
  // Expected during `next build` in services mode: service bindings resolve in
  // functions at runtime, not during builds. Data routes fall back to on-demand
  // rendering, then read BACKEND_URL when a request arrives.
  console.warn(
    '[vercel] BACKEND_URL/API_URL are not set for this build. Server-side API calls will use http://localhost:4000 during the build and those routes will render on demand; BACKEND_URL is read at runtime.',
  );
}
if (isVercel && vercelEnv === 'production' && !process.env.NEXT_PUBLIC_SITE_URL) {
  console.warn(
    '[vercel] NEXT_PUBLIC_SITE_URL is not set. Canonicals, sitemap and robots will use the Vercel production URL instead of your custom domain.',
  );
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' ${apiUrl} https:`,
  "frame-src 'self' https://www.google.com https://maps.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, '../../'),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'commondatastorage.googleapis.com' },
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: apiHost.protocol.replace(':', ''), hostname: apiHost.hostname, port: apiHost.port || '' },
    ],
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: false,
  },
  async rewrites() {
    return [
      // The footer's "Sitemap" link points at /sitemap; Next.js reserves
      // sitemap.ts for the /sitemap.xml metadata route, so the human-readable
      // page lives at /sitemap-page and is rewritten to the linked URL.
      { source: '/sitemap', destination: '/sitemap-page' },
      // Same-origin API proxy: client components (e.g. the enquiry form) call
      // /api/v1/... on this host and Next forwards to the backend, so
      // production never needs a NEXT_PUBLIC_API_URL pointing at localhost.
      { source: '/api/:path*', destination: `${serverApiUrl}/api/:path*` },
      // Media proxy: the DB stores host-relative /uploads/... URLs (see
      // backend storage.ts), so the site (and its CSP img-src 'self') can load
      // uploaded images/videos from this same origin in every environment.
      { source: '/uploads/:path*', destination: `${serverApiUrl}/uploads/:path*` },
    ];
  },
  async headers() {
    const headers = [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];

    // Vercel preview URLs are public too. Keep them out of search results so
    // they never compete with the production domain.
    if (isVercel && vercelEnv !== 'production') {
      headers.push({
        source: '/(.*)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      });
    }

    return headers;
  },
};

export default nextConfig;
