import { unstable_noStore as noStore } from 'next/cache';
import type {
  Banner,
  CompanyInfo,
  GalleryItem,
  NavLink,
  Product,
  ProductsResponse,
  PublicSettings,
  Review,
  ReviewsResponse,
  UpcomingProduct,
  WhyItem,
} from './types';

// Server-side API origin (Node fetch needs an absolute URL).
const API_URL = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(
  /\/+$/,
  '',
);
const REVALIDATE_RAW = Number(process.env.NEXT_PUBLIC_REVALIDATE || 60);
const REVALIDATE = Number.isFinite(REVALIDATE_RAW) && REVALIDATE_RAW >= 0 ? REVALIDATE_RAW : 60;
// Branding/contact details change rarely but must propagate quickly after an
// admin edit — a shorter window keeps the header and footer logo in sync
// without requiring a redeploy or a cross-app webhook.
const COMPANY_REVALIDATE_RAW = Number(process.env.NEXT_PUBLIC_COMPANY_REVALIDATE || 15);
const COMPANY_REVALIDATE =
  Number.isFinite(COMPANY_REVALIDATE_RAW) && COMPANY_REVALIDATE_RAW >= 0 ? COMPANY_REVALIDATE_RAW : 15;

/** True only during `next build` — used to suppress noisy "backend offline" logs. */
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Build-only failure memo, keyed by endpoint path (query string stripped).
 *
 * Next renders every segment (layout, page, generateMetadata) separately, so a
 * single dead endpoint is requested a dozen times during `next build`. Once a
 * path has failed we stop retrying it for the rest of the build: the route is
 * already marked dynamic, and re-hitting a known-offline backend only adds
 * seconds of timeouts and duplicate log lines.
 *
 * Never used at runtime — a transient outage must not poison a running server.
 */
const buildFailures = new Map<string, string>();
let buildModeNoticeLogged = false;

const pathKey = (path: string) => path.split('?')[0];

const TIMEOUT_RAW = Number(process.env.API_FETCH_TIMEOUT_MS || 5_000);
const FETCH_TIMEOUT = Number.isFinite(TIMEOUT_RAW) && TIMEOUT_RAW > 0 ? TIMEOUT_RAW : 5_000;
// Builds should not stall waiting for a backend that is intentionally absent;
// runtime/dev gets more attempts so a slow `tsx watch`/DB start is absorbed.
const MAX_ATTEMPTS = IS_BUILD ? 2 : 4;
const RETRY_DELAYS = [300, 800, 1_500];
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

class ApiFetchError extends Error {
  constructor(
    message: string,
    readonly path: string,
    readonly status?: number,
    readonly attempts?: number,
  ) {
    super(message);
    this.name = 'ApiFetchError';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function errorDetail(err: unknown): string {
  if (err instanceof ApiFetchError) {
    return `${err.message}${err.attempts ? ` after ${err.attempts} attempt(s)` : ''}`;
  }
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return `request timed out after ${FETCH_TIMEOUT}ms`;
    }
    return err.message;
  }
  return String(err);
}

/**
 * Fetch an API endpoint with a per-attempt timeout and a bounded, exponentially
 * spaced retry for transient failures (connection refused while the backend is
 * starting, 5xx, 408/429). Non-retryable responses are returned to the caller so
 * it can distinguish a real 404 from a transport failure.
 */
async function fetchApi(
  path: string,
  opts: { tags?: string[]; revalidate?: number } = {},
): Promise<Response> {
  const url = `${API_URL}/api/v1${path}`;
  const revalidate = opts.revalidate ?? REVALIDATE;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
        next: { revalidate, tags: opts.tags },
      });

      if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt === MAX_ATTEMPTS) {
        return res;
      }

      lastError = new ApiFetchError(`HTTP ${res.status}`, path, res.status, attempt);
      // Release the retried response body before the next attempt.
      void res.body?.cancel().catch(() => {});
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS) break;
    }

    await sleep(RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)]);
  }

  throw new ApiFetchError(errorDetail(lastError), path, undefined, MAX_ATTEMPTS);
}

/**
 * Called when a request has definitively failed.
 *
 * At build time we deliberately opt the route out of static generation: an
 * empty fallback snapshot must never be cached and served as if it were real
 * content. Throwing Next's DynamicServerError here (via `noStore`) makes the
 * route server-render on demand, so the first request after the backend is
 * available shows live data.
 */
function onDefinitiveFailure(path: string, err: unknown, kind: 'log-only' | 'throw' = 'log-only'): void {
  const detail = errorDetail(err);

  if (IS_BUILD) {
    // noStore() throws Next's DynamicServerError: the route opts out of static
    // generation, so an empty build-time snapshot is never cached and served as
    // if it were real content. The first request after the API is available
    // renders live data.
    const key = pathKey(path);
    if (!buildFailures.has(key)) {
      buildFailures.set(key, detail);
      if (!buildModeNoticeLogged) {
        buildModeNoticeLogged = true;
        console.warn(
          '[api] API unreachable during this build. Data-driven routes will render on demand (no empty HTML is cached). Start the API before building to get static pages.',
        );
      }
      console.warn(`[api]   ${key} — ${detail}`);
    }
    noStore();
    return;
  }

  console.error(`[api] GET ${path} failed: ${detail}`);
  if (kind === 'throw') throw err;
}

async function fetchJson<T>(
  path: string,
  fallback: T,
  tags?: string[],
  revalidate?: number,
): Promise<T> {
  // Already known to be unreachable during this build — skip the retry loop.
  if (IS_BUILD && buildFailures.has(pathKey(path))) {
    noStore();
    return fallback;
  }
  try {
    const res = await fetchApi(path, { tags, revalidate });
    if (!res.ok) {
      onDefinitiveFailure(path, new ApiFetchError(`HTTP ${res.status}`, path, res.status));
      return fallback;
    }
    const json = (await res.json()) as ApiEnvelope<T>;
    if (!json.success) {
      onDefinitiveFailure(path, new ApiFetchError(json.error || 'API returned success=false', path));
      return fallback;
    }
    return json.data;
  } catch (err) {
    onDefinitiveFailure(path, err);
    return fallback;
  }
}

/**
 * Product detail fetch.
 *
 * - 404 → null (renders notFound).
 * - Transport/server failure at runtime → throws so Next renders the error
 *   boundary with a retry action instead of a soft-404 that search engines
 *   could index.
 * - Transport failure at build → route is marked dynamic (see
 *   `onDefinitiveFailure`) and returns null so the build completes.
 */
export async function getProduct(slug: string): Promise<Product | null> {
  // Next can hand dynamic route params back in their percent-encoded form
  // (`Digital%20Heating%20Incubator`). Decode once before re-encoding so the
  // backend receives the real slug instead of a double-encoded one.
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // Malformed escape sequence — keep the original value.
  }
  const path = `/products/${encodeURIComponent(decoded)}`;
  if (IS_BUILD && buildFailures.has(pathKey(path))) {
    noStore();
    return null;
  }
  try {
    const res = await fetchApi(path, { tags: ['products'] });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new ApiFetchError(`HTTP ${res.status}`, path, res.status);
    }
    const json = (await res.json()) as ApiEnvelope<Product | null>;
    return json.success ? json.data : null;
  } catch (err) {
    onDefinitiveFailure(path, err, 'throw');
    return null;
  }
}

export const getNav = () => fetchJson<NavLink[]>('/nav', [], ['nav']);
export const getBanners = () => fetchJson<Banner[]>('/banners', [], ['banners']);
export const getWhyChooseUs = () => fetchJson<WhyItem[]>('/why-choose-us', [], ['why']);
export const getProducts = (page = 1, limit = 50) =>
  fetchJson<ProductsResponse>(`/products?page=${page}&limit=${limit}`, { items: [], total: 0, page: 1, pageSize: 0 }, ['products']);
export const getFeaturedProducts = (limit = 6) =>
  fetchJson<ProductsResponse>(`/products?featured=true&limit=${limit}`, { items: [], total: 0, page: 1, pageSize: 0 }, ['products']);
export const getCompanyInfo = () =>
  fetchJson<CompanyInfo>('/company-info', {}, ['company'], COMPANY_REVALIDATE);
export const getUpcoming = () => fetchJson<UpcomingProduct[]>('/upcoming', [], ['upcoming']);
export const getGallery = () => fetchJson<GalleryItem[]>('/gallery', [], ['gallery']);
export const getGalleryTags = () => fetchJson<string[]>('/gallery/tags', [], ['gallery']);
export const getReviews = () => fetchJson<ReviewsResponse>('/reviews', { items: [], average: 0, count: 0 }, ['reviews']);
export const getPublicSettings = () => fetchJson<PublicSettings>('/settings', {}, ['settings']);
