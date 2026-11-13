# CMS Pipeline Fix — Final Report

**Date:** 27 Oct 2026 · **Scope:** Admin panel changes must persist to DB/storage and appear on the live website automatically, with reliable media uploads, verified buttons/messages, and server-side RBAC.

---

## 1. Issues found (root causes)

| # | Issue | Root cause |
|---|-------|-----------|
| **R1** | Uploaded media URLs were `http://localhost:4000/uploads/...` stored in the DB | `LocalStorage.put()` baked `env.PUBLIC_BASE_URL` (defaults to `http://localhost:4000`) into every URL → links only worked on the developer's machine; broke for every visitor in production |
| **R2** | The web app had no route to serve `/uploads/...` | Next.js only proxied `/api/:path*`; media requested at site origin returned 404, and CSP `img-src 'self'` blocked the API origin anyway |
| **R3** | 6 legacy DB rows already contained `localhost:4000` URLs (incl. **live logo + founder photo**) | Rows created before this fix; no normalization existed |
| **R4** | Server components couldn't show a broken-media fallback | Next.js forbids `onError` handlers on elements rendered by server components (`/upcoming` prerender failed); and a 404 that fires *before* hydration never triggers `onError` at all |
| **R5** | `working_hours` existed in DB but was hardcoded on the site; admin had no field for it | Field never surfaced in admin Company page; `AddressMap` used a hardcoded string |
| **R6** | Production misconfig (`PUBLIC_BASE_URL=localhost`, `MAIL_DRIVER=console`) failed silently | No startup warning |
| **R7** | Some mutation buttons could be double-submitted | 4 buttons (Reviews toggle/hide, Enquiries bulk) + 2 reorder `move()` handlers had no `isPending` guard |

---

## 2. Files modified

**Backend**
- `apps/backend/src/lib/storage.ts` — `put()` now returns host-relative `/uploads/${rel}` (+ updated doc comment)
- `apps/backend/src/server.ts` — prod warning when `PUBLIC_BASE_URL` is localhost

**Web (public site)**
- `apps/web/next.config.mjs` — rewrite `/uploads/:path*` → backend (same-origin media proxy)
- `apps/web/src/lib/utils.ts` — new `mediaUrl()` normalizer (legacy absolute → same-origin path)
- `apps/web/src/components/SafeImage.tsx` — **new** client component: broken-image fallback usable from server components; handles both post-hydration `onError` AND pre-hydration 404s (mount-time `complete && naturalWidth===0` check)
- `apps/web/src/components/Header.tsx` — logo via `mediaUrl` + `SafeImage`
- `apps/web/src/components/HeroCarousel.tsx` — banner img/video via `mediaUrl`; `HeroVideo` hides itself on error/pre-load failure
- `apps/web/src/components/FeaturedProducts.tsx` — `SafeImage`
- `apps/web/src/components/UpcomingProducts.tsx` — `SafeImage`
- `apps/web/src/components/GalleryGrid.tsx` — grid + lightbox media via `mediaUrl`; grid via `SafeImage`
- `apps/web/src/components/AboutCompany.tsx` — founder photo via `mediaUrl`
- `apps/web/src/app/products/[slug]/page.tsx` — `SafeImage` + fixed aspect-square container
- `apps/web/src/components/AddressMap.tsx` — reads `company.working_hours` (default fallback kept)

**Admin**
- `apps/admin/src/lib/api.ts` — new `mediaSrc()` (relative → API origin when deployed cross-origin)
- `apps/admin/src/components/ImageUploader.tsx` — preview via `mediaSrc`
- `apps/admin/src/pages/Banners.tsx`, `Gallery.tsx`, `Products.tsx`, `Upcoming.tsx` — previews via `mediaSrc`; `move()` reorder guard
- `apps/admin/src/pages/Company.tsx` — **new "Working Hours" field**
- `apps/admin/src/pages/Navigation.tsx` — `move()` reorder guard
- `apps/admin/src/pages/Reviews.tsx` — toggle/hide buttons guarded
- `apps/admin/src/pages/Enquiries.tsx` — bulk buttons guarded

---

## 3. DB & storage changes

- **Backup taken before any data change:** `apps/backend/prisma/dev.db.bak-cms-20261027-161054` (224 KB)
- **6 legacy rows normalized** (`http://localhost:4000/uploads/…` → `/uploads/…`), then rescanned: **0 localhost rows remain**
  - 4 × `Media.url`, 2 × `CompanyInfo.keyValue` (logo + founder photo)
- **No schema changes.** No rows deleted. One-off scripts removed after running.
- Uploads directory untouched; files still served from `apps/backend/uploads/`.

---

## 4. Fixes delivered

| Fix | What it does |
|-----|--------------|
| **A** | Uploads store host-relative `/uploads/...` → works on any host/env |
| **B** | Next rewrite proxies `/uploads/:path*` → backend → site serves its own media |
| **C** | `mediaUrl()` rewrites any legacy absolute `/uploads/` URL to the site origin (external URLs untouched) |
| **D** | Admin Company page: Working Hours field (save → DB → live) |
| **E** | Contact/homepage map section renders `company.working_hours` |
| **F** | `SafeImage` everywhere → deleted/broken media shows branded placeholder, never a broken-image icon (incl. 404-before-hydration case) |
| **G** | Backend logs a prod warning if `PUBLIC_BASE_URL` is localhost |
| **H** | Admin `mediaSrc()` so previews work even when the SPA is hosted cross-origin |
| **I** | Duplicate-submit guards on all remaining mutation buttons |

---

## 5. Test results (all run against the live stack)

**Static verification**
- Typecheck (backend + web + admin): ✅
- Lint: ✅ 0 errors (2 pre-existing warnings, unrelated)
- Production build (backend + web + admin): ✅

**Upload & media**
- API upload → DB row is `/uploads/cms-test/...` (relative) ✅
- Same file returns **200 image/png** via web :3000, admin :5173, API :4000 ✅
- Failure paths: bad extension **400**, MIME/extension mismatch **400**, oversize 26 MB **400**, no auth **401** ✅
- Admin UI drag-drop upload → appears in library, thumbnail `naturalWidth>0` ✅
- Video upload (1.1 MB `video/mp4`) → replaced hero slide 3 → **video playing** (`paused:false, currentTime:3.24s`) ✅
- Legacy logo/founder thumbnails load after normalization ✅

**Admin → live chain (ISR ~60 s)**
- Banner title change → DB ✅ → API ✅ → live homepage **~10 s** ✅
- Product title + image + slug-preserving edit → API ✅ → detail page ✅ → listing after revalidation ✅
- Working Hours save → DB ✅ → `/` and `/contact` ✅
- Footer copyright → live HTML contains `©` (U+00A9; earlier "c" was console encoding) ✅
- All E2E test data **restored** to originals afterwards ✅

**RBAC**
- `content_editor`: `PUT /admin/settings` → **403**, `GET /admin/users` → **403** ✅
- `super_admin`: settings update → **200** ✅
- Unauthenticated upload → **401** ✅

**Resilience**
- Broken image URL → placeholder shown, `brokenImgs: 0` ✅
- Backend restart → banners hash identical, product/settings/company data + uploaded files all survive ✅
- Fresh browser tab → 0 console errors, correct content, correct font ✅
- Mobile-ready: viewport meta, no horizontal overflow, mobile menu, floating call actions ✅
- Lighthouse: Accessibility **0.96**, Best Practices **1.0**, SEO **0.83**

---

## 6. Not verified / known limitations

- **No real production deployment tested** — only `npm run build` + dev-stack E2E. First prod deploy should confirm: `PUBLIC_BASE_URL` set to the real API origin, `MAIL_DRIVER=smtp`, persistent disk/volume for `uploads/`.
- **Lighthouse SEO 0.83** — failures (contrast ratios, accessible names, missing meta description) are **pre-existing**, unrelated to this work.
- **Postgres enum drift** — project runs SQLite dev DB; Postgres migration path not exercised.
- **9 npm audit vulnerabilities** — need major-version upgrades; deliberately not touched in this fix.
- **Captcha widget gap** and **in-memory rate limiter** (resets on backend restart, per-IP only) are known, pre-existing limitations.
- Server components with `next/image` (About founder) rely on `mediaUrl` but not `SafeImage`; a broken founder photo there would fall back to `next/image`'s default behavior rather than a branded placeholder.

---

**Stack status:** API :4000 ✅ · Web :3000 ✅ · Admin :5173 ✅ (running now)
