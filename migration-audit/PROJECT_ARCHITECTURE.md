# PROJECT ARCHITECTURE — Swift Instruments

**Audit date:** 13 Nov 2026
**Audit type:** Read-only pre-migration audit (no project files, database rows, or uploads were modified)
**Repository:** `C:\Users\khushant\Documents\Default Project\Swift instruments` (not a git repository — all state is disk-resident)
**Evidence basis:** Source files in `apps/*`, `docs/*`, root markdown files, `package.json` manifests, `.env.example` files, and a read-only query of `apps/backend/prisma/dev.db`.

> Legend used throughout this report set:
> **[VERIFIED]** = directly observed in source code / database file / filesystem.
> **[ASSUMPTION]** = inferred from code or documentation but not confirmed by live infrastructure.
> **[NOT ACCESSIBLE]** = could not be inspected in this environment.

---

## 1. System in one paragraph

Swift Instruments is a three-application npm-workspace monorepo: a **Next.js 15 public website** (`apps/web`), an **Express + Prisma REST API** (`apps/backend`), and a **React + Vite admin SPA / CMS** (`apps/admin`). Public content (products, banners, gallery, reviews, company info, navigation, settings) is stored in the API's database and rendered server-side by the website. The admin SPA authenticates against the API with a JWT stored in an HttpOnly cookie and manages all of that content plus enquiries (CRM), media, admin users, audit logs, and backups. Uploaded media is currently written to the backend's local `uploads/` directory and served by Express at `/uploads/*`.

---

## 2. Repository layout

| Path | Purpose | Evidence |
|---|---|---|
| `apps/web/` | Public website — Next.js App Router, SSR/ISR, Tailwind | `apps/web/package.json` |
| `apps/backend/` | REST API — Express 4, Prisma 6, Zod validation, JWT auth | `apps/backend/package.json` |
| `apps/admin/` | Admin CMS — React 19 SPA, Vite, React Router, React Query | `apps/admin/package.json` |
| `apps/backend/prisma/` | `schema.prisma` (SQLite), `schema.postgres.prisma` (Postgres variant), `seed.ts`, `dev.db`, `dev.db.bak-cms-20261027-161054` | Directory listing |
| `apps/backend/uploads/` | Local media store, 6 folders: `banners`, `branding`, `cms-test`, `general`, `products`, `team` | Filesystem scan |
| `docs/` | `DEPLOY_VERCEL.md` | Directory listing |
| root `*.md` | `README.md`, `architecture.md`, `prd.md`, `SITE_MAP.md`, `CMS_FIX_REPORT.md` | Directory listing |
| `scripts/` | `wait-for-api.mjs` (dev orchestration helper) | Directory listing |

**[VERIFIED]** There is no Dockerfile, no CI workflow directory, no git metadata, and no infrastructure-as-code in the repository.

---

## 3. Runtime topology

### 3.1 Current local development

```
┌─────────────────────┐     ┌─────────────────────┐
│  Next.js web :3000  │     │  Vite admin :5173   │
│  (SSR / ISR)        │     │  (SPA)              │
└──────────┬──────────┘     └──────────┬──────────┘
           │ /api/*  + /uploads/*      │ /api/*  + /uploads/*
           │ (Next rewrites)           │ (Vite proxy)
           ▼                           ▼
      ┌──────────────────────────────────────┐
      │   Express API  :4000                 │
      │   /api/v1/*  /uploads/*  /health*    │
      └──────────────────┬───────────────────┘
                         │ Prisma
                         ▼
              ┌──────────────────────┐
              │ SQLite dev.db        │
              │ + local uploads/ dir │
              └──────────────────────┘
```

**[VERIFIED]** `apps/web/next.config.mjs` rewrites `/api/:path*` and `/uploads/:path*` to `API_URL` (default `http://localhost:4000`).
**[VERIFIED]** `apps/admin/vite.config.*` proxies `/api` and `/uploads` to `VITE_PROXY_TARGET` (default `http://localhost:4000`).
**[VERIFIED]** Root `npm run dev` starts all three apps via `concurrently` and waits for API readiness before starting web/admin.

### 3.2 Intended production shape (documented, not deployed)

| Component | Intended host | Evidence |
|---|---|---|
| Public website | Vercel (only `apps/web`) | `docs/DEPLOY_VERCEL.md`, `apps/web/vercel.json`, `next.config.mjs` Vercel warnings |
| API | Separate long-running host (Railway / Render / Fly.io / Hostinger VPS) | `docs/DEPLOY_VERCEL.md` |
| Database | PostgreSQL (production schema prepared) | `apps/backend/prisma/schema.postgres.prisma`, `.env.example` |
| Media | Local disk on API host, with S3/Cloudinary adapters stubbed | `apps/backend/src/lib/storage.ts` |

**[NOT ACCESSIBLE]** No production deployment actually exists/verified. No production domain, API host, Vercel project, or database was reachable. Every domain in the repository is the placeholder `yourdomain.com`.

---

## 4. Application responsibilities

### 4.1 `apps/web` — public website

- **Framework:** Next.js `^15.1.4`, React `^19.0.0`, Tailwind, `lucide-react`, `zod`.
- **Routes [VERIFIED]:** `/`, `/about`, `/contact`, `/gallery`, `/products`, `/products/[slug]`, `/upcoming`, `/privacy`, `/terms`, `/sitemap-page`, plus `sitemap.ts`, `robots.ts`, and `llms.txt/route.ts` (route handlers) and `not-found.tsx`, `error.tsx`, `loading.tsx`.
- **Data access:** server-side fetch helpers in `apps/web/src/lib/api.ts` with ISR revalidation (`NEXT_PUBLIC_REVALIDATE=60` default, company info `15`), short timeouts and retries.
- **Content-driven sections:** hero carousel, featured products, why-choose-us, about/company, address + map, upcoming products, gallery grid, reviews carousel, enquiry form, header/footer navigation.
- **SEO:** per-page metadata, canonical URLs, Open Graph, JSON-LD (`Organization`, `WebSite`, `Product`, `AboutPage`), dynamic sitemap, robots, `llms.txt`.
- **Safety features:** `SafeImage` fallback for broken media, API status watcher, strict security headers (`X-Frame-Options: DENY`, CSP, Referrer-Policy).

### 4.2 `apps/backend` — API

- **Framework:** Express `^4.21.2`, Prisma `^6.2.1`, Zod `^3.24.1`, Helmet, CORS allow-list, `express-rate-limit`, `multer` uploads.
- **Entry:** `src/app.ts` builds the app; `src/server.ts` boots it.
- **Route families:**
  - Public: `/api/v1/nav`, `banners`, `why-choose-us`, `products`, `products/categories`, `products/:slug`, `company-info`, `upcoming`, `gallery`, `gallery/tags`, `reviews`, `settings`, `POST enquiries`.
  - Admin auth: `/api/v1/admin/auth/*` (login, MFA verify/setup, session, logout, change password).
  - Admin content: `products`, `banners`, `why-choose-us`, `upcoming`, `gallery`, `company-info`, `nav`, `settings`, `reviews` (CRUD + reorder + Google Places sync).
  - Admin CRM: `enquiries` list/stats/detail/update/delete/bulk/CSV export.
  - Admin system: `dashboard`, `audit`, `users`, `media`, `backup`.
- **Security:** Helmet CSP (`default-src 'none'`), CORS with credentials and explicit origins, `originGuard` CSRF check on mutations, JWT in `HttpOnly` + `SameSite=Strict` + `Secure` (prod) cookie, bcrypt password hashing, TOTP/email-OTP MFA support, per-route rate limits, HTML sanitisation with `isomorphic-dompurify`, strict Zod schemas, audit logging.
- **Health:** `/health` (liveness), `/health/ready` and `/api/health` (DB readiness, returns 503 if DB down).

### 4.3 `apps/admin` — CMS

- **Framework:** React `^19`, Vite, React Router `^6.28`, TanStack Query `^5.62`.
- **Routes [VERIFIED]:** `/login`, `/`, `/banners`, `/navigation`, `/why-choose-us`, `/products`, `/upcoming`, `/gallery`, `/reviews`, `/company`, `/enquiries`, `/media`, `/users` (super-admin only), `/audit`, `/settings` (super-admin writes), `*`.
- **Session model:** cookie-based (no token in localStorage), 20-minute JWT, client-side 15-minute inactivity auto-logout, global `swift:unauthorized` event on any 401.
- **Media tooling:** uploader, image crop dialog, media library with guidance, previews.

---

## 5. Data flow

| User action | Path |
|---|---|
| Visitor loads a page | Browser → Next.js server → `API_URL/api/v1/*` → Prisma → SQLite/Postgres → HTML (ISR cached) |
| Visitor submits enquiry | Browser (client component) → same-origin `/api/v1/enquiries` → rate limit + captcha check + Zod → DB insert → email via mailer → admin sees it in CRM |
| Admin logs in | SPA → `/api/v1/admin/auth/login` → bcrypt verify → JWT cookie (HttpOnly) → SPA holds only user object |
| Admin edits content | SPA → admin API (JWT cookie + origin guard) → Zod → sanitize → Prisma write → audit log → website picks change up after ISR window (15–60 s) |
| Admin uploads media | SPA multipart → `multer` → MIME/extension allow-list + magic-byte check → local `uploads/<folder>/` → row in `Media` |
| Media displayed | `/uploads/...` proxied by Next/Vite to API, or absolute URL if `NEXT_PUBLIC_API_URL`/`VITE_API_URL` is set |

**[VERIFIED]** Public reads are cached by Next.js for 60 s (15 s for company info); admin edits therefore propagate without a redeploy, but not instantly.

---

## 6. Database engine

- **Current:** SQLite file `apps/backend/prisma/dev.db` (397,312 bytes, last write 2026-11-07 14:50).
- **Production-prepared:** `schema.postgres.prisma` mirrors the same 14 models with native enums and `provider = "postgresql"`.
- **ORM:** Prisma Client generated from `schema.prisma`.
- **Migrations:** **[VERIFIED]** there is no `prisma/migrations/` directory in the repository; the project uses `db:push` (schema push) rather than versioned migrations. See `DATABASE_AUDIT.md`.

---

## 7. Build and tooling

| Command | Effect |
|---|---|
| `npm run dev` | Runs API, web, admin together (recommended; separate servers cause port conflicts) |
| `npm run build` | Builds backend, then web, then admin |
| `npm run typecheck` | TypeScript checks all three apps |
| `npm run lint` | ESLint for web and admin |
| `npm run setup` | install → prisma generate → db push → seed |
| `npm run db:reset` / `db:seed` | Destructive reset / reseed (must never run against production) |

**[VERIFIED]** Previous audit cycle confirmed web and admin typecheck, lint and production builds pass; backend typecheck passes.

---

## 8. Security posture summary

| Control | Status |
|---|---|
| Password hashing | bcrypt, cost 12 |
| Session transport | HttpOnly, SameSite=Strict, Secure in prod cookie |
| CSRF | SameSite + origin/referer guard on mutations |
| MFA | TOTP and email OTP supported; **currently disabled for both local users** |
| RBAC | `super_admin` / `content_editor`; users/settings/backup restricted |
| Rate limits | login 8/15 min, MFA 10/10 min, enquiry 6/hour/IP, upload 60/min, global 1200/min |
| Upload validation | MIME + extension allow-list + magic-byte check + 25 MB cap |
| HTML injection | DOMPurify on rich-text fields |
| Headers | Helmet on API; CSP + X-Frame-Options DENY on web |
| Audit trail | 200 rows observed, covering logins, content changes, uploads, backup export |
| Secrets in code | None observed beyond `.env.example` placeholders |
| Default credentials | Seed creates two admin accounts with a **known, documented demo password** (value intentionally not repeated here) — must be rotated; see risk report |

---

## 9. Architecture issues relevant to WordPress migration

1. **Content model is bespoke relational data**, not WordPress-shaped. Products also carry a JSON `specs` string and raw HTML `description`; Company info and Settings are key/value tables. See `WORDPRESS_MIGRATION_MAPPING.md`.
2. **Media is not in a standard library format.** URLs are host-relative and files are UUID-named; the `Media` table is a parallel asset registry. Import into the WordPress Media Library needs a URL rewrite map.
3. **Two database dialects exist.** Production intent is Postgres, current data is SQLite. Dump strategy must target the actual production database, which is **[NOT ACCESSIBLE]**.
4. **No migrations history.** There is no authoritative schema evolution trail; the audit had to read the live SQLite file.
5. **Admin panel has no WordPress equivalent for several features** (audit log, CSV export, media guidance, crop dialog). These need plugin/redevelopment decisions.
6. **Website depends on ISR and client-side forms.** WordPress will need equivalent caching and form handling; enquiry CSV/CRM workflow does not exist natively.

---

## 10. Verified vs unverified checklist

| Item | Status |
|---|---|
| Three apps and their versions | VERIFIED |
| API route inventory | VERIFIED (see `API_ENDPOINTS.md`) |
| 14 database tables + row counts | VERIFIED (local SQLite only) |
| 32 media files + hashes/dimensions | VERIFIED (local uploads only) |
| Local env var names and non-secret states | VERIFIED (see `ENVIRONMENT_VARIABLES.md`) |
| Production domain / hosting plan / Vercel plan | NOT ACCESSIBLE |
| Production database contents | NOT ACCESSIBLE |
| Production uploaded media | NOT ACCESSIBLE |
| DNS, SSL, email deliverability | NOT ACCESSIBLE |
| Analytics, Search Console, Ads accounts | NOT ACCESSIBLE |
| Backup history beyond one `.bak` file | NOT ACCESSIBLE |
