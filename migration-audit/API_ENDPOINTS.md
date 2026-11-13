# API ENDPOINTS — Swift Instruments

**Audit date:** 13 Nov 2026
**Base URL (local):** `http://localhost:4000`
**API prefix:** `/api/v1`
**Framework:** Express 4 + Zod validation + Prisma 6
**Method:** Full read-only review of `apps/backend/src/routes/**` and `apps/backend/src/app.ts`.

---

## 1. Conventions

| Item | Behaviour |
|---|---|
| Success envelope | `{ "success": true, "data": <payload> }` |
| Error envelope | `{ "success": false, "error": "<message>", "details"?: <zod issues> }` |
| Auth | JWT in HttpOnly cookie `swift_at`; `Authorization` header also allowed by CORS |
| CSRF | `originGuard` on all state-changing admin/auth routes (checks Origin/Referer against `CORS_ORIGINS`) |
| Rate limiting | Global 1200 req/min/IP; login 8/15 min; MFA 10/10 min; enquiries 6/hour; uploads 60/min |
| Body limits | JSON/urlencoded 1 MB; uploads capped by `UPLOAD_MAX_MB` (25) |
| CORS | Explicit origins with credentials, wildcard only if configured (`*` disables origin guard) |
| Static media | `/uploads/*` with 7-day cache, `nosniff`, sandbox CSP |
| Health | `/health` (liveness), `/health/ready`, `/api/health` (DB readiness → 503 if down) |

Every admin route is mounted under `requireAuth` + `originGuard`. Super-admin-only operations are additionally gated with `requireRole('super_admin')`.

---

## 2. Public endpoints (no auth)

| Method | Path | Purpose | Query / body | Notes |
|---|---|---|---|---|
| GET | `/api/v1/nav` | Active navigation links | — | Ordered by `position` |
| GET | `/api/v1/banners` | Active hero slides | — | Ordered by `displayOrder` |
| GET | `/api/v1/why-choose-us` | Active USP cards | — | Ordered |
| GET | `/api/v1/products/categories` | Distinct active categories | — | Returns `string[]` |
| GET | `/api/v1/products` | Paginated active products | `search`, `category`, `featured=true`, `page` (≥1), `limit` (1–100, default 50) | Returns `{items,total,page,pageSize}`; newest first |
| GET | `/api/v1/products/:slug` | Single active product | — | Exact slug, then normalized legacy fallback; 404 if absent |
| GET | `/api/v1/company-info` | All company key/values as an object | — | Includes HTML bio/history |
| GET | `/api/v1/upcoming` | Active upcoming products | — | Ordered |
| GET | `/api/v1/gallery` | Gallery items | `category` (tag) or `all` | Newest upload first |
| GET | `/api/v1/gallery/tags` | Distinct gallery tags | — | `string[]` |
| GET | `/api/v1/reviews` | Visible reviews | — | Returns `{items, average, count}`; featured first |
| GET | `/api/v1/settings` | Public settings whitelist | — | Only `footer_text`, `social_links`, `copyright`, `legal_disclaimer` |
| POST | `/api/v1/enquiries` | Submit contact form | `{name,email,phone,companyName?,subject?,message,captchaToken?}` | Rate-limited, captcha hook, Zod, sanitised, stored + emailed to `enquiry_recipients` |

**Public write surface:** exactly one endpoint (`POST /enquiries`). Everything else is read-only.

### Enquiry validation (verified)
- `name` 2–120 chars, valid email, phone regex `^[+\d][\d\s-]{6,19}$`, company ≤160, subject ≤200, message 5–4000.
- Optional captcha token verified server-side only when `CAPTCHA_SECRET` is configured (currently empty).
- IP recorded when available; email failure does not roll back the DB insert (lead is not lost).

---

## 3. Admin authentication

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/admin/auth/login` | Public (rate-limited) | Email + password → sets cookie, returns admin or MFA challenge |
| POST | `/api/v1/admin/auth/mfa/verify` | Challenge token | Verify TOTP/email OTP, sets session cookie |
| GET | `/api/v1/admin/auth/me` | Session | Current admin profile |
| POST | `/api/v1/admin/auth/logout` | Session | Clears cookie + audit entry |
| POST | `/api/v1/admin/auth/mfa/setup` | Session | Begin TOTP setup, returns secret/QR |
| POST | `/api/v1/admin/auth/mfa/setup/confirm` | Session | Confirm code and enable MFA |
| POST | `/api/v1/admin/auth/change-password` | Session | Current + new password (bcrypt) |

---

## 4. Admin content endpoints

Most modules use a generic CRUD factory: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PATCH /:id`, `DELETE /:id`, with Zod schemas, audit logging and optional super-admin-write gating.

### 4.1 Products — `/api/v1/admin/products`
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List with `search`, `category`, `status`; pagination |
| GET | `/:id` | Read |
| POST | `/` | Create (slug normalised, HTML sanitised, specs JSON) |
| PUT/PATCH | `/:id` | Update |
| DELETE | `/:id` | Delete |

### 4.2 Hero banners — `/api/v1/admin/banners`
CRUD + `POST /banners/reorder` (`[{id, displayOrder}]`).

### 4.3 Why Choose Us — `/api/v1/admin/why-choose-us`
CRUD (title, description, icon, order, active).

### 4.4 Upcoming products — `/api/v1/admin/upcoming`
CRUD + `POST /upcoming/reorder`.

### 4.5 Gallery — `/api/v1/admin/gallery`
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/` | List / create |
| PUT/PATCH | `/:id` | Update |
| POST | `/bulk` | Bulk create (array of gallery items) |
| DELETE | `/:id` | Delete |

### 4.6 Company info — `/api/v1/admin/company-info`
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Key/value object |
| PUT | `/` | Bulk upsert; HTML keys (`founder_bio`, `history`, `about`, `why_text`) sanitised |

### 4.7 Navigation — `/api/v1/admin/nav`
CRUD + `POST /nav/reorder`; `safeUrl` validation blocks script schemes.

### 4.8 Settings — `/api/v1/admin/settings`
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | All settings |
| PUT | `/` | Bulk upsert — **super admin only**; `social_links` JSON validated |

### 4.9 Reviews — `/api/v1/admin/reviews`
CRUD + `POST /reviews/sync` — pulls Google reviews; **super admin only**; requires `GOOGLE_PLACES_API_KEY` + `GOOGLE_PLACE_ID` (both unset locally).

---

## 5. CRM — enquiries

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/admin/enquiries/stats` | Counts by status + recent volume |
| GET | `/api/v1/admin/enquiries/export` | CSV export of filtered enquiries |
| GET | `/api/v1/admin/enquiries` | List with `search`, `status`, `from`, `to`, pagination |
| GET | `/api/v1/admin/enquiries/:id` | Detail incl. notes |
| PATCH | `/api/v1/admin/enquiries/:id` | Update status/notes |
| DELETE | `/api/v1/admin/enquiries/:id` | Delete |
| POST | `/api/v1/admin/enquiries/bulk` | Bulk status update or delete |

PII is returned to authenticated admins only. No public read access exists.

---

## 6. System endpoints

| Method | Path | Purpose | Role |
|---|---|---|---|
| GET | `/api/v1/admin/dashboard` | KPI aggregates + recent activity | Any admin |
| GET | `/api/v1/admin/audit` | Paginated/filtered audit log | Any admin |
| GET | `/api/v1/admin/users` | List admins | Super admin |
| POST | `/api/v1/admin/users` | Create admin | Super admin |
| PUT | `/api/v1/admin/users/:id` | Update role/status/password | Super admin |
| DELETE | `/api/v1/admin/users/:id` | Delete admin (self-delete blocked) | Super admin |
| GET | `/api/v1/admin/media` | List media (folder filter) | Any admin |
| POST | `/api/v1/admin/media/upload` | Multipart upload (MIME/size/magic checks) | Any admin |
| PATCH | `/api/v1/admin/media/:id` | Edit metadata (tags/alt) | Any admin |
| DELETE | `/api/v1/admin/media/:id` | Delete file + row | Any admin |
| GET | `/api/v1/admin/backup/info` | Backup driver/size/modified time | Super admin |
| GET | `/api/v1/admin/backup/download` | Stream DB backup | Super admin |

---

## 7. Non-API routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness (`status`, `uptime`, `ts`) |
| GET | `/health/ready` | Readiness (DB `SELECT 1`; 503 when down) |
| GET | `/api/health` | Same readiness probe for same-origin web polling |
| GET | `/uploads/*` | Static media from local disk |

---

## 8. Endpoint count

| Group | Endpoints |
|---|---:|
| Public | 13 |
| Admin auth | 7 |
| Admin content (CRUD verbs + reorder/bulk/sync) | 52 |
| CRM / enquiries | 7 |
| System / media / users / backup | 12 |
| Health + static | 4 |
| **Total** | **95** |

---

## 9. WordPress migration implications

| API concern | WordPress replacement |
|---|---|
| Public JSON reads | WP REST API (`/wp-json/wp/v2/*`) or server-rendered pages; the Next.js front end would be replaced by a WordPress theme, so these reads mostly disappear |
| Enquiry POST | Form plugin endpoint (CF7/Gravity) + spam protection |
| JWT cookie auth | Native WordPress cookie auth + nonces |
| MFA endpoints | Two-factor plugin |
| CRUD + reorder APIs | Native admin AJAX/REST; reorder via plugin or custom code |
| CSV export | Plugin or custom admin action |
| Audit/dashboard/backup APIs | Plugins |
| Static `/uploads` | WordPress Media Library URLs |
| Custom `safeUrl` validation | Theme/ACF validation (must be re-implemented to avoid stored XSS) |

**Important:** the website's security guarantees (strict Zod schemas, DOMPurify, origin guard, rate limits) do **not** transfer automatically to WordPress. Forms, custom fields and any custom endpoints must be re-hardened. See `MIGRATION_RISK_REPORT.md`.

---

## 10. Access status

| Item | Status |
|---|---|
| All route source files | Inspected |
| Live local API | Not started during this audit (no requests made) |
| Production API | **NOT ACCESSIBLE** |
| API documentation (OpenAPI/Swagger) | Does not exist in repo |
| Third-party integrations | Google Maps/Places (keys empty), captcha (secret empty), SMTP (console driver), Redis (empty) |
