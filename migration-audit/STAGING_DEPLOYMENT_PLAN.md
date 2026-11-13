# STAGING DEPLOYMENT PLAN — Pure WordPress

**Phase:** 0 — Plan only. **Nothing in this document has been executed.**
**Date:** 13 Nov 2026
**Target architecture:** Pure WordPress (PHP + MySQL) on standard shared hosting, with a separate staging subdomain.
**Hard rule:** The staging environment must not read from, write to, or otherwise affect the current live website or its data.

---

## 1. Objectives

1. Build a **disposable, isolated** WordPress site at `staging.<domain>`.
2. Prove the theme, CPTs, ACF fields, forms, redirects and SEO behave correctly on **dummy content** before any real content is imported.
3. Keep production untouched until a written GO decision.
4. Produce a repeatable build (scripts + documented steps) so the site can be rebuilt from scratch.
5. Make rollback trivial: deleting the staging subdomain + DB must not affect production.

**Non-goals:** importing production data, changing DNS on the main domain, cut-over, SEO submission, email migration.

---

## 2. Environment topology

```
                        ┌───────────────────────────────┐
  Internet ───────────► │ main domain (production)      │  ← UNTOUCHED in Phase 0/1
                        │ current live site              │
                        └───────────────────────────────┘

                        ┌───────────────────────────────┐
  Authorised users ───► │ staging.<domain>              │
  (HTTP auth + noindex) │ separate docroot              │
                        │ separate WordPress install    │
                        │ separate MySQL DB + DB user   │
                        │ separate wp-content/uploads   │
                        │ separate salts + admin users  │
                        └───────────────────────────────┘
```

**Why a subdomain, not a subfolder:** a subfolder staging site shares the production docroot, `.htaccess`, uploads and often the DB prefix. A subdomain with its own docroot prevents accidental cross-writes and lets staging run a different PHP version.

### 2.1 Isolation matrix

| Resource | Production | Staging | Shared? | Enforcement |
|---|---|---|---|---|
| Hostname | `<domain>` / `www` | `staging.<domain>` | No | Separate vhost/docroot |
| Document root | `public_html/` | `staging.<domain>/` or `public_html/staging/` **outside** prod root | No | Panel config |
| WordPress files | `public_html/` | `staging/` | No | Separate install |
| Database | `wp_prod` | `wp_staging` | **No** | Separate DB name + user |
| DB user | `wp_prod_user` | `wp_stg_user` | **No** | Least privilege, per-DB grant |
| `$table_prefix` | `wp_` | `stg_` | No | Extra guard against cross-import |
| `wp-content/uploads` | `wp-content/uploads` | `staging/wp-content/uploads` | **No** | Separate paths |
| `wp-config.php` salts | unique | **different** unique | No | Regenerate |
| Admin accounts | named humans | separate staging admins | No | Different emails/passwords |
| SMTP | production mailbox | **sink/disabled** (or test mailbox) | No | Staging must not email customers |
| Analytics/GA4 | live property | **disabled** | No | No tracking on staging |
| Search Console | production property | none | No | `noindex` + HTTP auth |
| Cron | real cron | real cron, separate schedule | No | Different hook/URL |
| Backups | production schedule | staging schedule | No | Separate destinations |
| Caching | production config | disabled during dev | No | Avoid stale QA |
| Payments/CRM/webhooks | live | **disabled** | No | No outbound side effects |

**Isolation test (must pass before any import):** from staging, attempt to connect to the production DB — it must fail. Production must show no new rows, files or logs during a staging test window.

---

## 3. Prerequisites (blocking)

| # | Prerequisite | Source | Blocks |
|---|---|---|---|
| 1 | Owner confirms source of truth (PR-01) | Owner | Content import only — **not** scaffolding |
| 2 | Hosting plan passes `HOSTING_REQUIREMENTS.md` §7 | Hosting admin | Everything |
| 3 | Subdomain creation + SSL | Hosting panel | Everything |
| 4 | Separate DB + DB user created | Hosting panel | Install |
| 5 | SSH/WP-CLI **or** approved panel alternative | Hosting panel | Build speed/automation |
| 6 | Staging protection method (HTTP auth / IP allowlist) | Hosting panel | Exposure risk |
| 7 | Theme/plugin register approved | Owner | Plugin installs |
| 8 | Content model approved (CPTs, fields) | Owner | Theme build |
| 9 | Dummy content pack prepared | Migration lead | Design QA |
| 10 | Backup plan acknowledged | Owner | Safety |

Phase 1 **scaffolding** may start with items 1, 7, 8 open. **Content import** requires all ten.

---

## 4. Build sequence (Phase 1 — not started)

### Step 0 — Freeze and record
- Record production state (read-only): URL, DNS snapshot, screenshot, current plugin/theme list if WordPress already exists.
- Create a Phase 0 backup per `BACKUP_PLAN.md` (B1–B5) before any work.
- Announce a no-production-change window.

### Step 1 — Create the subdomain
1. Panel → Domains → Subdomains → `staging`.
2. Point docroot to a **new empty folder**, not the production root.
3. Enable Let's Encrypt/auto SSL for the subdomain.
4. Force HTTPS.
5. Confirm `https://staging.<domain>` returns an empty page (no production content).

### Step 2 — Create the database
1. New DB `wp_staging`, charset `utf8mb4`.
2. New user `wp_stg_user` with a strong generated password stored in a password manager.
3. Grant privileges **only** on `wp_staging`.
4. Record DB name/user (never the password) in the build log.

### Step 3 — Install WordPress
Preferred (SSH):
```bash
cd ~/staging.<domain>
wp core download --version=<pinned> --locale=en_US
wp config create --dbname=wp_staging --dbuser=wp_stg_user --dbpass=<prompt> \
  --dbhost=localhost --dbprefix=stg_ --extra-php <<'PHP'
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
define('DISALLOW_FILE_EDIT', true);
define('WP_ENVIRONMENT_TYPE', 'staging');
PHP
wp core install --url=https://staging.<domain> --title="Swift Instruments — Staging" \
  --admin_user=<staging_admin> --admin_email=<owner+staging@…> --prompt=admin_password
```
Panel alternative: use the host's WordPress installer, then add the `wp-config.php` constants manually.

Install checklist:
- [ ] `WP_ENVIRONMENT_TYPE=staging`
- [ ] `WP_DEBUG` on, log outside webroot
- [ ] `DISALLOW_FILE_EDIT` true
- [ ] Unique salts (`wp config shuffle-salts`)
- [ ] Permissions: dirs 755, files 644, `wp-config.php` 600/640
- [ ] Default "Hello World" post/page/comment removed
- [ ] Timezone `Asia/Kolkata`
- [ ] Permalinks `/%postname%/`
- [ ] Discourage search engines **on**
- [ ] No production email configured

### Step 4 — Protect staging
1. HTTP Basic auth on the whole subdomain (`.htpasswd` outside webroot) **or** host staging tool **or** IP allowlist.
2. `X-Robots-Tag: noindex, nofollow` header.
3. `robots.txt` disallow all (defence in depth only — not a security control).
4. Verify: incognito request → 401; logged-in staging admin → 200.
5. Confirm search engines cannot index (no Search Console property, no sitemap submission).

### Step 5 — Plugin baseline
Install the minimum approved set (final list requires owner approval):

| Purpose | Candidate | Required? | Notes |
|---|---|---|---|
| Custom fields | ACF Pro **or** Meta Box | Yes | Licence key in vault |
| SEO | Yoast SEO **or** Rank Math | Yes | One only, never both |
| Forms | Fluent Forms / WPForms / Gravity Forms | Yes | Must support file upload + spam protection |
| Spam | Cloudflare Turnstile / honeypot | Yes | No third-party tracking by default |
| SMTP | WP Mail SMTP / FluentSMTP | Yes | Staging → test mailbox only |
| Redirects | Redirection | Yes | Import legacy map later |
| Backups | UpdraftPlus / BlogVault / host tool | Yes | Destination outside webroot |
| Security | Wordfence / Solid Security | Optional | Avoid duplicate WAFs |
| Caching | LiteSpeed Cache / WP Super Cache | Optional in dev | Enable for perf QA |
| Media optimisation | ShortPixel / Imagify | Optional | WebP/AVIF derivatives |
| Activity log | Simple History | Optional | Replaces `AuditLog` feature |
| Duplicator/Migrate | All-in-One WP Migration / Duplicator | Optional | For staging→prod later |

**Rules:** no page builder (Elementor/Divi/WPBakery), no nulled plugins, pin versions, record licence ownership, one plugin per job, delete rather than deactivate unused plugins.

### Step 6 — Theme architecture

**Recommendation: custom hybrid theme** — classic PHP templates + `theme.json` + ACF + block patterns. No page builder.

```
wp-content/themes/swift-instruments/
  style.css                 # theme header + design tokens
  functions.php             # setup, enqueue, CPT/taxonomy includes
  theme.json                # colours, spacing, typography, editor styles
  inc/
    cpt.php                 # product, review, gallery, upcoming (if CPT needed)
    taxonomies.php          # product_category, application, etc.
    acf-fields.php          # field group registration (JSON sync)
    security.php            # headers, disable XML-RPC (if unused), hardening
    seo.php                 # meta fallback, schema hooks
    performance.php         # preload, defer, image sizes
  templates/
    front-page.php
    page-about.php
    page-contact.php
    archive-product.php
    single-product.php
    taxonomy-product_category.php
    search.php
    404.php
  parts/
    header/ footer/ hero/ product-card/ cta/ breadcrumbs/
  patterns/                 # reusable Gutenberg patterns for page sections
  assets/
    css/ js/ img/ fonts/
  acf-json/                 # version-controlled field groups
```

**Why not a block theme (FSE) now?** The design is component-heavy (hero, USP grid, product specs, gallery, enquiry form) and needs tight control over markup. A hybrid theme keeps PHP templates predictable, still allows Gutenberg editing of page sections, and is easier to test for SEO/HTML parity. This can be revisited after Phase 1 QA.

**Content model to implement (per `WORDPRESS_MIGRATION_MAPPING.md`):**
- CPT `product` → `single-product.php`, archive, category taxonomy.
- CPT `review` (or a testimonial block if reviews are few) → decide after approval.
- CPT `upcoming_product` → optional; can be a product status.
- Gallery → media taxonomy or CPT `gallery_item`.
- Company info → ACF options page.
- Hero banners → ACF repeater on front page or CPT `banner`.
- Navigation → native WP menus.
- Enquiries → form entries (plugin) + email; no custom CRM in Phase 1.
- Specs → ACF repeater (`label`, `value`, `unit`, `group`) with sanitisation.

**Template parity checklist:** every section in `WEBSITE_CONTENT_INVENTORY.md` must have a corresponding template/pattern, with placeholder copy clearly marked.

### Step 7 — Dummy content only
- 10–12 dummy products covering every field (empty spec, long spec, many specs, no image, multiple categories).
- 1 dummy page per template (About, Contact, Privacy, Terms, 404).
- Placeholder gallery items using **local, licensed** images (not picsum).
- **No** real enquiries, reviews, founder data or production media.
- All dummy content prefixed `[STAGING]` so it can be found and deleted.

### Step 8 — Functional QA
- [ ] Menus, breadcrumbs, pagination
- [ ] Product archive filter by category
- [ ] Product detail renders specs correctly (no tab corruption, no duplicate rows)
- [ ] Search returns products/pages
- [ ] Forms: validation, spam block, success/error states, file upload, email delivery to test inbox
- [ ] 404 returns HTTP 404
- [ ] Redirects: test 5 sample legacy URLs with 301
- [ ] Schema validates (Organization, Product, Breadcrumb)
- [ ] Sitemap generates with staging host (and is **not** submitted)
- [ ] Mobile/tablet/desktop layouts
- [ ] Accessibility: keyboard nav, labels, contrast, alt text
- [ ] Performance: TTFB, LCP, CLS baseline recorded

### Step 9 — Record and hand over
- Export staging DB + files (backup B12).
- Write a build log: versions, plugins, settings, admin users (no passwords).
- Screenshot key screens.
- Present a staging demo link **with** access instructions (credentials via password manager, never chat).

---

## 5. Data policy for staging

| Data type | Allowed in Phase 1? | Rule |
|---|---|---|
| Dummy products/pages | Yes | Prefixed `[STAGING]` |
| Production product data | **No** | Only after PR-01/PR-02 + approvals |
| Production media | **No** | Only after PR-03 + manifest |
| Real enquiries (PII) | **No** | Never import into staging |
| Password hashes | **No** | Never import |
| Real reviews/testimonials | **No** | Consent required |
| Founder photos/bios | **No** | Approval required |
| Live analytics tags | **No** | Disabled |
| Live payment/CRM webhooks | **No** | Disabled |

If production content must be tested later, use a **sanitised subset** (products only, no PII) imported into staging, then deleted after QA.

---

## 6. Rollback and teardown

| Scenario | Action | Production impact |
|---|---|---|
| Staging broken | Delete staging docroot + DB, rebuild from script | None |
| Staging compromised | Take offline (password/IP), restore staging backup, rotate staging secrets only | None |
| Wrong PHP version | Switch per-subdomain version | None |
| Plugin conflict | Restore staging snapshot | None |
| Disk full | Remove staging backups/logs; never delete production media | None |
| Abort project | Remove subdomain, DB, DNS record (if created); keep backups | None |

**Rule:** no rollback action may touch the production docroot, DB or DNS records other than the `staging` record.

---

## 7. Phase 1 exit criteria (gate to content migration)

- [ ] Staging is fully isolated (isolation test passed).
- [ ] Staging is protected (401 without auth) and `noindex`.
- [ ] Theme templates cover 100% of audited sections.
- [ ] CPTs, taxonomies, ACF fields match the approved mapping.
- [ ] Forms deliver to a test inbox with SPF/DKIM/DMARC pass.
- [ ] Redirect engine tested with sample URLs.
- [ ] Performance and accessibility baselines recorded.
- [ ] Staging backup + restore proven.
- [ ] Build log and screenshots delivered.
- [ ] Owner signs Phase 1 acceptance.
- [ ] Data correction approvals (`DATA_CLEANUP_APPROVAL.md`) signed before any real import.

**Until every box is ticked, no production content is imported and no DNS is changed.**

---

## 8. Indicative effort (planning only)

| Workstream | Range |
|---|---|
| Hosting setup + subdomain + DB + SSL | 0.5–1 day |
| WordPress install + hardening + plugins | 0.5–1 day |
| Theme scaffold + templates + patterns | 5–10 days |
| CPT/taxonomy/ACF implementation | 2–4 days |
| Forms + email + spam | 1–2 days |
| Dummy content + QA + fixes | 3–5 days |
| Documentation + handover | 1 day |
| **Total** | **~2–4 weeks** (single developer) |

Estimates assume hosting access is available on day 1 and no scope change.

---

## 9. Out of scope for Phase 1

- Production data import, media migration, redirect map execution.
- DNS cut-over, SSL on the main domain, email migration.
- Search Console submission, analytics installation.
- SEO content rewriting, claim substantiation.
- Payment/e-commerce (not in the audited scope).

---

## 10. Sign-off

| Role | Name | Confirms | Date |
|---|---|---|---|
| Owner | | Staging scope + dummy-content policy | |
| Hosting admin | | Subdomain, DB, SSL, protection available | |
| Migration lead | | Build plan + exit criteria | |
