# Swift Instruments — Site Map & File Guide

> Complete annotated map of the repository: every file, its **location**, and **what it contains**.
> Generated: 27 Oct 2026 (post-audit state).
>
> Note: the *live* SEO sitemap served to search engines is generated at runtime by
> `apps/web/src/app/sitemap.ts` → `https://<site>/sitemap.xml` (plus `robots.txt` from
> `apps/web/src/app/robots.ts`). This document is the **codebase** site map.

---

## 1. Big Picture

A pnpm/npm **workspaces monorepo** with three apps:

| App | Stack | Port (dev) | Purpose |
|---|---|---|---|
| `apps/backend` | Express 5 + Prisma 6 + SQLite (dev) / PostgreSQL (prod) + Zod | **4000** | REST API, auth, uploads, audit trail |
| `apps/web` | Next.js 15 (App Router) + React 19 + Tailwind 3 | **3000** | Public marketing site (ISR, 60s revalidation) |
| `apps/admin` | Vite + React 19 + React Router 7 + TanStack Query v5 + Tailwind 3 | **5173** | Admin CMS single-page app |

**How requests flow:**

```
Browser ──► Next.js :3000 ──(SSR/ISR server fetch)──► API :4000/api/v1
   │                └── /api/v1/*  rewrite (same-origin proxy) ──► API :4000
   │
   └──► Admin SPA :5173 ──(dev proxy /api + /uploads)──► API :4000
Auth: JWT (HS256) in an HttpOnly, SameSite=Strict cookie (`swift_at`).
API envelope: `{ success, data }` on success, `{ success:false, error, details? }` on failure.
```

---

## 2. Root-Level Files

| File | Location | What it contains |
|---|---|---|
| `package.json` | `/package.json` | Workspace root: `dev` (concurrently runs all 3 apps), `build`, `typecheck`, `lint`, `db:generate`, `db:push`, `db:seed` scripts |
| `package-lock.json` | `/package-lock.json` | Dependency lockfile (all workspaces) |
| **`SITE_MAP.md`** | `/SITE_MAP.md` | This document |

---

## 3. `apps/backend` — API Server

### 3.1 Entry & assembly

| File | Location | What it contains |
|---|---|---|
| `server.ts` | `apps/backend/src/server.ts` | Bootstrap: DB connect → `app.listen(PORT)` → prod `MAIL_DRIVER=console` warning → graceful shutdown (SIGINT/SIGTERM), `unhandledRejection` + `uncaughtException` handlers |
| `app.ts` | `apps/backend/src/app.ts` | Express app assembly in order: `trust proxy` (from `TRUST_PROXY`), helmet (strict CSP + prod HSTS), CORS (strict allow-list → clean 403), body parsers, cookie-parser, morgan (dev), static `/uploads`, global `apiLimiter`, `/api/v1` router, 404 + error handlers |

### 3.2 Config

| File | Location | What it contains |
|---|---|---|
| `env.ts` | `apps/backend/src/config/env.ts` | Zod-validated environment: `PORT`, `DATABASE_URL`, `JWT_SECRET` (+ prod hard-fail on weak secret), `JWT_EXPIRES_MINUTES`, `COOKIE_NAME`, `CORS_ORIGINS`, `STORAGE_DRIVER`, `UPLOAD_MAX_MB`, `S3_*` (bucket/region/endpoint/keys/public URL), `MAIL_DRIVER`/`SMTP_*`, `TRUST_PROXY`, `GOOGLE_PLACES_*`, `CAPTCHA_SECRET`. Exports `env`, `isProd`, `corsOrigins` |
| `.env` | `apps/backend/.env` | Local dev secrets (DB file, JWT secret, mail=console, CORS for :3000/:5173) — **never commit** |
| `.env.example` | `apps/backend/.env.example` | Documented template of every backend env var |

### 3.3 `src/lib` — core utilities

| File | Location | What it contains |
|---|---|---|
| `http.ts` | `apps/backend/src/lib/http.ts` | `ApiError` class + static factories (`badRequest` 400, `unauthorized` 401, `forbidden` 403, `notFound` 404, `conflict` 409, `tooMany` 429, `badGateway` 502); `asyncHandler`; `ok(res, data)` envelope helper; `sanitizeHtml` (DOMPurify) / `sanitizeText` |
| `auth.ts` | `apps/backend/src/lib/auth.ts` | JWT sign/verify (HS256-pinned, issuer/audience-checked), HttpOnly SameSite=Strict cookie set/clear, `readToken(req)`, MFA challenge sign/verify (`signChallenge`/`verifyChallenge`) |
| `audit.ts` | `apps/backend/src/lib/audit.ts` | Fire-and-forget audit-trail writer (`audit()` → `AuditLog` row: actor, action, entity, details JSON, IP, user-agent); `clientIp(req)` (trust-proxy-aware, unspoofable) |
| `prisma.ts` | `apps/backend/src/lib/prisma.ts` | Singleton `PrismaClient` (dev global-cache to survive HMR) |
| `mailer.ts` | `apps/backend/src/lib/mailer.ts` | Nodemailer wrapper: `console` driver (dev; PII-gated logs) or `smtp` driver; `sendMail()`; `wrapEmailHtml()` branded HTML shell |
| `storage.ts` | `apps/backend/src/lib/storage.ts` | Storage abstraction (`put`/`remove`/`open`); local driver → `apps/backend/uploads`, S3-compatible driver (AWS/R2/Spaces/MinIO, fail-fast config) used on Vercel; streaming `/uploads` reads with Range support; strict MIME/extension allow-lists (images/videos/PDF); `validateUpload`, `isVideoMime`; traversal-safe path handling |
| `logger.ts` | `apps/backend/src/lib/logger.ts` | Tiny dependency-free colourised structured logger (`debug`/`info`/`warn`/`error`) |

### 3.4 `src/middleware`

| File | Location | What it contains |
|---|---|---|
| `auth.ts` | `apps/backend/src/middleware/auth.ts` | `requireAuth` (async: verifies JWT → **DB re-check of admin active/session revocation** → attaches `req.admin`); `requireRole('super_admin')` RBAC gate |
| `security.ts` | `apps/backend/src/middleware/security.ts` | `originGuard` (CSRF defence: state-changing requests must come from an allow-listed origin); `verifyCaptcha` (reCAPTCHA/Turnstile siteverify, 5s timeout, no-op without `CAPTCHA_SECRET`) |
| `rateLimit.ts` | `apps/backend/src/middleware/rateLimit.ts` | In-memory sliding-window limiter. `apiLimiter` 1200/min (global), `loginLimiter` 8/15min, `mfaLimiter`, `enquiryLimiter` 6/h, `uploadLimiter` 60/min — all keyed by **IP only** |
| `validate.ts` | `apps/backend/src/middleware/validate.ts` | `validate(zodSchema, 'body'\|'query'\|'params')` — parses + replaces req source with typed data; failures → 400 with field errors |
| `upload.ts` | `apps/backend/src/middleware/upload.ts` | Multer memory-storage config: `UPLOAD_MAX_MB` size cap, 20 files max, MIME + extension allow-list filter. Exports `uploadSingle`, `uploadMany` |
| `error.ts` | `apps/backend/src/middleware/error.ts` | Terminal error handler: `ApiError` → envelope; `ZodError`/`PrismaClientValidationError`/Multer → 400; Prisma P2002→409, P2025→404; unknown → 500 (stack only in dev). `notFoundHandler` → 404 |

### 3.5 `src/routes` — API surface (`/api/v1`)

| File | Location | What it contains |
|---|---|---|
| `index.ts` | `apps/backend/src/routes/index.ts` | Route mounting: public router → `/admin/auth` (+originGuard) → `/admin` (requireAuth + originGuard + catalog/content/crm/system). Mounts everything under `/v1` |
| `public.routes.ts` | `apps/backend/src/routes/public.routes.ts` | Unauthenticated API: `GET /products` (paginated, clamped `page`/`limit`, search/category/featured), `/products/categories`, `/products/:slug`, `/nav`, `/banners`, `/why-choose-us`, `/upcoming`, `/gallery`, `/gallery/tags`, `/reviews`, `/company-info`, `/settings` (public subset); `POST /enquiries` (captcha, phone regex, sanitized) |
| `admin/auth.routes.ts` | `apps/backend/src/routes/admin/auth.routes.ts` | `POST /login` (timing-equalised bcrypt, failed-login audit), `/mfa/verify` (TOTP **or** email OTP, crypto-random), `POST /logout` (audited with token-decoded identity), `GET /me`, MFA setup/disable (disable requires valid TOTP), change-password (reuse check + revokes other sessions) |
| `admin/catalog.routes.ts` | `apps/backend/src/routes/admin/catalog.routes.ts` | Product CRUD: slug auto-generated **on POST only** (preserved on PUT), empty-update → 400, featured/active flags, admin list with search + pagination |
| `admin/content.routes.ts` | `apps/backend/src/routes/admin/content.routes.ts` | CMS content CRUD: hero banners, navigation links (reorder), why-choose-us, upcoming products, gallery, company-info, key-value settings, reviews + `POST /reviews/sync` (Google Places: timeout, `resp.ok` + `status` checks, sanitized text) |
| `admin/crm.routes.ts` | `apps/backend/src/routes/admin/crm.routes.ts` | Enquiries CRM: list (status filter, clamped pagination), status update, internal notes, delete, **CSV export with formula-injection neutralisation** |
| `admin/system.routes.ts` | `apps/backend/src/routes/admin/system.routes.ts` | Dashboard analytics, audit-log query (entity/action filters, clamped pagination), media library (upload via `uploadLimiter` + delete via traversal-safe storage), settings PUT (**super_admin only**), admin users CRUD (super_admin, bcrypt hashes, self-lockout guard), DB backup info/download (super_admin, SQLite stream with error handler) |
| `crudFactory.ts` | `apps/backend/src/routes/admin/crudFactory.ts` | Generic reusable CRUD router builder (list/create/update/delete with sanitize + audit) used by catalog/content routers |

### 3.6 `prisma` — data layer

| File | Location | What it contains |
|---|---|---|
| `schema.prisma` | `apps/backend/prisma/schema.prisma` | **SQLite dev schema** — all 14 models (see §6) |
| `schema.postgres.prisma` | `apps/backend/prisma/schema.postgres.prisma` | Production PostgreSQL variant — same models with native enums; keep in sync with the SQLite schema |
| `seed.ts` | `apps/backend/prisma/seed.ts` | Idempotent seed: admin users (prod-guarded credential print), settings, company info, nav, banners (uses live `flower.mp4` sample video), products, why-choose-us, upcoming, gallery, reviews, sample enquiries |
| `dev.db` | `apps/backend/prisma/dev.db` | SQLite database file (dev data) |

### 3.7 Build output & uploads

| Path | Location | What it contains |
|---|---|---|
| `dist/` | `apps/backend/dist/` | Compiled JS (tsc output) — generated, do not edit |
| `uploads/` | `apps/backend/uploads/` | Locally-stored uploaded media, served at `/uploads/*` |

---

## 4. `apps/web` — Public Site (Next.js App Router)

### 4.1 Routes (URL → file)

| URL | File | What it contains |
|---|---|---|
| `/` | `apps/web/src/app/page.tsx` | Homepage: hero carousel, featured products, why-choose-us, about stats, upcoming teasers, gallery preview, reviews, contact CTA (server component + `EnquiryForm`) |
| `/products` | `apps/web/src/app/products/page.tsx` | Full catalog: fetches `getProducts(1, 100)` (backend max) → `ProductCatalog` |
| `/products/[slug]` | `apps/web/src/app/products/[slug]/page.tsx` | Product detail (ISR); soft-404 when slug unknown |
| `/about` | `apps/web/src/app/about/page.tsx` | Company story, founder, history, why-choose-us |
| `/upcoming` | `apps/web/src/app/upcoming/page.tsx` | Upcoming/R&D product teasers |
| `/gallery` | `apps/web/src/app/gallery/page.tsx` | Filterable media gallery (`GalleryGrid` + tags) |
| `/contact` | `apps/web/src/app/contact/page.tsx` | Contact details, `AddressMap` (Google embed), enquiry form |
| `/privacy` | `apps/web/src/app/privacy/page.tsx` | Privacy policy page (footer link target) |
| `/terms` | `apps/web/src/app/terms/page.tsx` | Terms of service page (footer link target) |
| `/sitemap` → `/sitemap-page` | `apps/web/src/app/sitemap-page/page.tsx` | Human-readable sitemap page (rewritten from `/sitemap` by `next.config.mjs`) |
| `/sitemap.xml` | `apps/web/src/app/sitemap.ts` | **Dynamic XML sitemap** (metadata route): static pages + product URLs from the API |
| `/robots.txt` | `apps/web/src/app/robots.ts` | **Dynamic robots.txt**: allow all, disallow `/api/`, sitemap pointer |
| 404 | `apps/web/src/app/not-found.tsx` | Branded 404 page with home/products links |
| loading | `apps/web/src/app/loading.tsx` | Route-level skeleton (animate-pulse placeholders) |
| layout | `apps/web/src/app/layout.tsx` | Root layout: `getCompanyInfo`/`getNav`/`getPublicSettings` (ISR), Header + Footer + FloatingActions, skip link → `<main id="main" tabIndex={-1}>`, metadata |

### 4.2 `src/components`

| File | Location | What it contains |
|---|---|---|
| `Header.tsx` | `apps/web/src/components/Header.tsx` | Utility bar (guarded tel/mailto links) + logo + desktop nav + mobile menu (`inert` when closed, Escape-to-close, `aria-controls`) |
| `Footer.tsx` | `apps/web/src/components/Footer.tsx` | Footer: contact column, quick links, legal links (**/privacy, /terms, /sitemap**), guarded mailto |
| `HeroCarousel.tsx` | `apps/web/src/components/HeroCarousel.tsx` | Hero banner carousel: `HeroVideo` subcomponent (ref-driven play/pause per active slide), prev/next, pause/resume, dots, `aria-roledescription="carousel"` |
| `EnquiryForm.tsx` | `apps/web/src/components/EnquiryForm.tsx` | Contact form: `useId` labels, max lengths, honeypot, double-submit guard; POSTs to `${PUBLIC_API_URL}/api/v1/enquiries` (same-origin proxy by default) |
| `ProductCatalog.tsx` | `apps/web/src/components/ProductCatalog.tsx` | Catalog with client-side search + category sidebar filter; honest "Showing first N of M products" copy when capped |
| `FeaturedProducts.tsx` | `apps/web/src/components/FeaturedProducts.tsx` | `ProductCard` (reused by catalog) + featured grid section |
| `Reviews.tsx` | `apps/web/src/components/Reviews.tsx` | Auto-rotating review carousel with **pause/play control** (WCAG 2.2.2), dots, `aria-live="off"` |
| `GalleryGrid.tsx` | `apps/web/src/components/GalleryGrid.tsx` | Tag-filtered gallery grid with lightbox; `compact` mode for homepage preview |
| `WhyChooseUs.tsx` | `apps/web/src/components/WhyChooseUs.tsx` | USP cards (icon via `getIcon`) |
| `UpcomingProducts.tsx` | `apps/web/src/components/UpcomingProducts.tsx` | Dark R&D teaser cards section |
| `AboutCompany.tsx` | `apps/web/src/components/AboutCompany.tsx` | About section with stats (established/employees/installations/ISO) |
| `AddressMap.tsx` | `apps/web/src/components/AddressMap.tsx` | Contact details list (tel/mailto links) + Google Maps embed |
| `PageHero.tsx` | `apps/web/src/components/PageHero.tsx` | Inner-page hero with breadcrumb trail |
| `SectionHeading.tsx` | `apps/web/src/components/SectionHeading.tsx` | Reusable eyebrow/title/description heading (light variant for dark sections) |
| `FloatingActions.tsx` | `apps/web/src/components/FloatingActions.tsx` | Mobile-only floating call/WhatsApp/scroll-to-top buttons |
| `icons.ts` | `apps/web/src/components/icons.ts` | `getIcon(name)` — maps icon-name strings (stored in DB) to lucide components |

### 4.3 `src/lib`

| File | Location | What it contains |
|---|---|---|
| `api.ts` | `apps/web/src/lib/api.ts` | **Server-side** fetch helpers: `fetchJson` (ISR revalidate, `{success}` unwrap, soft-404 vs hard-error distinction, NaN guard) + typed getters `getProducts(page, limit)`, `getFeaturedProducts`, `getNav`, `getBanners`, `getReviews`, `getCompanyInfo`, etc. Uses server `API_URL` |
| `config.ts` | `apps/web/src/lib/config.ts` | **Client-safe** config: `PUBLIC_API_URL` (`NEXT_PUBLIC_API_URL` or `''` = same-origin proxy) — the only env value client components may read |
| `types.ts` | `apps/web/src/lib/types.ts` | Shared TS interfaces: `NavLink`, `Banner`, `WhyItem`, `Product`, `UpcomingProduct`, `GalleryItem`, `Review`, `CompanyInfo`, … |
| `utils.ts` | `apps/web/src/lib/utils.ts` | `cn()` (clsx), `safeParseSpecs`, `parseSocialLinks`, `isValidPhone` |

### 4.4 Config files

| File | Location | What it contains |
|---|---|---|
| `next.config.mjs` | `apps/web/next.config.mjs` | **Rewrites**: `/sitemap` → `/sitemap-page`; `/api/:path*` → backend (`API_URL`) same-origin proxy |
| `globals.css` | `apps/web/src/app/globals.css` | Tailwind layers, design tokens (brand/accent palettes), `.card`/`.btn*`/`.input`/`.label`/`.th`/`.td` component classes, ken-burns/fade-up animations, `prefers-reduced-motion` block |
| `tailwind.config.js` | `apps/web/tailwind.config.js` | Tailwind theme: brand (navy/blue) + accent (amber) palettes, fonts, container, shadows |
| `.env.example` | `apps/web/.env.example` | `NEXT_PUBLIC_API_URL` (empty = same-origin proxy), `API_URL` (SSR), `NEXT_PUBLIC_SITE_URL` (**required in prod** for metadata/robots/sitemap), `NEXT_PUBLIC_REVALIDATE` |
| `tsconfig.json` | `apps/web/tsconfig.json` | Strict TS + `@/*` path alias |

---

## 5. `apps/admin` — Admin Console (Vite SPA)

### 5.1 SPA routes (URL → page component)

| URL | File | Access | What it contains |
|---|---|---|---|
| `/login` | `apps/admin/src/pages/Login.tsx` | public | Email/password login with labelled fields, show-password toggle, session-expired notice |
| `/` | `apps/admin/src/pages/Dashboard.tsx` | any admin | Stats cards, 7-day enquiry trend chart, recent activity, latest enquiries; early-return `ErrorState` |
| `/banners` | `apps/admin/src/pages/Banners.tsx` | any admin | Hero slide CRUD (ImageUploader, interval, order), delete/reorder with toasts |
| `/navigation` | `apps/admin/src/pages/Navigation.tsx` | any admin | Header/footer link manager with reorder |
| `/why-choose-us` | `apps/admin/src/pages/WhyChooseUs.tsx` | any admin | USP cards CRUD (icon picker) |
| `/products` | `apps/admin/src/pages/Products.tsx` | any admin | Product CRUD incl. **slug field**, RichTextEditor description, specs editor, unfiltered category dropdown (separate light query), debounced search |
| `/upcoming` | `apps/admin/src/pages/Upcoming.tsx` | any admin | R&D teaser CRUD |
| `/gallery` | `apps/admin/src/pages/Gallery.tsx` | any admin | Gallery item CRUD + bulk upload, tag filter |
| `/reviews` | `apps/admin/src/pages/Reviews.tsx` | any admin | Review moderation (hide/delete), manual add, Google Places sync |
| `/company` | `apps/admin/src/pages/Company.tsx` | any admin | Company info: branding, contact details, founder bio, history (key-value fields) |
| `/enquiries` | `apps/admin/src/pages/Enquiries.tsx` | any admin | CRM: status filter, debounced search, pagination (clamped), detail modal with notes, CSV export |
| `/media` | `apps/admin/src/pages/Media.tsx` | any admin | Media library: drag-drop upload (validated), folder filter, delete |
| `/users` | `apps/admin/src/pages/Users.tsx` | **super_admin only** (`SuperOnly` route wrapper) | Admin user CRUD: role select, active toggle, reset password |
| `/audit` | `apps/admin/src/pages/Audit.tsx` | any admin | Audit log viewer: action + entity filters (all entities incl. why/upcoming/password), pagination |
| `/settings` | `apps/admin/src/pages/Settings.tsx` | any admin | Settings: notifications, footer/legal, social links, Security (MFA enable/disable modal, change password), **Database Backup card (super_admin only)** |
| `*` | `apps/admin/src/pages/NotFound.tsx` | public | SPA 404 with back-to-dashboard link |

### 5.2 `src/components`

| File | Location | What it contains |
|---|---|---|
| `Layout.tsx` | `apps/admin/src/components/Layout.tsx` | App shell: sidebar (14 nav links + unread-enquiry badge sharing the `['dashboard']` cache key), topbar with logout, mobile drawer |
| `RichTextEditor.tsx` | `apps/admin/src/components/RichTextEditor.tsx` | contentEditable WYSIWYG: value-sync effect, toolbar (focus-preserving `onMouseDown`), `execCommand` formatting |
| `ImageUploader.tsx` | `apps/admin/src/components/ImageUploader.tsx` | Upload-to-backend widget (accepts images/video by default), preview, toast on failure |
| `ui/Feedback.tsx` | `apps/admin/src/components/ui/Feedback.tsx` | `PageHeader`, `EmptyState`, **`ErrorState` (with retry)**, `FullPageSpinner`, `TableSkeleton`, `CardSkeleton`, `Pagination`, `StatCard` |
| `ui/Form.tsx` | `apps/admin/src/components/ui/Form.tsx` | `Field` (auto id/label/aria wiring for native inputs), `TextArea`, `Select`, form helpers |
| `ui/Modal.tsx` | `apps/admin/src/components/ui/Modal.tsx` | Accessible modal dialog (Escape/backdrop close, focus trap) |
| `ui/Toast.tsx` | `apps/admin/src/components/ui/Toast.tsx` | Toast context: `useToast()` → `success()`/`error()` notifications |

### 5.3 `src/lib`

| File | Location | What it contains |
|---|---|---|
| `api.ts` | `apps/admin/src/lib/api.ts` | Fetch wrapper: `api.get/post/put/del` (base URL from `VITE_API_URL` or same-origin proxy), `ApiError` (message extraction), **global 401 event** → session reset |
| `auth.tsx` | `apps/admin/src/lib/auth.tsx` | `AuthProvider`/`useAuth`: session probe (`GET /admin/auth/me`), login/logout, `resetSession()` (clears admin state **and** `queryClient.clear()` on 401) |
| `types.ts` | `apps/admin/src/lib/types.ts` | Admin-side TS interfaces (Product, Enquiry, AuditLog, DashboardData, …) |
| `utils.ts` | `apps/admin/src/lib/utils.ts` | `cn()`, `formatDate`, `STATUS_STYLES`/`ACTION_STYLES` badge maps (with `??` fallbacks) |

### 5.4 Entry & config files

| File | Location | What it contains |
|---|---|---|
| `main.tsx` | `apps/admin/src/main.tsx` | React root: QueryClient (retry 1, staleTime 15s) → Router → Toast → Auth providers |
| `App.tsx` | `apps/admin/src/App.tsx` | Route table + `Protected` (session gate → "Verifying session…" spinner) + `SuperOnly` (RBAC redirect) wrappers |
| `vite.config.ts` | `apps/admin/vite.config.ts` | Vite config: `@` → `src` alias, dev proxy `/api` + `/uploads` → `VITE_PROXY_TARGET` |
| `tailwind.config.js` | `apps/admin/tailwind.config.js` | Theme: brand palette (50–950), **accent palette (400/500/600 only)** |
| `.env.example` | `apps/admin/.env.example` | `VITE_API_URL` (empty in dev = proxy) + `VITE_PROXY_TARGET=http://localhost:4000` |
| `index.css` | `apps/admin/src/index.css` | Tailwind layers + admin component classes |
| `index.html` | `apps/admin/index.html` | Vite HTML entry |

---

## 6. Data Model (`apps/backend/prisma/schema.prisma` — 14 models)

| Model | What it stores |
|---|---|
| `Admin` | Admin users: email, bcrypt hash, role (`super_admin` \| `content_editor`), isActive, MFA secret + flag, lastLogin |
| `EmailOtp` | One-time email OTP codes for MFA login (hashed, expiry, consumed flag) |
| `NavigationLink` | Header/footer links (title, url, position, location, isActive) |
| `HeroBanner` | Hero carousel slides (media url/type image\|video, CTA, interval, order) |
| `WhyChooseUs` | USP cards (title, description, lucide icon name, order) |
| `Product` | Products: title, **unique slug**, category, descriptions, image, specs JSON, featured/active |
| `CompanyInfo` | Key-value company details (address, phones, founder bio, branding…) |
| `UpcomingProduct` | R&D teasers (title, teaser, expected launch, image) |
| `GalleryMedia` | Gallery items (media url/type, category tag, caption) |
| `Review` | Reviews (author, rating, text, source `manual`\|`google`, review time) |
| `Enquiry` | Contact-form leads (name, email, phone, company, subject, message, status new/contacted/closed, admin notes) |
| `Media` | Uploaded media library entries (url, filename, mime, size, folder) |
| `Setting` | Key-value site settings (copyright, footer text, social links JSON, notification recipients) |
| `AuditLog` | Tamper-evident activity trail (actor, action, entity, entityId, details JSON, IP, user-agent) |

---

## 7. Environment Variables (quick reference)

| Where | Var | Purpose |
|---|---|---|
| backend | `DATABASE_URL` | `file:./dev.db` (SQLite dev) or `postgresql://…` (prod) |
| backend | `JWT_SECRET` | Token signing key — **prod hard-fails if weak/default** |
| backend | `TRUST_PROXY` | Proxy hops to trust for `X-Forwarded-*` (0 dev / 1 prod) |
| backend | `CORS_ORIGINS` | Comma allow-list (web + admin origins) |
| backend | `MAIL_DRIVER` | `console` (dev, discards) \| `smtp` (+`SMTP_*`) — prod warns if console |
| backend | `CAPTCHA_SECRET` | Enables reCAPTCHA verification on `/enquiries` (widget gap: web sends no token yet) |
| backend | `GOOGLE_PLACES_API_KEY` / `GOOGLE_PLACE_ID` | Enables `/admin/reviews/sync` |
| web | `API_URL` | Server-side backend origin (SSR + `/api` proxy rewrite target) |
| web | `NEXT_PUBLIC_API_URL` | Leave **empty** in prod → same-origin `/api/v1/*` proxy |
| web | `NEXT_PUBLIC_SITE_URL` | **Required in prod** — canonical URLs for metadata/robots/sitemap |
| web | `NEXT_PUBLIC_REVALIDATE` | ISR window in seconds (default 60) |
| admin | `VITE_API_URL` | Leave empty in dev (proxy); set backend URL if SPA is cross-origin |
| admin | `VITE_PROXY_TARGET` | Dev proxy target (`http://localhost:4000`) |

---

## 8. Commands

| Command | What it does |
|---|---|
| `npm run dev` (root) | Starts backend :4000 + web :3000 + admin :5173 via concurrently |
| `npm run build` (root) | Production build of all three apps |
| `npm run typecheck` (root) | `tsc --noEmit` for backend, web, admin |
| `npm run lint` (root) | ESLint for web + admin |
| `npm run db:generate` | Regenerates Prisma client (run after schema/dependency changes) |
| `npm run db:push` | Pushes schema to the database (dev — no migration files) |
| `npm run db:seed` | Runs `prisma/seed.ts` (idempotent; credentials printed only outside prod) |

---

## 9. Runtime SEO Artifacts (generated, not files in the repo)

| Artifact | Generated by | Contents |
|---|---|---|
| `/sitemap.xml` | `apps/web/src/app/sitemap.ts` | Static page URLs + all product URLs (from API) |
| `/robots.txt` | `apps/web/src/app/robots.ts` | `Allow: /`, `Disallow: /api/`, sitemap pointer |
| `/sitemap` (HTML) | `apps/web/src/app/sitemap-page/page.tsx` | Human-readable sitemap page (footer link target) |
