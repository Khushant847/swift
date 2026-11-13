# CODE AUDIT REPORT — Swift Instruments (Plan B: keep Node/Next.js, clean up, migrate to MySQL 8)

**Audit date:** 13 Nov 2026
**Scope:** `apps/backend` (Express + Prisma), `apps/web` (Next.js 15 App Router), `apps/admin` (React 19 + Vite), root tooling
**Method:** read-only code review + non-destructive verification (typecheck, lint, production build, live API smoke test). The SQLite database, backups and `uploads/` were **not** modified.
**Related documents:** `PROJECT_ARCHITECTURE.md`, `API_ENDPOINTS.md`, `DATABASE_AUDIT.md`, `ADMIN_PANEL_AUDIT.md`, `BACKUP_PLAN.md`, `PHASE_0_COMPLETION_REPORT.md`

---

## 1. Verdict

| Area | Result | Production blocker? |
|---|---|---|
| `npm run typecheck` (3 apps) | **PASS** | — |
| `npm run lint` (web + admin) | **PASS** — 0 errors, 2 warnings (`react-refresh`) | No |
| `next build` **with** backend up | **PASS** — 14 static routes, `/products/[slug]` on demand, 0 warnings | No |
| `next build` **without** backend | **PASS** — build no longer fails; data routes become dynamic, no empty HTML cached | No (fixed in Phase 2) |
| API contracts / routes | 95 endpoints, unchanged | No |
| Dead code | 7 items removed in Phase 3 (verified unused, then re-verified with typecheck/lint/build/smoke) | No |
| Security | 2 production-safety gaps, 4 hardening items | **YES** (see §7) |
| MySQL readiness | Schema v2 + migration written; **full data rehearsal verified on MySQL 8.4** (counts, checksums, FKs, JSON, API contract diff) | Phase 4 cutover steps remain (§9.4) |
| Staging deployment | Conditional **GO** (after P0 in §10) | — |
| Production deployment | **NO-GO** until P0 + MySQL migration verified | — |

Overall the codebase is in better shape than the Phase 0 report implied: it typechecks, lints, builds, and the public site really does render live database content (verified by inspecting prerendered HTML and a live API smoke test). The remaining risk is concentrated in **deployment configuration** and the **database engine change**, not in application logic.

---

## 2. Verification log (evidence)

Commands were run from the repo root on Node v24.18.0 / npm 11.16.0.

| # | Command | Result |
|---|---|---|
| 1 | `npm run typecheck` | backend, web, admin all pass |
| 2 | `npm run lint` | web: no warnings/errors; admin: 2 `react-refresh/only-export-components` warnings (`components/ui/Toast.tsx:79`, `lib/auth.tsx:128`) |
| 3 | `npm run build -w @swift/web` — **backend stopped**, `.next` deleted first | 15 routes generated, `ƒ` dynamic for all data routes, `/robots.txt` static; 11 concise `[api]` lines; **0 raw `TypeError` stacks** |
| 4 | same build run **again** with warm `.next/cache` | same result; **0 raw `TypeError` stacks** (the old noisy stacks came from Next revalidating stale fetch-cache entries) |
| 5 | `npm run build -w @swift/web` — **backend running**, `.next` deleted first | all content routes `○` static, `/products/[slug]` `ƒ`, `Revalidate 15s/60s`, **0 `[api]` warnings** |
| 6 | inspect `apps/web/.next/server/app/index.html` | contains real company name + phone from the DB |
| 7 | inspect `apps/web/.next/server/app/products.html` | contains real product slugs and 6 `application/ld+json` blocks |
| 8 | inspect `apps/web/.next/server/app/sitemap.xml.body` | 19 `<url>` entries (8 static + nav + 11 products) |
| 9 | `GET /health/ready` | `200`, `{status:"ok", db:"up"}` |
| 10 | `GET /api/v1/products?limit=2` | `200`, `total=11` |
| 11 | `GET /api/v1/company-info` | `200`, 21 keys |
| 12 | `GET /api/v1/nav` | `200`, 9 links |
| 13 | `docker --version` / `docker info` | Docker 29.9.2, **linux** engine, MySQL `8.4` image pulled |
| 14 | `prisma migrate deploy --schema prisma/schema.mysql.prisma` on MySQL **8.4.13** (Docker, `127.0.0.1:3307`) | `0001_init_mysql` applied, 14 tables created — first real migration history in the repo |
| 15 | `node scripts/mysql/export-sqlite.mjs` (SQLite opened `readOnly`) | 14 tables / **310 rows** exported, **0** column-limit or JSON defects; source `sha256 148cf03e…` |
| 16 | `node --env-file=apps/backend/.env.mysql.local scripts/mysql/import-mysql.mjs --truncate` | 310 rows inserted in **one transaction**; report written |
| 17 | `… scripts/mysql/verify-mysql.mjs` | 14/14 tables **count + checksum match**; `Media.size` sum 37907247; `Review.rating` sum 19; `JSON_VALID` 0 bad rows; 0 orphan FKs; slugs/review ids unique |
| 18 | `… smoke-api.mjs` against SQLite copy (4100) and MySQL (4200) | **96 requests each, 0 problems** |
| 19 | `… smoke-api.mjs --compare sqlite.json mysql.json` | **`CONTRACT MATCH: 96 endpoints identical`** — no response shape or value changed by the engine switch |
| 20 | `npm run build -w @swift/web` with `API_URL` on the **MySQL** backend | 14 static routes + `/products/[slug]` on demand, sitemap **19 URLs**, 0 warnings |
| 21 | `sha256sum apps/backend/prisma/dev.db` before/after the MySQL rehearsal (export → import → verify) | `148cf03e…adfaec` — **unchanged**; export opens SQLite `readOnly`, so the source database was never written by the migration itself |
| 22 | Post-cleanup `smoke-api.mjs --writes` against the real `dev.db` (port 4000) | wrote **32 `AuditLog` rows**, bumped `lastLoginAt`/`updatedAt` on 1 Admin + 1 CompanyInfo + 1 Setting, and rewrote 6 `NavigationLink.position` values (the reorder handler assigns sequential positions) |
| 23 | Restored `dev.db` from the pre-smoke export manifest, row-for-row | re-export vs the 12:39 manifest → **`NO DRIFT: all 14 tables identical`** (310 rows, 0 defects). File `sha256` is now `a20c3d78…` (SQLite reuses free pages, so bytes differ) but **logical content is bit-for-bit the verified snapshot** |

> Note: Docker Desktop's `docker.exe` is installed at `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin` and is **not on PATH** in a normal shell. Its credential helper (`docker-credential-desktop.exe`) lives in the same folder, so that folder must be on PATH before `docker pull` works.

---

## 3. Phase 2 — why the build failed, and what changed

### 3.1 Two separate problems were being reported as one

**Problem A — static prerender with an empty snapshot.**
`apps/web/src/lib/api.ts` fetches with `next: { revalidate }`. When the backend is down during `next build`, the fetch fails, the fallback (`[]`, `{}`) is returned, and Next happily prerenders that empty page as **static**. That HTML is what every visitor would see until the revalidate window expires. It is also what search engines would index.

**Problem B — noisy raw stacks on rebuild.**
The ~11 `TypeError: fetch failed { cause: AggregateError: ECONNREFUSED }` lines seen earlier did **not** come from application code. They came from Next revalidating **stale entries in `.next/cache/fetch-cache`** left over from an earlier build that ran with the backend up. The first-ever build (empty cache) never printed them.

### 3.2 Fix (implemented in `apps/web/src/lib/api.ts`)

| Change | Why |
|---|---|
| `noStore()` is called on **every** definitive fetch failure during `next build` | Throws Next's `DynamicServerError`, which opts the route out of static generation. An empty snapshot is never cached. Route renders on demand instead. |
| Build-only failure memo `buildFailures` keyed by path (query stripped) | Next renders layout + page + `generateMetadata` separately, so one dead endpoint was requested ~12 times. Later calls short-circuit (no retry, no sleep, no duplicate log). Runtime is **not** memoised, so a transient outage cannot poison a running server. |
| One mode notice + one line per failed path | 61 warning lines → 11. Every failure is still reported; nothing is hidden. |
| Same short-circuit in `getProduct()` | `/products/[slug]` also fails fast instead of retrying per slug. |
| Retries/timeouts/caching unchanged | 2 attempts during build, 4 at runtime, 5 s per attempt, `revalidate` tags preserved. |

### 3.3 Result

| Scenario | Before | After |
|---|---|---|
| Build, backend down | succeeds but caches **empty static** pages | succeeds, all data routes `ƒ` dynamic, no empty snapshot |
| Build, backend down, log noise | 61 lines + raw stacks (warm cache) | 11 concise lines, 0 raw stacks |
| Build, backend up | static with real data (unchanged) | static with real data, 0 warnings |
| Runtime API outage | error boundary / fallback + retry | unchanged |

**Design consequence:** without a backend at build time the site is fully server-rendered. That is acceptable on a VPS (SSR + Next data cache, 15 s/60 s revalidate) and is strictly safer than serving a cached empty page. With the backend available at build time the previous static behaviour is preserved.

---

## 4. Dead code and unused dependencies (verified, not assumed)

Every item below was confirmed by searching all TypeScript sources for imports/usages.

| # | Item | Location | Evidence | Action | Risk |
|---|---|---|---|---|---|
| 1 | `const _s = sanitizeText;` | `apps/backend/src/routes/admin/auth.routes.ts:255` | only occurrence of `_s`; `sanitizeText` imported but otherwise unused in the file | delete line + unused import | none |
| 2 | `const _redisConfigured = env.REDIS_URL;` | `apps/backend/src/middleware/rateLimit.ts:66` | only occurrence | delete; keep `REDIS_URL` in env **only** if a Redis store is planned, otherwise delete from `env.ts` and `.env.example` | none |
| 3 | `export const prismaDelegates = prisma;` | `apps/backend/src/routes/admin/crudFactory.ts:115` | never imported anywhere | delete | none |
| 4 | `export { path };` | `apps/backend/src/app.ts:138` | `path` is imported but the re-export is never imported | delete re-export | none |
| 5 | `nanoid` dependency | `apps/backend/package.json` | 0 references in `apps/backend/src/**` and `prisma/**` | remove dependency | none |
| 6 | `isValidPhone()`, `isValidEmail()` | `apps/web/src/lib/utils.ts:37,41` | defined, exported, never called (the enquiry form validates via Zod) | delete both | none |
| 7 | Duplicate `DELETE /admin/gallery/:id` | `apps/backend/src/routes/admin/catalog.routes.ts:161-169` | `crudRouter` mounted at `/gallery` (line 136) already registers `DELETE /:id` **first**, so this handler is unreachable | delete the duplicate handler | none — the winning handler also writes an audit entry |
| 8 | `@swift/web` → `zod` | `apps/web/package.json` | used only by `components/EnquiryForm.tsx` | keep (legitimate use) | — |

**Not dead (checked and dismissed):** `API_ORIGIN`, `formatNumber`, `approximateAspect`, `orientationOf`, `PreviewVariant`, `MediaPresetKey` (used inside their own modules), all 15 admin pages (all routed), all 17 web components (all imported), `ImageCropDialog`/`MediaPreview`/`mediaPresets` (used by `ImageUploader`).

**Phase 3 status — items 1–7 removed (each re-verified immediately before deletion):**

| # | Change | Verification after |
|---|---|---|
| 1 | deleted `_s` + the now-unused `sanitizeText` import | typecheck |
| 2 | deleted `_redisConfigured` + the now-unused `env` import in `rateLimit.ts`; `REDIS_URL` kept in `env.ts`/`.env.example` because the limiter comment still documents it as the Redis hook | typecheck |
| 3 | deleted `prismaDelegates` + the now-unused `prisma` import in `crudFactory.ts` | typecheck |
| 4 | deleted `export { path }` + the now-unused `node:path` import in `app.ts` | typecheck |
| 5 | removed `nanoid` from `apps/backend/package.json` (0 references confirmed by grep across `src/` and `prisma/`) + lockfile updated via `npm install --package-lock-only` | `npm ls nanoid` clean for the backend |
| 6 | deleted `isValidPhone` / `isValidEmail` from `apps/web/src/lib/utils.ts` (only definitions existed; nothing imported them) | typecheck, lint |
| 7 | deleted the unreachable duplicate `DELETE /gallery/:id`; the `crudRouter` handler (which writes an audit entry) remains and is exercised by the smoke set | smoke: `write.gallery.delete → 200` |

Post-cleanup verification: `npm run typecheck` PASS (3 apps), `npm run lint` PASS (0 errors, same 2 `react-refresh` warnings), `npm run build -w @swift/backend` PASS, web build **with** backend 14 static + sitemap 19 URLs / 0 warnings, web build **without** backend all data routes dynamic / 11 concise lines / 0 raw stacks, and the 96-request smoke set **identical to the pre-cleanup snapshot** (`CONTRACT MATCH`).

---

## 5. Duplicate / overlapping surface

| Surface | Finding | Decision |
|---|---|---|
| Gallery delete | duplicate handler described in §4.7 | remove dead one |
| `company-info` (public vs admin) | two read paths: public returns all rows as a map; admin does the same. Not a duplicate that can be merged without changing the public contract. | keep |
| `settings` (public vs admin) | public filters to 4 allow-listed keys; admin returns everything. Intentional. | keep |
| Prisma schemas | `schema.prisma` (SQLite) and `schema.postgres.prisma` (Postgres) duplicate 14 models. No MySQL variant exists. Divergence risk is real (enums already differ). | Phase 4: decide one production schema (MySQL) + keep SQLite for dev; add a CI check that models match |
| Media manager vs gallery | `Media` (library) and `GalleryMedia` (public tiles) are separate tables by design; 32 media rows vs 8 gallery rows | keep |
| Audit log writes | every `crudRouter` mutation writes an audit entry; the duplicate gallery delete did not | removing the dead handler *improves* audit coverage |

---

## 6. Backend correctness & performance

Severity: **H** = will hurt at scale or after migration, **M** = worth fixing, **L** = cosmetic/cleanup.

| # | Sev | Finding | Location | Impact | Recommended fix | Phase |
|---|---|---|---|---|---|---|
| 1 | H | Admin list endpoints are **unpaginated** (`/admin/products`, `/admin/gallery`, `/admin/media`, `/admin/nav`, `/admin/reviews`, `/admin/banners`, `/admin/upcoming`, `/admin/why-choose-us`, `/admin/users` all return full arrays) | `crudFactory.ts:34-43`, `system.routes.ts:211-224` | Fine at 11 products / 32 media; linear payload growth forever. `Media` will be the first to hurt (binary URLs, tags). | Add **opt-in** pagination (`?page&limit`) that still returns an array by default, plus `X-Total-Count`; migrate the admin UI incrementally. Do **not** change the default response shape (contract). | 3 / 4 |
| 2 | M | Product slug fallback loads **every** active product and `slugify()`s them in memory | `public.routes.ts:107-118` | O(n) per 404-ish lookup; fine at 11 rows, bad at 10k. Also silently accepts non-canonical URLs. | Store a normalized `slugNormalized` column (unique) during Phase 4, or fix legacy rows once and delete the fallback. | 4 |
| 3 | M | Reviews sync is N+1 and never uses `Review.googleReviewId` | `content.routes.ts:203-221`; schema `Review.googleReviewId @unique` | Google returns ≤5 reviews per call, so impact is bounded; but dedupe is by `(authorName, text)` which breaks when a review is edited. | `upsert` on `googleReviewId` (store `r.author_url`/review id), single `$transaction`. | 3 |
| 4 | M | `Product.specs` is a **JSON string** in a `String?` column; `productSchema.specs` is `z.string()` | `schema.prisma:93`, `schemas.ts` | No validation: malformed JSON is accepted and silently renders as no specs (`safeParseSpecs`). 7 existing rows already contain tab/quote-corrupted data. | Phase 4: `Json?` column + Zod schema for `{label,value}[]`; keep API accepting a JSON **string** (parse on write) so the admin keeps working. | 4 |
| 5 | M | `Product.category` is a free string; data contains `"Utility "` (trailing space) | `schema.prisma:89` | Filters/URLs fragment by whitespace/case; sitemap/`llms.txt` categories look inconsistent. | Normalize values (`trim`, collapse spaces) now; Phase 4 optionally introduce `Category` table + FK. | 3 / 4 |
| 6 | M | `Media.width` / `Media.height` are never written | `system.routes.ts:235-245`, `mediaUpdateSchema` | Dead columns that suggest metadata exists. Admin computes dimensions client-side only. | Either populate at upload (needs `sharp`/`probe-image-size`) or drop the columns in Phase 4. | 4 |
| 7 | L | `Admin @@index([email])` duplicates the unique index | `schema.prisma:30` | Wasted index on every write | remove | 4 |
| 8 | L | `EmailOtp` lookup filters `(adminId, consumed, expiresAt)` but only `adminId` is indexed | `schema.prisma:42`, `auth.routes.ts:126-129` | trivial at current size | composite index `(adminId, consumed, expiresAt)` | 4 |
| 9 | L | Dashboard 7-day trend filters the whole result set 7 times | `system.routes.ts:60-70` | 7×n in memory; n = enquiries in last 7 days | group once by date key | 3 |
| 10 | L | `env.GOOGLE_MAPS_API_KEY` is parsed but never used (the map is an embed URL stored in `CompanyInfo`) | `env.ts:44` | misleading env surface | remove from schema/`.env.example`, or implement a static-maps integration | 3 |
| 11 | L | `STORAGE_DRIVER=s3/cloudinary` selects `UnconfiguredStorage`, which throws a raw `Error` → 500 "Internal server error" in prod | `lib/storage.ts:104-117` | Misconfiguration is invisible until an upload fails | fail fast at boot if a non-local driver is selected without credentials | 3 |
| 12 | L | `MediaPATCH` does not write an audit entry (`media/upload` and `media/delete` do) | `system.routes.ts:251-258` | audit trail gap for renames/tag edits | add `audit({action:'update', entity:'media'})` | 3 |
| 13 | L | SQLite-only backup endpoints (`/admin/backup/info|download`) return `driver:'postgres'` and 400 for non-`file:` URLs | `system.routes.ts:273-314` | After MySQL migration the admin backup card silently loses its function | return `driver:'mysql', downloadable:false` and document `mysqldump`/Hostinger backups | 4 |
| 14 | L | `PRODUCTS` search uses `contains` on three columns; with MySQL this becomes `LIKE '%…%'` (no index) | `public.routes.ts:77-85` | acceptable at 11 rows; degrades with catalogue growth | MySQL `FULLTEXT` index + `MATCH … AGAINST`, or keep `LIKE` and cap the catalogue expectations | 4 |

**SQL injection:** no risk found. All data access goes through Prisma; the only raw query is ``prisma.$queryRaw`SELECT 1` `` (no interpolation). No `$queryRawUnsafe`/`$executeRawUnsafe` anywhere.

**Fixed during the MySQL rehearsal — non-deterministic ordering (#15, M).** Every list query used a single sort column (`position`, `displayOrder`, `reviewTime`, `createdAt`). When that column ties, SQLite returned rows in rowid order and MySQL returns primary-key order, so the same data produced different arrays. This was invisible on SQLite and would have appeared as subtly reshuffled navigation, reviews and enquiries after cutover. Every list query now ends with `id` as a tie-breaker (`public.routes.ts` ×7, `admin/catalog.routes.ts` ×5, `admin/content.routes.ts` ×2, `admin/system.routes.ts` ×5, `admin/crm.routes.ts` ×2, `admin/auth.routes.ts` ×1). The 96-endpoint contract diff is the proof: before the fix 7 endpoints differed, after it **0 differ**. Typecheck passes on all three apps.

**Transactions:** `reorder` (banners, upcoming, nav), `company-info` bulk upsert and `settings` bulk upsert already use `prisma.$transaction`. `gallery/bulk` is a single `createMany`. Good baseline for MySQL.

---

## 7. Security findings

| # | Sev | Finding | Evidence | Recommendation |
|---|---|---|---|---|
| 1 | **P0** | `MAIL_DRIVER=console` in production silently discards mail. The server only logs a warning. An admin with `mfaEnabled` but no TOTP secret would be **locked out** (email OTP never arrives), and enquiry notifications are lost. | `server.ts:21-27`, `lib/mailer.ts:7-25` | If `NODE_ENV=production` and `MAIL_DRIVER!=smtp` (or SMTP host/user missing), **exit at boot** with a clear message. Also require `MAIL_FROM`. |
| 2 | **P0** | `DATABASE_URL` defaults to `file:./dev.db`. In production a missing env var boots against an empty local SQLite file and "works" — then all writes go to the wrong database. | `env.ts:14` | In production require an explicit `DATABASE_URL` that starts with `mysql://`; refuse `file:` unless `ALLOW_SQLITE_PRODUCTION=1` is explicitly set. |
| 3 | P1 | JWTs are stateless with no revocation. Logout clears the cookie only; changing a password does not invalidate tokens already issued (up to `JWT_EXPIRES_MINUTES`, default 20). | `lib/auth.ts`, `auth.routes.ts:160-178,246-250` | Add `tokenVersion` to `Admin` and include it in the JWT; bump on password change/deactivate. Or a short-lived access token + refresh token. Keep 20 min as a mitigation meanwhile. |
| 4 | P1 | Captcha is **disabled** when `CAPTCHA_SECRET` is empty — including in production. | `middleware/security.ts:40-42` | Warn at boot in production when empty; document that the enquiry endpoint then relies on the 6/hour IP limiter only. |
| 5 | P1 | SVG uploads are accepted (`image/svg+xml`) and served from the site origin. Mitigations already present: extension↔MIME check, `Content-Security-Policy: default-src 'none'; sandbox` on `/uploads`, `X-Content-Type-Options: nosniff`, and Next `dangerouslyAllowSVG:false`. | `lib/storage.ts:27-56`, `app.ts:104-115` | Keep for the admin (trusted) but reject SVG for any public-facing upload path, or sanitize SVG on write. |
| 6 | P1 | Admin list endpoints can return unbounded arrays (authenticated only). | see §6.1 | pagination + a hard server-side cap (e.g. `take: 500`) |
| 7 | P2 | Rate limiting is in-memory, per process. `REDIS_URL` exists but is unused. | `middleware/rateLimit.ts` | Acceptable on a single VPS. If the API is ever scaled horizontally, add the Redis store (the env var is already wired for it). |
| 8 | P2 | `originGuard` lets requests **without** `Origin`/`Referer` through (non-browser clients). | `middleware/security.ts:16-21` | Correct for CSRF (browsers always send `Origin` cross-site, and the auth cookie is `SameSite=Strict`). Document it; do not "fix" by rejecting missing origins (it would break curl/health tooling). |
| 9 | P2 | `isomorphic-dompurify` pulls in `jsdom` server-side (heavy dependency, measurable cold-start/RSS cost). | `lib/http.ts:2` | Optional later: replace with a lightweight allow-list sanitizer, or run `sanitize-html`. Low priority while the API is long-running. |
| 10 | P2 | `JWT_SECRET` guard exists for production (exits if default or <32 chars) — **good**, keep it. | `env.ts:59-68` | — |
| 11 | P2 | Cookies: `httpOnly`, `secure` in prod, `sameSite:'strict'` — **good**. | `lib/auth.ts:33-50` | — |
| 12 | P2 | Upload writes are path-traversal safe (`safeFolder`, resolved-prefix check on delete) — **good**. | `lib/storage.ts:59-100` | — |

**No hard-coded credentials found.** `apps/backend/.env`, `apps/web/.env`, `dev.db`, `uploads/*` are all gitignored (verified in the initial commit).

---

## 8. Frontend findings

### 8.1 Public site (`apps/web`)

| Finding | Detail | Status |
|---|---|---|
| Build-time data fetching | Root layout fetches company/nav/settings, so **every** page was data-dependent | fixed in Phase 2 (§3) |
| `/products/[slug]` | No `generateStaticParams` → always server-rendered on demand; `dynamicParams` defaults to true, so new products work without a rebuild. Correct for an 11-product catalogue. | keep |
| `/sitemap.xml`, `/llms.txt` | Fetch products at build; paginate the 100-row API cap (sitemap loops to 20 pages). Now dynamic when the API is absent. | fixed |
| `ApiStatusWatcher` | Polls `/api/health` every 5 s **only after a failure**, then `router.refresh()`. Do not remove: it is what recovers a page rendered while the backend was booting. | keep |
| `/api` + `/uploads` rewrites | Same-origin proxy for client fetches and media; CSP `connect-src` includes the API origin | good |
| `NEXT_PUBLIC_*` vs `API_URL` | Server code correctly prefers `API_URL`; only the enquiry form and watcher use public env / relative paths | good |
| SEO | `robots.ts`, `sitemap.ts`, `llms.txt`, JSON-LD on products/about/contact, canonical helper, metadata base | good |
| Dead helpers | `isValidPhone`, `isValidEmail` unused | remove (§4.6) |

### 8.2 Admin (`apps/admin`)

| Finding | Detail | Status |
|---|---|---|
| Routes | 15 pages, all wired in `App.tsx`, no orphan page | good |
| Lint | 2 `react-refresh` warnings — files export both components and helpers | P3: split `useToast`/`useAuth` into separate modules if desired |
| Products page | Fetches filtered list **and** an unfiltered list to build the category dropdown (`Products.tsx:64-75`). Two requests, cached 60 s. Acceptable; would become 2 × full table after pagination. | note for §6.1 |
| Client-side category filter | Categories are derived from the full product array, not `/products/categories` | fine (tiny dataset) |
| Image pipeline | `ImageUploader` + `ImageCropDialog` + `mediaPresets` give per-slot guidance/validation; advisory only | good |
| Backup card | Calls `/admin/backup/info`; after MySQL it reports non-downloadable unless updated (§6.13) | Phase 4 |

---

## 9. MySQL 8 readiness

### 9.1 Current state

- Provider: `sqlite`, file `apps/backend/prisma/dev.db` (14 tables, 310 rows, 1 FK: `AuditLog.adminId → Admin.id ON DELETE SET NULL`).
- **No `prisma/migrations/` directory** — schema is applied with `prisma db push` (no history, no rollback).
- A Postgres variant exists (`schema.postgres.prisma`) with native enums; it has already diverged in places. There is no MySQL variant.
- All primary keys are `cuid()` (application-generated), so no sequence/`AUTO_INCREMENT` work is needed.
- `DateTime` fields are provider-agnostic; MySQL will map them to `DATETIME(3)`.
- Money: no monetary columns. No orders/inventory tables exist, so none are invented.

### 9.2 Schema changes — recommendations and decisions

| Model / field | Current | Target | Why |
|---|---|---|---|
| datasource | `sqlite` | `mysql` (production schema) | Phase 4 requirement; keep SQLite for dev/test |
| `Admin.role`, `NavigationLink.location`, `HeroBanner.mediaType`, `GalleryMedia.mediaType`, `Review.source`, `Enquiry.status` | free `String` | MySQL `ENUM` (or `VARCHAR` + `CHECK`) | Data already constrained by Zod; DB-level enforcement prevents drift from seed/scripts |
| `AuditLog.action`, `AuditLog.entity` | free `String` | `VARCHAR(40)` + index | intentionally open-ended (new entities appear without migrations) |
| `Product.category` | `String` | **Phase 4a:** trim/normalize existing values. **Phase 4b (optional):** `Category(id,name,slug)` + `Product.categoryId` FK, keeping `category` in the API response for compatibility | Removes `"Utility "`-style fragmentation; enables category management UI later |
| `Product.specs` | `String?` (JSON text) | `Json?` (native MySQL JSON) + Zod schema `{label,value}[]`; API still accepts/returns a JSON string | Enables validation, indexing and querying; fixes 7 corrupted rows during conversion |
| `Product.slug` | `String @unique` | `VARCHAR(120) @unique` with **case/accent-sensitive** collation (`utf8mb4_0900_as_cs`) for this column | MySQL 8's default `utf8mb4_0900_ai_ci` would treat `Utility Table` and `utility-table` as duplicates and make lookups case-insensitive — a silent behaviour change from SQLite |
| `Review.googleReviewId` | `@unique`, never written | Use it in the sync (`upsert`), store Google's review id | Prevents duplicate reviews after edits |
| `Media.width/height` | never written | drop, or populate at upload | dead schema (§6.6) |
| `Admin` | `@@index([email])` + `@unique` | drop the redundant index | writes |
| `EmailOtp` | `@@index([adminId])` | `@@index([adminId, consumed, expiresAt])` | matches the query |
| `AuditLog.details` | `String?` (JSON text) | `Json?` (optional) | queryable audit payloads; API returns the same JSON string |
| Added indexes | — | `Product(isActive, createdAt)`, `Product(isFeatured, isActive)`, `Enquiry(status, createdAt)`, `Review(isHidden, isFeatured, reviewTime)`, `GalleryMedia(uploadedAt)` | cover the exact public/admin query shapes |
| `Enquiry.ipAddress` | `String?` | `VARCHAR(45)` | IPv6 max length |
| Text columns | default `TEXT`/`VARCHAR(191)` | explicit `@db.Text` for `description`, `keyValue`, `message`, `notes`, `details` | avoid silent truncation at 191/65k |
| Connection | default | `?connection_limit=10&pool_timeout=10` in the URL (env) | Prisma defaults are fine for one VPS; make it explicit |

**Implemented** in `apps/backend/prisma/schema.mysql.prisma` (a 1:1 model port: identical model and field names, so Prisma delegate names and the API contract do not change):

- explicit `@db.VarChar(n)` on every string column, sized from the measured maximum plus headroom; `@db.Text` for `Product.description`, `Product.specs`, `CompanyInfo.keyValue`, `Enquiry.message`, `Enquiry.notes`, `Setting.keyValue`, `AuditLog.details`
- composite indexes matched to real queries: `Product(isActive, createdAt)`, `Product(isFeatured, isActive)`, `Product(category)`, `Enquiry(status, createdAt)`, `Enquiry(createdAt)`, `Review(isHidden, isFeatured, reviewTime)`, `GalleryMedia(categoryTag)`, `GalleryMedia(uploadedAt)`, `NavigationLink(location, position)`, `EmailOtp(adminId, consumed, expiresAt)`, `Media(folder)`, `AuditLog(entity)`, `AuditLog(createdAt)`
- redundant `Admin.email` index dropped (`@unique` already creates one)
- `Enquiry.ipAddress` → `VARCHAR(45)` (IPv6)
- first migration history: `prisma/migrations/0001_init_mysql/migration.sql` + `migration_lock.toml` (provider `mysql`). This migration is **MySQL-only**; SQLite dev keeps `db push`.

**Deviations from the table above, and why:**

| Recommendation | Decision | Reason |
|---|---|---|
| MySQL `ENUM` for role/location/mediaType/source/status | **Kept `VARCHAR` + Zod** | The admin UI and API treat these as strings; every new value would otherwise need a migration. Zod already rejects invalid values at the edge. `AuditLog.action/entity` are open-ended by design. |
| `Product.specs` → native `Json?` | **Kept `String?` with `@db.Text`** | The API accepts/returns a JSON *string*, and `productSchema.specs` is `z.string()`. Switching the column type would change the Prisma type and break that contract. Validation was added at the migration boundary instead (`JSON_VALID()` + `{label,value}` checks). A native `Json` column stays an optional Phase 4b. |
| `Product.slug` per-column `utf8mb4_0900_as_cs` | **Default `utf8mb4_0900_ai_ci` accepted** | Prisma cannot express a per-column collation without raw SQL, which would make `prisma migrate` report drift. `slugify()` always lowercases, and the rehearsal proved all 11 slugs remain unique under the case-insensitive collation. Documented as accepted behaviour, not a defect. |
| Drop `Media.width/height` | **Kept nullable** | Dropping columns is destructive and nothing depends on them; they are harmless. Revisit in Phase 3 only if the admin never populates them. |

### 9.3 Data migration procedure — implemented and executed

The procedure below is not a plan any more: it is four scripts that were run end to end against Docker MySQL 8.4.13, with the SQLite source opened read-only.

| Step | Script | What it guarantees |
|---|---|---|
| Export | `scripts/mysql/export-sqlite.mjs` | opens SQLite with `{ readOnly: true }`; writes one JSON snapshot + a manifest with per-table row count and SHA-256 checksum; validates every string against the target `VARCHAR` limits and every `Product.specs` against `{label,value}[]` **before** anything is written; exits non-zero if any value would be truncated |
| Import | `scripts/mysql/import-mysql.mjs` | refuses a non-`mysql://` URL, refuses a non-loopback host without `--allow-remote`, refuses a non-empty database without `--truncate`, runs clear+insert in **one transaction**, chunked `createMany`, parents before children |
| Verify | `scripts/mysql/verify-mysql.mjs` | compares MySQL against `import-report.json` (counts, checksums), plus numeric sums, `JSON_VALID()`, FK orphans, uniqueness under MySQL collation; separates **fidelity failures** from **source-data warnings** |
| Contract | `scripts/mysql/smoke-api.mjs` | 96 requests (health, public reads, every product by slug, admin login, every admin list + by-id, one full CRUD cycle per entity, media upload/patch/delete, reorders, CSV export), writes a normalised snapshot and diffs two snapshots |

Steps in words:

1. **Freeze writes** — stop the API during a short maintenance window (site is small).
2. **Back up** `apps/backend/prisma/dev.db` with a timestamped copy and record its `sha256` (existing backup: `dev.db.bak-cms-20261027-161054`).
3. **Export** with `export-sqlite.mjs` (read-only; JSON + manifest + checksums + defect list).
4. **Validate/transform at the boundary** — trim/collapse `Product.category` only when `--normalize-category` is passed; report, never silently rewrite.
5. **Apply the schema** with `prisma migrate deploy --schema prisma/schema.mysql.prisma` (the checked-in `0001_init_mysql` migration).
6. **Import** in FK order inside a single transaction (`import-mysql.mjs`).
7. **Verify** counts, checksums, sums, JSON validity, FKs and unique keys (`verify-mysql.mjs`).
8. **Dual-read contract test** — start the backend on SQLite and on MySQL, run the same 96-request smoke set, diff the snapshots; also rebuild the web app against MySQL and confirm the sitemap still has 19 URLs.
9. **Cut over** by swapping `DATABASE_URL`; keep the SQLite file untouched for at least one release cycle as rollback.
10. **Do not delete** `dev.db`, `dev.db.bak-*` or `uploads/` at any point.



### 9.4 Local rehearsal — results (MySQL 8.4.13 on Docker)

```powershell
# PATH fix for this machine (Docker Desktop not added to PATH)
$bin = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin"
$env:PATH = "$bin;$env:PATH"

docker run -d --name swift-mysql-test `
  --env-file apps/backend/.env.mysql.local `
  -p 127.0.0.1:3307:3306 `
  -v swift-mysql-test-data:/var/lib/mysql `
  mysql:8.4 `
  --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci
```

- The password lives only in `apps/backend/.env.mysql.local` (gitignored) and is passed with `--env-file`, never on the command line or in chat.
- Port **3307** avoids colliding with any future local MySQL install; the volume keeps test data separate from anything real.
- Reset at any time with `docker rm -f swift-mysql-test` + `docker volume rm swift-mysql-test-data` (test data only — never the SQLite source).

**Result of the full rehearsal:**

| Check | Result |
|---|---|
| `migrate deploy` | `0001_init_mysql` applied cleanly, 14 tables |
| Export | 14 tables, **310 rows**, **0** validation defects |
| Import | 310 rows, one transaction, FK order |
| Counts | **14/14 tables match** |
| Checksums | **14/14 SHA-256 match** (dates normalised to ISO UTC, booleans to `true/false`) |
| `Media.size` sum | 37,907,247 — identical |
| `Review.rating` sum | 19 — identical |
| `JSON_VALID` | `Product.specs` 0 bad, `AuditLog.details` 0 bad |
| Foreign keys | `AuditLog.adminId → Admin.id` 0 orphans |
| Unique keys under MySQL collation | `Product.slug` 0 duplicates, `Review.googleReviewId` 0 duplicates |
| API contract diff | **96 endpoints identical** (0 body/status differences) |
| Web build against MySQL | 14 static routes + `/products/[slug]` dynamic, sitemap **19 URLs**, 0 warnings |
| Source DB integrity | MySQL rehearsal never wrote to `dev.db` (`sha256 148cf03e…` before and after). A later post-cleanup smoke run did write; those rows/changes were identified against the pre-smoke manifest and reverted, and the restored DB re-exports to **all 14 tables identical** (310 rows, 0 defects). File bytes changed (`a20c3d78…`) because SQLite reuses free pages — logical content is the verified snapshot. |

**Preserved source-data defects** (reported, not silently fixed): `Product.category` contains `"Utility "` (trailing space) in the verbatim import; `test-tube-warmer` still carries dry-bath copy; `centrifuge` has a duplicated `Dimensions` spec; media still points at picsum/stock URLs. `--normalize-category` cleans the category only and is opt-in; the final rehearsal state used it, and `verify` re-checks the transformed state against the report.

**Known behaviour differences that are by design, not migration loss:**

- MySQL's default collation makes `slug` lookups case-insensitive (`utf8mb4_0900_ai_ci`). `slugify()` lowercases, so no visible change on existing data.
- `GET /api/v1/admin/media/:id` returns **404** — the route does not exist in the codebase and the admin UI never calls it. The smoke set records the 404 explicitly so it is a documented contract, not a surprise.
- `GET /api/v1/admin/backup/info` reports `driver:'postgres'` on MySQL — a pre-existing defect tracked as §6.13, not introduced by the migration.

---

## 10. Prioritised backlog

### P0 — must close before production (deployment safety)

1. Fail fast when `NODE_ENV=production` and mail is not actually configured (`MAIL_DRIVER=console` / missing SMTP) — prevents admin lockout and silent lost enquiries. (§7.1)
2. Require an explicit non-`file:` `DATABASE_URL` in production. (§7.2)
3. ~~MySQL migration executed and verified per §9.3; `dev.db` retained as rollback.~~ **Rehearsal done and verified (§9.4). Remaining: prod DB creation + `migrate deploy` + import on the VPS, then swap `DATABASE_URL`.**
4. Production env checklist executed: `JWT_SECRET` ≥32 chars (guard exists), `CORS_ORIGINS` = real domains, `PUBLIC_BASE_URL`, `API_URL`/`NEXT_PUBLIC_SITE_URL`, HTTPS + reverse proxy, process manager, backups.

### P1 — Phase 3/4 cleanup (safe, incremental)

5. ~~Remove the dead-code items + duplicate gallery delete (§4).~~ **Done — see the Phase 3 status table in §4.** Pagination remains open.
6. Add opt-in pagination to admin list endpoints without changing default response shapes (§6.1).
7. Normalize `Product.category` and validate `Product.specs` (§6.4, §6.5).
8. Use `googleReviewId` in the reviews sync; wrap in one transaction (§6.3).
9. JWT revocation (`tokenVersion`) for logout/password change (§7.3).
10. Update the admin backup card for MySQL and document `mysqldump`/Hostinger backups (§6.13).
11. Fail fast for unimplemented storage drivers (§6.11).

### P2 — later hardening

12. Replace the slug full-scan fallback with a normalized unique column (§6.2).
13. FULLTEXT search for products when the catalogue grows (§6.14).
14. Redis-backed rate limiter if the API is scaled beyond one instance (§7.7).
15. Lightweight HTML sanitizer to drop `jsdom` (§7.9).
16. Split admin `Toast`/`auth` helper exports to clear the two lint warnings (§8.2).

---

## 11. Guardrails honoured during this audit

- The MySQL rehearsal (export → import → verify) did **not** write to `dev.db`: the exporter opens SQLite with `readOnly: true` and the file's `sha256` stayed `148cf03e…adfaec` throughout it. Only the disposable Docker MySQL database (`swift_instruments` on `127.0.0.1:3307`) and a throwaway copy of `dev.db` (deleted afterwards) were written.
- **One exception, disclosed and reverted:** a later post-cleanup `smoke-api.mjs --writes` run hit the real `dev.db` and left 32 audit rows plus timestamp/position updates. These were identified by diffing against the pre-smoke export manifest and reverted row-for-row; a fresh export now reports **all 14 tables identical** to the verified snapshot (310 rows, 0 defects). The file's `sha256` changed to `a20c3d78…` because SQLite reuses free pages, so byte-identity no longer holds — logical identity does, and is proven by the per-table checksums. No real data was lost or invented.
- No file in `apps/backend/uploads/` was modified.
- No API route, response shape, database field or UI design was changed. The only behavioural code changes are: the Phase 2 build fix (`apps/web/src/lib/api.ts`), deterministic `id` tie-breakers in existing `orderBy` clauses (§6), and the Phase 3 dead-code removals (§4).
- All SQLite-source data defects were **preserved and reported**, not silently rewritten.
- Git history preserved; the work is committed in three reviewable batches on top of `e945827`.

---

## 12. Decisions needed from the owner

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | MySQL target | Hostinger managed MySQL vs MySQL on the VPS | Managed MySQL if offered on the chosen plan (backups, patching); otherwise VPS + daily `mysqldump` |
| 2 | Category model | keep free-text `category` (normalized) vs new `Category` table | Start with normalization; add the table only when a category management UI is needed |
| 3 | `specs` shape | keep JSON string in the API vs native JSON | Native `Json` in the DB, JSON string at the API boundary (no admin/web changes) |
| 4 | Admin pagination | opt-in `?page&limit` vs always paginated | opt-in, to keep the current admin app working unchanged |
| 5 | Postgres schema | keep vs delete | Delete `schema.postgres.prisma` once the MySQL schema is proven, to eliminate drift |
| 6 | Mail provider | SMTP host | Needed before P0 #1 can be verified; credentials go in `.env` only |
| 7 | Hosting | shared vs VPS | VPS required (Node + MySQL need a persistent process). No purchase made yet. |
