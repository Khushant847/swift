# ENVIRONMENT VARIABLES — Swift Instruments

**Audit date:** 13 Nov 2026
**Method:** Read-only inspection of `.env.example` files and a key-name/state scanner over local `.env` files. **No secret values are reproduced in this report** — only key names, whether they are set, and a non-sensitive classification (e.g. URL scheme, enum value, length class).
**Production environment:** **[NOT ACCESSIBLE]** — no Vercel/Railway/Render/VPS dashboard or production `.env` was available.

---

## 1. Environment files present

| File | Present? | Purpose |
|---|---|---|
| `apps/backend/.env` | Yes | API runtime configuration |
| `apps/backend/.env.example` | Yes | Documented template |
| `apps/web/.env` | Yes | Website SSR/ISR + public config |
| `apps/web/.env.example` | Yes | Documented template |
| `apps/admin/.env` | **No** | Optional — dev proxy defaults apply |
| `apps/admin/.env.example` | Yes | Documents `VITE_API_URL` / `VITE_PROXY_TARGET` |
| Root `.env` | No | Not used |

---

## 2. Backend variables (`apps/backend`)

State legend: **SET** = non-empty local value (value never printed), **EMPTY** = defined but blank, **MISSING** = not present (defaults apply), **enum** = allowed literal shown.

| Key | Group | Local state | Purpose | Production requirement |
|---|---|---|---|---|
| `NODE_ENV` | Server | `development` | Runtime mode; gates HSTS, morgan, secure cookies, JWT strength check | **Must be `production`** |
| `PORT` | Server | `4000` | API listen port | Set to host-provided port |
| `PUBLIC_BASE_URL` | Server | SET (`http` URL, localhost) | Historically used for absolute media URLs; storage now returns host-relative paths | Set to public HTTPS API origin |
| `DATABASE_URL` | Database | SET (`file:` scheme) | Prisma connection string | **Must be `postgresql://…` (or MySQL if re-targeted)** |
| `JWT_SECRET` | Auth | SET (long random string) | Signs access tokens | **Must be ≥32 chars, unique, stored in secret manager** |
| `JWT_EXPIRES_MINUTES` | Auth | SET | Session lifetime (20) | Keep short (15–30) |
| `COOKIE_NAME` | Auth | SET | Auth cookie name (`swift_at`) | Keep or rename |
| `COOKIE_DOMAIN` | Auth | **EMPTY** | Cookie domain scope | Set when API and site share a parent domain; leave empty for host-only |
| `CORS_ORIGINS` | Security | SET (`http` origins) | Allowed browser origins (web + admin) | **Must list exact production origins (https), no `*`** |
| `STORAGE_DRIVER` | Media | `local` | `local` \| `s3` \| `cloudinary` | Keep `local` only with persistent disk; otherwise S3/Cloudinary |
| `UPLOAD_MAX_MB` | Media | SET (25) | Upload size cap | Match host/body limits |
| `MAIL_DRIVER` | Email | `console` | `console` \| `smtp` | **Must be `smtp` in production** |
| `MAIL_FROM` | Email | SET | From address/name | Verified sender domain |
| `SMTP_HOST` | Email | MISSING | SMTP server | Required if `MAIL_DRIVER=smtp` |
| `SMTP_PORT` | Email | MISSING (default 587) | SMTP port | Set per provider |
| `SMTP_SECURE` | Email | MISSING (default false) | TLS mode | Usually `true` for 465 |
| `SMTP_USER` | Email | MISSING | SMTP username | Required |
| `SMTP_PASS` | Email | MISSING | SMTP password | Required — secret manager only |
| `REDIS_URL` | Scaling | **EMPTY** | Shared rate-limit store for multi-instance | Required if API scales horizontally; empty = in-memory (single instance) |
| `TRUST_PROXY` | Security | MISSING (default 1 in prod) | Number of trusted proxy hops | Must match the actual proxy chain |
| `GOOGLE_MAPS_API_KEY` | Integrations | **EMPTY** | Maps embedding (front end uses iframe; key optional) | Optional |
| `GOOGLE_PLACES_API_KEY` | Integrations | **EMPTY** | Google review sync | Required only if review sync is used |
| `GOOGLE_PLACE_ID` | Integrations | **EMPTY** | Google Business location | Same as above |
| `CAPTCHA_SECRET` | Security | **EMPTY** | Server-side captcha verification | **Recommended for production enquiries** |

### Backend start-up guards (verified)
- Invalid config → process exits with field errors.
- `NODE_ENV=production` + `JWT_SECRET` equal to the dev default **or shorter than 32 chars** → process refuses to boot.
- `TRUST_PROXY` defaults to `1` in production and `0` in dev/test (prevents IP spoofing affecting rate limits/audit).

---

## 3. Web variables (`apps/web`)

| Key | Local state | Purpose | Production requirement |
|---|---|---|---|
| `API_URL` | SET (`http` localhost) | Server-side API origin used by SSR/ISR and the `/api` + `/uploads` rewrites | **Must be the public HTTPS API URL** |
| `NEXT_PUBLIC_API_URL` | **EMPTY** | Browser API origin; empty = same-origin `/api/v1/*` via rewrite | **Recommended empty** (same-origin proxy) |
| `NEXT_PUBLIC_SITE_URL` | SET (`http` localhost) | `metadataBase`, canonical URLs, sitemap, robots, OG | **Must be the final HTTPS domain, no trailing slash** |
| `NEXT_PUBLIC_REVALIDATE` | SET | ISR window for general content (60 s) | 30–300 s depending on publishing cadence |
| `NEXT_PUBLIC_COMPANY_REVALIDATE` | SET | ISR window for logo/contact (15 s) | Keep short |
| `API_FETCH_TIMEOUT_MS` | SET | Server-side fetch timeout (5000 ms) | 5000–10000 ms |

### Web build-time checks (verified)
`next.config.mjs` prints warnings when:
- Deployed on Vercel without `API_URL` / `NEXT_PUBLIC_API_URL` (would silently target localhost).
- `VERCEL_ENV=production` without `NEXT_PUBLIC_SITE_URL`.
- Hosting headers: CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and a Vercel **preview-only** `X-Robots-Tag: noindex, nofollow`.

---

## 4. Admin variables (`apps/admin`)

| Key | Local state | Purpose | Production requirement |
|---|---|---|---|
| `VITE_API_URL` | File absent → empty | API origin for the SPA. Empty = same-origin via Vite/dev proxy | Set to the HTTPS API URL if the SPA is hosted on a different origin; list that SPA origin in backend `CORS_ORIGINS` |
| `VITE_PROXY_TARGET` | File absent → `http://localhost:4000` | Dev-only proxy target | Not used in production build |

> **Important:** Vite inlines `VITE_*` values into the public bundle. Never put secrets in this file.

---

## 5. Variable matrix for the intended production topology

| Variable | Where it must be set |
|---|---|
| `NODE_ENV`, `PORT`, `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGINS`, `MAIL_*`, `SMTP_*` | API host (Railway/Render/Fly/VPS) |
| `PUBLIC_BASE_URL` | API host |
| `TRUST_PROXY`, `REDIS_URL` | API host (if behind proxy / scaled) |
| `CAPTCHA_SECRET` | API host |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACE_ID` | API host (optional) |
| `API_URL`, `NEXT_PUBLIC_SITE_URL`, revalidation/timeout vars | Vercel project (Production + Preview) |
| `NEXT_PUBLIC_API_URL` | Vercel — leave empty for same-origin |
| `VITE_API_URL` | Admin static host build environment |

---

## 6. Secrets hygiene findings

| # | Finding | Severity |
|---|---|---|
| E1 | A real-looking `JWT_SECRET` (96 chars) is stored in plaintext in `apps/backend/.env` on disk | Medium — rotate at cut-over; never copy this file into a repo/zip |
| E2 | No secret-manager integration; all config is file-based | Medium |
| E3 | `MAIL_DRIVER=console` locally — emails are only logged, never delivered | Low locally / **High if it reaches production** |
| E4 | `CAPTCHA_SECRET` empty — public enquiry endpoint has only rate limiting | Medium |
| E5 | Google integration keys empty — review sync and Places features are inert | Low |
| E6 | `REDIS_URL` empty — rate limits are per-process; horizontal scaling weakens them | Medium |
| E7 | `COOKIE_DOMAIN` empty — cookie is host-only; cross-subdomain admin/API setups need explicit configuration | Low |
| E8 | `.env.example` files contain placeholder secrets (`change-me…`, `dev-insecure…`) — safe, but must never be used as real values | Info |
| E9 | No `.env` in the admin app — dev proxy relies on defaults; production build needs `VITE_API_URL` or same-origin hosting | Low |

> Secret values were deliberately not printed, logged, or written to any audit artefact. The temporary scanner only classified keys.

---

## 7. WordPress equivalents (for the migration)

| Concern | WordPress location |
|---|---|
| Site URL / home URL | `wp_options` (`siteurl`, `home`) — set in `wp-config.php` or DB |
| DB credentials | `wp-config.php` (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`) |
| Auth salts | `wp-config.php` (`AUTH_KEY`, `SECURE_AUTH_KEY`, `LOGGED_IN_KEY`, `NONCE_KEY`, …) |
| SMTP | Plugin (WP Mail SMTP) or `wp-config.php` constants |
| Media offload | Plugin (S3/Cloudflare) or host persistent disk |
| Captcha | Form plugin keys |
| Maps | Theme/plugin key |
| reCAPTCHA / analytics IDs | Plugin settings / `wp_options` |
| Environment type | `WP_ENVIRONMENT_TYPE` (`production`/`staging`) |

**No Swift-specific secret can be reused as-is** except contact addresses and the Maps URL. All keys must be regenerated for WordPress.

---

## 8. Access status

| Item | Status |
|---|---|
| Local `.env` key names and states | Verified |
| Local secret values | Read but **not printed** |
| Production env vars | **NOT ACCESSIBLE** |
| Hosting dashboards (Vercel etc.) | **NOT ACCESSIBLE** |
| SMTP provider / sending domain | **NOT ACCESSIBLE** |
| DNS registrar | **NOT ACCESSIBLE** |
