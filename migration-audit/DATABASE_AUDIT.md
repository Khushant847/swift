# DATABASE AUDIT — Swift Instruments

**Audit date:** 13 Nov 2026
**Method:** Direct read-only query of `apps/backend/prisma/dev.db` using Node's built-in `node:sqlite` (`readOnly: true`). No writes, no schema changes, no seed runs.
**Database engine:** SQLite (local development file)
**File:** `apps/backend/prisma/dev.db` — 397,312 bytes, last write 2026-11-07 14:50
**Backup present:** `apps/backend/prisma/dev.db.bak-cms-20261027-161054` — 229,376 bytes, 2026-10-27 16:04
**Production database:** **[NOT ACCESSIBLE]** — no Postgres/MySQL instance, connection string, or dump was provided or reachable.

---

## 1. Summary

| Metric | Value |
|---|---|
| Tables | 14 |
| Total rows across all tables | 310 |
| Tables with data | 13 (only `EmailOtp` is empty) |
| Foreign-key relations | 1 (`AuditLog.adminId` → `Admin.id`, `ON DELETE SET NULL`) |
| Prisma migration history | **None** — no `prisma/migrations/` directory; schema is applied with `db:push` |
| Alternate production schema | `schema.postgres.prisma` (same models, Postgres provider, native enums) |

> **Migration warning:** the local SQLite file is a development database. It contains obvious demo data (picsum.photos placeholder images, seeded reviews, a test enquiry titled "Proxy path check"). It must **not** be treated as the production content source without confirming with the owner that no separate production database exists.

---

## 2. Table inventory (row counts verified)

| Table | Rows | Purpose | WordPress equivalent |
|---|---:|---|---|
| `Admin` | 2 | CMS login accounts | `wp_users` |
| `AuditLog` | 200 | Every content/config/login action | No native equivalent (plugin) |
| `CompanyInfo` | 21 | Key/value company profile, contacts, founder, map | `wp_options` / theme settings |
| `EmailOtp` | 0 | One-time MFA codes | No equivalent (plugin) |
| `Enquiry` | 6 | Contact-form submissions / leads | No native equivalent (CF7 entries / CRM plugin) |
| `GalleryMedia` | 8 | Public gallery items | `wp_posts` (attachment) / gallery plugin |
| `HeroBanner` | 3 | Home-page carousel slides | Custom post type / slider plugin |
| `Media` | 32 | Central upload registry | `wp_posts` (`attachment`) + `wp_postmeta` |
| `NavigationLink` | 9 | Header/footer menu links | `wp_posts` (`nav_menu_item`) |
| `Product` | 11 | Products & services catalogue | `wp_posts` (`product` CPT or WooCommerce) |
| `Review` | 4 | Testimonials / Google reviews | Custom post type / plugin |
| `Setting` | 5 | Global site settings | `wp_options` |
| `UpcomingProduct` | 3 | R&D teaser cards | Custom post type |
| `WhyChooseUs` | 6 | USP cards | Theme options / repeater |

**Row counts are verified** from `SELECT COUNT(*)` on the live file. Note: row counts ≠ content quality; see §6.

---

## 3. Schema detail

Prisma IDs are `cuid()` strings. Prisma stores `DateTime` as INTEGER milliseconds in SQLite (visible in the dump as epoch numbers). All timestamps below are UTC.

### 3.1 `Admin`
`id, username, email (unique), passwordHash, role (default content_editor), isActive, mfaEnabled, mfaSecret?, lastLoginAt?, createdAt, updatedAt`

- 2 rows: `admin@swiftinstruments.in` (`super_admin`), `editor@swiftinstruments.in` (`content_editor`).
- Both `isActive = 1`, both `mfaEnabled = 0`.
- Passwords are bcrypt hashes. **`passwordHash` and `mfaSecret` were excluded from the audit dump and are never printed in this report set.**
- **WordPress implication:** bcrypt hashes are not compatible with WordPress' phpass. Users must be migrated with forced password reset, or via a custom bcrypt check plugin.

### 3.2 `AuditLog`
`id, adminId?, adminEmail, action, entity, entityId?, details?, ipAddress?, userAgent?, createdAt`

- 200 rows, span `2026-10-12T09:27Z` → `2026-11-07T09:20Z`.
- Distinct actors: `admin@swiftinstruments.in`, `editor@swiftinstruments.in`, `system`.
- 5 rows have `adminId = NULL` (system-generated actions) — expected because the FK is `ON DELETE SET NULL` / nullable.
- Action distribution (verified):

| action/entity | count |
|---|---:|
| login/auth | 55 |
| update/product | 40 |
| upload/media | 40 |
| update/banner | 16 |
| config/company-info | 16 |
| logout/auth | 14 |
| delete/media | 8 |
| delete/product | 4 |
| create/product | 3 |
| config/settings | 2 |
| update/gallery | 1 |
| export/backup | 1 |

- This is **operational history**, not website content. WordPress has no native audit log; it is not typically migrated. See `MIGRATION_RISK_REPORT.md`.

### 3.3 `CompanyInfo` (key/value)
21 rows, all unique `keyName`:

| Key | Value type | Notes |
|---|---|---|
| `company_name` | text | Swift Instruments |
| `tagline` | text | "…Since 1994" |
| `logo_url` | local `/uploads/...` | resolves to an existing 212×181 PNG |
| `certifications` | JSON array string | `["ISO 9001","NABL","CE","Make in India"]` — **unverified claims** |
| `address` | text | Faridabad, Haryana |
| `phone` / `fax` / `mobile` / `whatsapp` | text | contact data |
| `email` | text | `sales@swiftinstruments.in` |
| `founder_name` | text | Mr. B.V.S. Kashyap |
| `founder_title` | text | Founder & Managing Director |
| `founder_photo` | local `/uploads/...` | 2480×3312 PNG |
| `founder_bio` | HTML | 2 paragraphs |
| `history` | HTML | 2 paragraphs |
| `map_embed` | URL | Google Maps embed |
| `map_url` | URL | `maps.app.goo.gl/...` |
| `established_year` | text | 1994 |
| `employees` | text | `120+` — **unverified** |
| `installations` | text | `15,000+` — **unverified** |
| `working_hours` | text | Mon–Sat 9:30–6:00 |

**[VERIFIED]** Keys are free-form; there is no whitelist enforced at the schema level, so WordPress custom fields / options must be mapped explicitly.

### 3.4 `Setting` (key/value, 5 rows)
| Key | Purpose |
|---|---|
| `enquiry_recipients` | Comma-separated lead recipients (`sales@…,admin@…`) |
| `footer_text` | Footer marketing sentence (contains ISO 9001 claim) |
| `copyright` | © 1994–2026 line |
| `legal_disclaimer` | Specification-change disclaimer |
| `social_links` | JSON array of `{label,url,icon}` — **URLs are generic home pages** (`linkedin.com`, `facebook.com`, `instagram.com`, `youtube.com`), not brand profiles |

### 3.5 `Product` (11 rows)
Fields: `id, title, slug (unique), category, shortDesc?, description (HTML), imageUrl?, specs (JSON string), isFeatured, isActive, createdAt, updatedAt`

**Verified catalogue:**

| Slug | Title | Category | Featured | Image | Description |
|---|---|---|---|---:|---|
| `utility-table` | Utility Table | `"Utility "` (trailing space) | yes | local PNG | HTML |
| `laminar-air-flow-iui-ivf-usage-size-2x3-ft` | Laminar Air Flow I.U.I & I.V.F Usage Size - 2x3 Ft | Laboratory Instruments | yes | local PNG | HTML |
| `digital-heating-incubator` | Digital Heating Incubator | Laboratory Instruments | yes | local PNG | HTML |
| `laminar-air-flow-ivf-usage-size-2x4-ft` | Laminar Air Flow  I.V.F Usage  Size - 2x4 ft | Laboratory Instruments | yes | local PNG | HTML |
| `laminar-air-flow-iui-usage-size-2x2-ft` | Laminar Air Flow I.U.I USAGE Size - 2x2 Ft | Laboratory Instruments | yes | local PNG | HTML |
| `laminar-air-flow-ivf-work-station-2ftx6ft` | Laminar Air Flow  I.V.F Work Station  (2ftx6ft) | Laboratory Instruments | no | local PNG | HTML |
| `centrifuge` | Centrifuge | Laboratory Instruments | no | local PNG | HTML |
| `test-tube-warmer` | Test Tube Warmer | Laboratory Instruments | no | local PNG | HTML |
| `positive-pressure-clean-air-module-ppm` | Positive Pressure / Clean Air Module (PPM) | Air Purifier | no | local PNG | HTML |
| `clean-air-system-air-purifier` | Clean Air System (Air Purifier) | Air Purifier | no | local PNG | HTML |
| `anti-vibration-table` | Anti Vibration Table | Laboratory Instruments | no | local PNG | HTML |

- 5 featured, 11 active, 0 inactive **[VERIFIED]**.
- Categories observed: `Laboratory Instruments` (8), `Air Purifier` (2), `"Utility "` (1) — the trailing space is a real data bug.
- `createdAt` range: 2026-10-01 → 2026-11-04. `updatedAt` range: 2026-11-04 → 2026-11-07.

### 3.6 `HeroBanner` (3 rows)
Fields: `id, title?, subtitle?, ctaLabel?, ctaUrl?, mediaUrl, mediaType, displayOrder, intervalSeconds, isActive, createdAt`

| Order | Title | Media | CTA |
|---:|---|---|---|
| 0 | Engineering Accuracy You Can Trust | `/uploads/banners/76e0…jpg` (1584×396) | About Swift Instruments → `/about` |
| 1 | Inside Our Manufacturing Facility | `/uploads/banners/8eb7…png` (1600×900) | View Gallery → `/gallery` |
| 2 | Precision Weighing Instruments | `/uploads/banners/d2c9…png` (1584×396) | Explore Products → `/products` |

All active. 9 media files exist in the `banners` folder; only 3 are referenced (see `MEDIA_INVENTORY.md`).

### 3.7 `WhyChooseUs` (6 rows)
`id, title, description, icon (lucide name), displayOrder, isActive`
Titles: ISO 9001 Certified, In-house Calibration, 25+ Years Experience, Nationwide Service, Custom Engineering, Rapid Support. All active. The ISO/NABL claims are **unverified**.

### 3.8 `UpcomingProduct` (3 rows)
`id, title, teaserDesc, expectedLaunch, imageUrl?, displayOrder, isActive, createdAt`
All 3 active, all images are **external `picsum.photos` placeholders**, all `expectedLaunch = "Coming soon"`.

### 3.9 `GalleryMedia` (8 rows)
`id, mediaUrl, mediaType, categoryTag, caption?, uploadedAt`
7 images from `picsum.photos`, 1 video from `mdn.github.io/shared-assets` — **all external placeholders**. Tags used: Lab, Office, Team, Events. No `isActive` column (unlike other content tables), so there is no soft-hide support.

### 3.10 `Review` (4 rows)
`id, authorName, rating, text, profilePhotoUrl?, source, googleReviewId?, isFeatured, isHidden, reviewTime`

| Author | Rating | Featured | Source |
|---|---:|---:|---|
| Dr. Ananya Rao | 5 | yes | manual |
| Vikram Mehta | 5 | yes | manual |
| Priya Nair | 4 | no | manual |
| Rakesh Gupta | 5 | yes | manual |

All reviews are seed/demo content (`source = manual`, all created at the same seed timestamp). None are verified customer reviews. `googleReviewId` is null for all rows, so the Google Places sync has never populated this table.

### 3.11 `Enquiry` (6 rows)
`id, name, email, phone, companyName?, subject?, message, status, notes?, ipAddress?, createdAt, updatedAt`
Statuses: `new` (4), `contacted` (1), `closed` (1). Date range 2026-10-12 → 2026-10-27.
Subjects indicate a mix of real-looking demo leads ("Analytical balance quote", "AMC enquiry", "Bulk pricing", "QC lab query") and **test submissions** ("Post-fix verification", "Proxy path check").
PII (names, emails, phones, message bodies) is intentionally **not reproduced** in this audit. 3 rows have `ipAddress` set; 3 are null.

### 3.12 `Media` (32 rows)
`id, url, filename, originalName, mimeType, size, folder, tags?, width?, height?, uploadedAt`
- Folders: `products` 17, `banners` 9, `branding` 2, `team` 2, `general` 1, `cms-test` 1.
- Every `Media.url` has a matching file on disk; every file on disk has a `Media` row **(0 mismatches)**.
- `width`/`height` are `NULL` for every row — the DB never stored dimensions even though `sharp` is available; the audit measured them directly from files.
- Includes test artefacts (`cms-test/test-upload.png` = 70 bytes, `general/cms-e2e-ui-upload.png` = 68 bytes) that should not survive migration.

### 3.13 `EmailOtp` (0 rows)
Empty. Email-OTP MFA has never been used. No content to migrate.

### 3.14 `NavigationLink` (9 rows)
| Location | Position | Title | URL |
|---|---:|---|---|
| header | 0 | Home | `/` |
| header | 1 | Products & Services | `/products` |
| header | 2 | About Us | `/about` |
| header | 3 | Upcoming Products | `/upcoming` |
| header | 4 | Gallery | `/gallery` |
| header | 5 | Contact Us | `/contact` |
| footer | 0 | Privacy Policy | `/privacy` |
| footer | 1 | Terms of Service | `/terms` |
| footer | 2 | Sitemap | `/sitemap` |

No `parentId` usage — the menu is flat (2 levels max in the schema, but unused).

---

## 4. Relations and integrity

- Only declared relation: `AuditLog.admin` → `Admin` (`onDelete: SetNull`). All other tables are independent — there are **no foreign keys** between products, media, gallery, banners, or reviews.
- Consequence: deleting a media row does not check whether a product still references that URL. **[VERIFIED]** currently 16 local files are referenced by content and 16 are not (see media report).
- No unique constraint on `Media.url` or `Media.filename`, so duplicate physical files exist (3 duplicate hash groups).

---

## 5. JSON-in-text fields

| Field | Format | Risk |
|---|---|---|
| `Product.specs` | JSON array `[{label,value}]` | Some values contain escaped quotes and **tab characters**; two rows have corrupted/duplicated labels (see §6) |
| `CompanyInfo.certifications` | JSON array of strings | Invalid JSON silently hides all badges |
| `Setting.social_links` | JSON array `{label,url,icon}` | Generic URLs |
| `AuditLog.details` | JSON diff summary | Operational only |

---

## 6. Data-quality findings (verified)

| # | Finding | Where | Impact |
|---|---|---|---|
| D1 | Category `"Utility "` has a trailing space | Product `utility-table` | Creates a phantom category filter in the website and admin; WordPress taxonomy import will create a duplicate term unless trimmed |
| D2 | Corrupted spec label `"Product\tUtility" = "Table"` | `utility-table` | Renders a broken row on the product page |
| D3 | Duplicated / mismatched spec rows | `centrifuge` has two `Dimensions` labels and appended "Standard Block / Tube Capacity" rows that belong to a dry bath | Wrong technical data shown to customers |
| D4 | Slug/content mismatch | `test-tube-warmer` title is "Test Tube Warmer" but its description and specs are for a **Digital Dry Bath Incubator (SW/DB01)** | Wrong product page content; must be corrected before migrating |
| D5 | Escaped quotes and tabs inside spec values | 7 products | Cosmetic/rendering defects after any re-import that re-encodes JSON |
| D6 | Descriptions are raw HTML (with editor-specific `<span>` classes, e.g. `a_GcMg font-feature-…`) | 11 products, founder bio, history | Must be sanitised/mapped to Gutenberg blocks; junk classes should be stripped |
| D7 | Demo/placeholder media | 8 gallery items + 3 upcoming products use picsum / MDN URLs | Cannot be migrated as brand assets; must be replaced with real photos |
| D8 | Unverified claims | `certifications`, `employees`, `installations`, footer text, banners, why-choose-us | Legal/compliance risk if migrated as-is |
| D9 | Test artefacts in media library | `cms-test/`, `general/` tiny PNGs | Should be dropped |
| D10 | `Media.width/height` all null | Media table | Any WordPress import must re-derive dimensions |
| D11 | Generic social links | Setting `social_links` | Footer icons currently link to platform home pages |
| D12 | Gallery has no `isActive` field | GalleryMedia | No way to hide an item without deleting it; WordPress draft status will add this capability |
| D13 | Enquiry contains test submissions | Enquiry "Post-fix verification", "Proxy path check" | Do not migrate test rows into the production CRM |
| D14 | Two admin accounts with known seed password | Admin | Must not be migrated with the same credentials; force reset |

---

## 7. SQLite → MySQL/Postgres conversion notes

| Concern | Detail |
|---|---|
| Booleans | Stored as `0/1` integers; MySQL `TINYINT(1)` compatible |
| Datetimes | Stored as **epoch milliseconds**; a naive import into `DATETIME` columns will fail or produce year-57372 values |
| IDs | 25-char cuid strings — plan `VARCHAR(30)` keys or remap to auto-increment |
| JSON strings | Keep as `LONGTEXT`/`JSON` but sanitise first (D2–D5) |
| Case sensitivity | SQLite `contains` is case-insensitive for ASCII; MySQL collation defaults also CI, Postgres is CS. Search behaviour may change |
| Enum-like strings | `role`, `status`, `location`, `mediaType`, `source` are plain strings locally, native enums in `schema.postgres.prisma` |
| Postgres schema drift | `schema.postgres.prisma` was not verified against the live SQLite schema field-by-field in this audit; validate before use |

---

## 8. Backups and exports required before migration

1. **Copy the database file** `apps/backend/prisma/dev.db` (and the existing `.bak`) to at least two locations, with a checksum recorded.
2. **Logical export** of every table as JSON + CSV (products, company info, settings, nav, banners, why, upcoming, gallery, reviews, media, enquiries, admins sans hashes, audit logs).
3. **Media archive** of `apps/backend/uploads/` with SHA-256 manifest (the audit produced one — see `MEDIA_INVENTORY.md`).
4. **Env file copies** stored in a password manager, not in the repo (`ENVIRONMENT_VARIABLES.md` lists keys only).
5. **Production database dump** — still missing; must be obtained before any migration plan is finalised.

---

## 9. Access status

| Item | Status |
|---|---|
| Local SQLite DB | Accessible, read-only queried |
| Local `.bak` file | Present, not opened (presumed older snapshot) |
| Production database | **NOT ACCESSIBLE** |
| Database credentials | Not requested/printed |
| Prisma migrations folder | Does not exist |
| Seed file | Accessible — `apps/backend/prisma/seed.ts` (demo content; founder name differs from live DB: `S. K. Sharma` in seed vs `Mr. B.V.S. Kashyap` in DB) |
