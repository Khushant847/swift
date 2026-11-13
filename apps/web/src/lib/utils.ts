import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Build a public product URL with the slug safely encoded. Slugs are
 * normalized on write, but encoding here keeps legacy/migrated rows (spaces,
 * capitals) and any future imports from producing malformed hrefs.
 */
export function productPath(slug: string): string {
  return `/products/${encodeURIComponent(slug)}`;
}

export function safeParseSpecs(specs?: string | null): { label: string; value: string }[] {
  if (!specs) return [];
  try {
    const parsed = JSON.parse(specs);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export function parseSocialLinks(raw?: string): { label: string; url: string; icon: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isValidPhone(phone: string): boolean {
  return /^[+]?[\d\s\-()]{7,20}$/.test(phone.trim());
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Normalise a stored media URL for rendering on the public site.
 *
 * The backend now saves host-relative URLs (`/uploads/...`), but rows created
 * before the fix contain absolute URLs pointing at the API origin
 * (`http://localhost:4000/uploads/...` or a deployed API host) — those break
 * for visitors because the API origin isn't the site origin. Rewrite any
 * absolute URL whose path starts with /uploads/ to the same path on this
 * origin (the Next rewrite proxies it to the backend), and leave external
 * URLs (CDNs, Google avatars, seed images) untouched.
 */
export function mediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/uploads/')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/uploads/')) return parsed.pathname + parsed.search;
  } catch {
    // Not an absolute URL — pass through as-is.
  }
  return url;
}
