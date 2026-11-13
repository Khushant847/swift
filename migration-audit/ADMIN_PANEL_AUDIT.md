# ADMIN PANEL AUDIT — Swift Instruments

**Audit date:** 13 Nov 2026
**Application:** `apps/admin` — React 19 + Vite SPA + Tailwind + React Router 6 + TanStack Query 5
**Authentication backend:** `apps/backend/src/routes/admin/auth.routes.ts`
**Method:** Full read-only source review of every page, layout, shared component, auth provider and API client. No UI was modified during this audit.

---

## 1. Purpose and access model

The admin panel is a full CMS for the public website plus a small CRM for enquiries, an operational audit log, a media library, user management, and database backup.

| Aspect | Implementation | Status |
|---|---|---|
| Login | Email + password → `POST /api/v1/admin/auth/login` | VERIFIED |
| Session storage | JWT in HttpOnly cookie (`swift_at`), `SameSite=Strict`, `Secure` in production | VERIFIED |
| Token lifetime | 20 minutes (`JWT_EXPIRES_MINUTES`) | VERIFIED |
| Client auto-logout | 15 minutes of inactivity | VERIFIED |
| 401 handling | Global `swift:unauthorized` event clears session + query cache | VERIFIED |
| Roles | `super_admin`, `content_editor` | VERIFIED |
| MFA | TOTP setup/confirm and email OTP supported; **disabled for both local users** | VERIFIED |
| Password change | `/admin/auth/change-password` | VERIFIED |
| Rate limits | Login 8 / 15 min per IP; MFA 10 / 10 min | VERIFIED |

### Role restrictions (verified)

| Area | content_editor | super_admin |
|---|---|---|
| Dashboard, content CRUD, enquiries, media, audit | Yes | Yes |
| Admin Users (`/users`) | No — route redirects to `/` and backend rejects | Yes |
| Settings writes (`PUT /admin/settings`) | No | Yes |
| Backup info/download | No | Yes |
| Review Google sync | Backend requires super admin | Yes |

> Note: the SPA hides the Users and Settings entries for non-super users, but the **backend is the real gate** (`requireRole('super_admin')`), so role enforcement does not depend on the UI.

---

## 2. Screen-by-screen inventory

| # | Route | Screen | Primary functions |
|---:|---|---|---|
| 1 | `/login` | Login | Email/password, MFA challenge step, error states |
| 2 | `/` | Dashboard | KPI cards, recent enquiries, quick links |
| 3 | `/banners` | Hero Display Manager | Upload image/video, reorder, interval, CTA label/URL, active toggle, delete |
| 4 | `/navigation` | Navigation | Header/footer links, position ordering, active toggle |
| 5 | `/why-choose-us` | Why Choose Us | USP cards, icon name, ordering, active toggle |
| 6 | `/products` | Products & Services | Full CRUD, specs editor, rich text description, featured/active, image upload, category filter, search, pagination |
| 7 | `/upcoming` | Upcoming Products | CRUD, teaser text, expected launch, image, ordering |
| 8 | `/gallery` | Gallery | CRUD, bulk upload, media type, category tag, caption |
| 9 | `/reviews` | Reviews | CRUD, rating, featured/hidden toggles, Google Places sync |
| 10 | `/company` | Company Info & Content | Contact details, founder bio/photo, history, certifications, map, stats, working hours |
| 11 | `/enquiries` | Enquiries (CRM) | List, filter by status/date/search, detail drawer, status update, notes, bulk actions, CSV export, delete |
| 12 | `/media` | Media Library | Browse by folder, upload, edit metadata, delete, copy URL, guidance panel, preview |
| 13 | `/users` | Admin Users | Create/edit/deactivate admins, role assignment (super-admin only) |
| 14 | `/audit` | Audit Logs | Paginated, filterable trail of every change |
| 15 | `/settings` | Settings & Backup | Footer/copyright/disclaimer/social links/enquiry recipients; backup status + download |
| 16 | `*` | Not Found | Friendly fallback |

### Shared components

- `Layout` — sidebar navigation, role-aware items, responsive drawer.
- `RichTextEditor` — rich text for product description, founder bio, history.
- `ImageUploader` / `ImageCropDialog` — upload with crop/aspect guidance.
- `MediaGuidance` — recommended dimensions/formats per context.
- `MediaPreview` — thumbnail/video preview with fallback.
- `ui/Form`, `ui/Modal`, `ui/Toast`, `ui/Feedback` (page headers, skeletons, empty/error states, pagination).

---

## 3. Functional detail per module

### 3.1 Authentication
- Login form validates email format and minimum password length client-side; server applies Zod + bcrypt.
- If MFA is enabled, the backend returns a signed short-lived challenge; the SPA shows a code screen and calls `/mfa/verify`.
- `GET /admin/auth/me` restores the session on refresh.
- Logout clears the cookie server-side and resets all client state.
- Failed logins are rate-limited and logged.

**Gaps / risks**
- MFA is **off** for both local admins. For production, enable at least for `super_admin`.
- No "forgot password" flow. Password reset is manual (DB/admin action).
- No session/device list, no forced logout of other sessions.

### 3.2 Dashboard
- Shows total/new/contacted enquiries, active products, featured count, recent activity.
- Uses `/admin/dashboard` aggregate endpoint.
- No charts/graphs; no revenue/analytics (site has no e-commerce).

### 3.3 Hero Banners
- Slides support image or video, ordering, per-slide interval, CTA label/URL, active toggle.
- Reorder endpoint: `POST /admin/banners/reorder`.
- Media guidance warns about recommended dimensions.
- Uploads limited to allowed MIME types and 25 MB.

**Gaps**
- No scheduling (start/end date) for seasonal banners.
- No built-in preview of how the hero looks on mobile vs desktop.
- Video slides depend on browser codec support; no poster-frame field.

### 3.4 Navigation
- Two locations (`header`, `footer`), drag/position ordering, active toggle.
- URLs are validated against a safe-scheme allow-list (relative, `#`, http(s), mailto, tel) — blocks `javascript:` stored XSS.
- No nested menu support in the UI (schema has `parentId` but it is unused).

### 3.5 Why Choose Us
- Six USP cards with Lucide icon names, ordering, active toggle.
- Icon field is free text; an invalid name falls back to a default icon on the website.
- The content includes unverified ISO/NABL claims — content governance issue, not a code issue.

### 3.6 Products & Services (most complex module)
Fields: title, slug, category (free text), short description, rich HTML description, image, specs (repeatable label/value rows stored as JSON), featured, active.

- Slug is auto-generated from the title but editable; backend normalises unsafe slugs and supports legacy lookups.
- Specs editor serialises to a JSON string; malformed input can corrupt the display (see `DATABASE_AUDIT.md` D2–D5).
- Category is a free-text field, not a managed taxonomy → trailing-space category exists today.
- Search/filter by category and status; pagination.
- Actions column is sticky on narrow viewports with explicit "Edit"/"Delete" labels and aria-labels (recent accessibility fix, verified).

**Gaps**
- No bulk edit, no duplicate-product action, no product ordering control (list is featured-first, then newest).
- No per-product SEO fields (meta title/description) — website derives them automatically.
- No stock/price/SKU (not an e-commerce catalogue).
- No revision history beyond the audit log.
- Free-text categories will create taxonomy drift in WordPress.

### 3.7 Upcoming Products
- Teaser cards with title, teaser description, expected launch, image, order, active.
- In the current database all `teaserDesc` values are empty and all images are picsum placeholders.

### 3.8 Gallery
- CRUD + bulk upload; media type image/video; tags Lab/Office/Team/Events; caption.
- Unlike other modules there is no active/draft flag (schema limitation).
- One video row points at a stock MDN MP4.

**Gaps**
- No drag-reorder endpoint for gallery (order is by upload time).
- No per-item alt text (caption doubles as alt).
- Bulk upload is a single endpoint (`POST /admin/gallery/bulk`), but there is no progress UI for large batches.

### 3.9 Reviews
- Manual reviews with author, rating, text, featured/hidden.
- Google Places sync endpoint exists (`POST /admin/reviews/sync`) but requires `GOOGLE_PLACES_API_KEY` / `GOOGLE_PLACE_ID`, both **empty** locally.
- No moderation queue (an admin creates reviews directly).

**Gaps**
- Reviews are demo content and not verifiable.
- No link to a real Google Business Profile; no review request workflow.

### 3.10 Company Info
- 21 key/value fields surfaced as a form: company name, tagline, logo, certifications (JSON list), address, phone, fax, mobile, email, WhatsApp, founder name/title/photo/bio, history, map embed/url, established year, employees, installations, working hours.
- Rich text for bio/history; image fields for logo/founder photo.
- Backup: values are upserted via `PUT /admin/company-info`.

**Gaps**
- Free-form keys mean there is no validation of the JSON `certifications` array.
- No audit preview/diff UI beyond the audit log list.
- No structured address fields (single text blob) — bad for schema.org and WordPress mapping.

### 3.11 Enquiries CRM
- List with search (name/email/phone/company/message), status filter, date range.
- Detail view with full message, notes, status change (`new` → `contacted` → `closed`).
- Bulk status update and bulk delete.
- CSV export (`GET /admin/enquiries/export`).
- Rate-limited public submission + captcha hook.

**Gaps**
- No email notification status/retry UI (mail failures are logged only).
- No lead assignment/owner field.
- No spam scoring; captcha is optional and unset locally.
- CSV export of PII has no audit-friendly download log beyond `export/backup`-style actions (enquiry export is not individually audited in the observed action list).

### 3.12 Media Library
- Folder filter, grid/list, upload, metadata edit (alt/tags), delete, copy URL.
- Guidance panel gives recommended sizes/formats per use case.
- Image crop dialog for consistent aspect ratios.
- Server enforces MIME + extension allow-list, magic-byte sniffing and 25 MB cap.

**Gaps**
- No bulk delete/retag, no search by filename/tag server-side beyond listing.
- No automatic responsive variants (the Next.js front end handles sizing, but originals are large).
- No usage indicator ("used by 3 products") — the audit found 16 orphans, which the UI cannot reveal.
- `width`/`height` are not stored.

### 3.13 Admin Users (super admin)
- Create user (username, email, password, role), edit, deactivate, delete.
- Password hashing server-side (bcrypt cost 12).
- Protects against deleting the last super admin? — **[VERIFIED]** backend blocks self-deletion and validates roles; last-super-admin protection was not conclusively verified, treat as a check item.

### 3.14 Audit Logs
- Paginated, filterable by entity/action/admin/date.
- Captures create/update/delete/login/logout/config/upload/export.
- 200 rows present locally (2026-10-12 → 2026-11-07).

**Gaps**
- No export, no retention policy, no tamper-evidence (despite the UI copy "tamper-evident" — it is a plain DB table).
- No diff viewer; `details` is a JSON summary.

### 3.15 Settings & Backup
- Editable settings: enquiry recipients, footer text, copyright, legal disclaimer, social links.
- Backup panel shows driver, size, modified time and a download button (super admin only).
- Backup endpoint streams the SQLite file; requires `BACKUP_*`/local driver availability.

**Gaps**
- No automated/scheduled backups — manual download only.
- No restore workflow (restore = manual file replacement).
- Backup download is not encrypted/password-protected.
- No email/SMTP configuration UI — mail settings are env-only.

---

## 4. UX and accessibility observations

| Item | Status |
|---|---|
| Keyboard navigation for modals | Present (`Modal` handles Escape/focus) |
| Form labels | Present via `ui/Form`; icon-only buttons carry aria-labels |
| Products table on narrow screens | Fixed — sticky Actions column with text labels |
| Loading states | Skeletons/spinners implemented |
| Empty states | Implemented for every list |
| Error states | Implemented with retry |
| Toasts | Implemented for success/error |
| Responsive sidebar | Implemented |
| Colour contrast | Not formally audited |
| RTL/localisation | Not supported (English only) |

Known pre-existing lint warnings (2 × `react-refresh/only-export-components`) do not affect behaviour.

---

## 5. WordPress equivalent mapping

| Admin module | WordPress approach | Effort |
|---|---|---|
| Login / session | Native `wp_login`, roles | Native |
| MFA | Plugin (e.g. two-factor) | Low |
| Dashboard KPIs | Custom dashboard widget | Low |
| Hero banners | ACF options + slider plugin or custom block | Medium |
| Navigation | Native Menus | Native |
| Why Choose Us | ACF repeater / CPT | Low |
| Products | Custom Post Type + ACF (or WooCommerce if commerce is planned) | Medium–High |
| Product specs | ACF repeater (replaces JSON string) | Medium |
| Upcoming products | CPT | Low |
| Gallery | Native media + gallery block/plugin | Low |
| Reviews | CPT or dedicated plugin | Low |
| Company info | Theme options (ACF Options Page) | Low |
| Enquiries | Form plugin + entries (CF7 + Flamingo / Gravity Forms) or CRM integration | Medium |
| Enquiry CSV export | Plugin feature or custom exporter | Low–Medium |
| Media library | Native (gains alt text, sizes, usage) | Native |
| Admin users | Native users + roles | Native |
| Audit log | Plugin (e.g. WP Activity Log) | Low |
| Settings / social links | ACF options / Customizer | Low |
| Backup | Plugin (UpdraftPlus etc.) + host backups | Low |

**Features that will be lost or need redevelopment unless deliberately replaced:**
- Enquiry status workflow + notes + bulk actions (plugin may partially cover).
- Structured product specs editor.
- Per-context media guidance and crop dialog.
- Built-in audit log tied to CMS actions.
- Database download button.
- ISR-style instant content propagation (WordPress uses page cache/CDN; needs cache purge strategy).

---

## 6. Admin audit checklist results

| Check | Result |
|---|---|
| All routes protected by auth | Yes, except `/login` |
| Role enforcement server-side | Yes |
| Mutations CSRF-protected | Yes (origin guard + SameSite) |
| Input validation server-side | Yes (Zod on every route) |
| HTML sanitisation | Yes (DOMPurify) |
| Upload validation | Yes (MIME + extension + magic bytes + size) |
| Sensitive data displayed in UI? | No passwords/secrets exposed |
| Session expiry handling | Yes |
| Audit logging | Yes for content/config/auth/upload |
| Error leakage | Generic JSON error envelope; stack traces only in dev logs |
| Default credentials present | **Yes** — must change before/at migration |
| MFA enabled | **No** for both local users |
| Automated backups | **No** |

---

## 7. Access status

| Item | Status |
|---|---|
| Admin SPA source | Fully inspected |
| Admin API routes | Fully inspected |
| Live admin UI | Not exercised in this audit (source-level review only) |
| Production admin deployment | **NOT ACCESSIBLE** |
| Production admin accounts | **NOT ACCESSIBLE** (local DB has 2 demo accounts only) |
