const BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: string;
  details?: unknown;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: isForm ? undefined : body ? { 'Content-Type': 'application/json' } : undefined,
    body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  let json: Envelope<T> | null = null;
  const text = await res.text();
  try {
    json = text ? (JSON.parse(text) as Envelope<T>) : null;
  } catch {
    json = null;
  }

  if (!res.ok || !json?.success) {
    // A 401 anywhere means the session cookie is gone/expired — broadcast so
    // the auth provider can reset the app instead of leaving dead UI around.
    if (res.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('swift:unauthorized'));
    }
    throw new ApiError(res.status, json?.error || `Request failed (${res.status})`, json?.details);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
};

export const API_ORIGIN = import.meta.env.VITE_API_URL || '';

/**
 * Resolve a stored media URL for display inside the admin SPA.
 *
 * The DB stores host-relative `/uploads/...` URLs. In dev the Vite proxy
 * serves them from this origin, so they work as-is (API_ORIGIN is empty). If
 * the SPA is deployed cross-origin (VITE_API_URL set), prefix the API origin
 * so previews don't 404 against the static host. Absolute URLs (legacy rows,
 * external CDNs) pass through untouched.
 */
export function mediaSrc(url?: string | null): string {
  if (!url) return '';
  if (API_ORIGIN && url.startsWith('/')) return `${API_ORIGIN}${url}`;
  return url;
}

/** Build a query string from a record, skipping empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

/** Trigger a file download from an authenticated endpoint. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) throw new ApiError(res.status, 'Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
