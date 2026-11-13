# MIGRATION RISK REPORT — Swift Instruments

**Audit date:** 13 Nov 2026
**Scope:** Risks in replacing the Next.js + Express + SQLite stack with WordPress + MySQL.
**Scale:** Severity = impact if it happens (Critical / High / Medium / Low). Likelihood = probability given current evidence.

---

## 1. Top risks (executive view)

| # | Risk | Severity | Likelihood | Must resolve before launch |
|---|---|---|---|---|
| R1 | **Production database and uploads are not accessible** — migration may be based on demo data | Critical | High (currently true) | Yes |
| R2 | Content is a mix of real and demo/placeholder data (images, reviews, claims) | Critical | High | Yes |
| R3 | Unverified regulatory/marketing claims (ISO, NABL, CE, 120+, 15,000+) | Critical | High | Yes |
| R4 | Product data defects (`test-tube-warmer` wrong content, duplicate specs, bad category) | High | High | Yes |
| R5 | SEO loss during URL/HTML changes | High | Medium | Yes |
| R6 | Broken media after import (`/uploads/<uuid>` references, large files) | High | Medium | Yes |
| R7 | Email deliverability / enquiry loss (console mailer, no SMTP today) | High | High | Yes |
| R8 | Security regression in WordPress (forms, plugins, users, defaults) | High | Medium | Yes |
| R9 | Admin accounts migrated with known/default credentials | High | Medium | Yes |
| R10 | No tested rollback plan / no verified backups | High | Medium | Yes |
| R11 | Enquiry CRM workflow parity loss | Medium | High | Should |
| R12 | Performance regression (heavy plugins, unoptimised images) | Medium | Medium | Should |
| R13 | Plugin/theme abandonment or vulnerabilities | Medium | Medium | Ongoing |
| R14 | Loss of historical audit trail | Low | High | No (archive) |
| R15 | Content editing downtime during cut-over | Medium | Medium | Plan window |
| R16 | Legal pages / consent gaps | Medium | Medium | Yes |
| R17 | `llms.txt`, JSON-LD, custom schema behaviour changes | Low | Medium | Optional |
| R18 | Trailing-slash / canonical inconsistencies | Medium | Medium | Yes |
| R19 | Hosting plan limits (PHP memory, upload size, DB size) | Medium | Medium | Yes |
| R20 | Two admins only, no MFA — operational continuity risk | Medium | Medium | Yes |

---

## 2. Detailed risk register

### R1 — Production data not accessible (Critical)
**Evidence:** Only `apps/backend/prisma/dev.db` (SQLite, 397 KB) and local `uploads/` exist locally. No production Postgres/MySQL dump, no production media archive, no production domain, no hosting credentials. The local DB contains demo content (picsum images, seeded reviews, test enquiries).

**Impact:** A migration built from local data could publish demo content, lose real products/leads, or miss media entirely.

**Mitigation:**
1. Confirm with the owner whether a separate production system exists.
2. If yes, obtain a full DB dump + uploads archive + env inventory before planning.
3. If no (local is the source of truth), formally record that decision and still clean demo data.

---

### R2 — Demo/placeholder content (Critical)
**Evidence:**
- 8 gallery items and 3 upcoming products use `picsum.photos` / `mdn.github.io`.
- 4 reviews are seeded testimonials.
- Test artefacts in media (`1×1`, `4×4` PNGs).
- Two test enquiries ("Post-fix verification", "Proxy path check").
- Hero banner 1 has an empty `subtitle`.

**Impact:** Publishing placeholders damages credibility and may create copyright issues.

**Mitigation:** Content freeze + owner sign-off checklist per item. Replace before import; exclude test artefacts and test enquiries.

---

### R3 — Unverified claims (Critical)
**Evidence:** `certifications = ["ISO 9001","NABL","CE","Make in India"]`, `employees = 120+`, `installations = 15,000+`, "ISO-certified calibration" in banner 1, "ISO 9001 certified" in footer, "NABL-traceable" in history and reviews.

**Impact:** Legal/regulatory exposure (advertising claims), reputational damage, possible customer disputes.

**Mitigation:** Obtain certificate numbers/scope or remove claims. Add an approval step in the content migration checklist.

---

### R4 — Product data defects (High)
**Evidence:**
- `test-tube-warmer` title but Dry Bath Incubator SW/DB01 content/specs.
- `centrifuge` has two `Dimensions` rows and appended dry-bath specs.
- `utility-table` spec label is `"Product\tUtility"`.
- Category `"Utility "` has a trailing space.
- 7 products contain escaped quotes/tab characters in specs.

**Impact:** Wrong technical data published; taxonomy duplication; broken tables.

**Mitigation:** Data-cleaning sprint before import; owner confirms correct specs; validate JSON after conversion; add automated checks (no tabs, no duplicate labels).

---

### R5 — SEO loss (High)
**Evidence:** Current site has canonical URLs, metadata, sitemap, JSON-LD, `llms.txt`, clean slugs, and 404/noindex handling. WordPress defaults differ (trailing slashes, pagination, archives, attachment pages, sitemap location).

**Impact:** Ranking/traffic drop; duplicate content; broken canonical signals.

**Mitigation:** Build a full redirect map (see `WORDPRESS_MIGRATION_MAPPING.md` §4), preserve slugs, disable attachment pages, configure canonicals, submit the new sitemap, monitor Search Console for 90 days, keep the old site available read-only during validation.

---

### R6 — Broken media (High)
**Evidence:** 48 local `/uploads/...` references (16 unique files used by content); UUID filenames; 32 files / 36 MiB; some >1 MB; no width/height in DB.

**Impact:** Missing images, slow pages, 404s.

**Mitigation:** Media mapping table, WP-CLI import, post-import crawler for broken images, redirects from `/uploads/<uuid>` to new URLs, image compression + responsive sizes, verify PHP upload/memory limits.

---

### R7 — Email and enquiry loss (High)
**Evidence:** `MAIL_DRIVER=console` locally (no real email), `SMTP_*` unset, no captcha secret, enquiry rate limit 6/hour, form has no retry/queue. Email failure does not roll back DB insert (good) but no alerting exists.

**Impact:** Leads silently lost; no notification to sales.

**Mitigation:** Configure SMTP with SPF/DKIM/DMARC, test deliverability, store entries in the form plugin, add failure logging/alerting, configure spam protection (captcha/honeypot), set recipient list from settings, test from multiple networks.

---

### R8 — Security regression (High)
**Evidence:** Current stack has strict CSP/Helmet, Zod validation, DOMPurify, origin-guard CSRF, rate limits, MIME/magic-byte upload checks, HttpOnly SameSite cookies. WordPress security depends heavily on plugins/config.

**Impact:** XSS, CSRF, spam, upload abuse, brute force, plugin vulnerabilities.

**Mitigation:** Harden `wp-config.php` (disable file editing, force SSL, secure salts), limit login attempts, enable MFA, least-privilege roles, reputable plugins only, automatic updates for minor core, WAF, disable XML-RPC if unused, file permission review, security headers at host/CDN, malware scanning, staging-first updates.

---

### R9 — Credentials and access control (High)
**Evidence:** Two local admins, MFA disabled, both created by the seed script with a **known demo password** (value intentionally not repeated here), no password reset flow.

**Impact:** Account takeover if migrated as-is.

**Mitigation:** Create fresh WordPress administrator accounts, force strong unique passwords, enable MFA, remove/disable seed accounts, audit roles, rotate all secrets (`JWT_SECRET`, SMTP, API keys), delete old `.env` files from the workstation/repo copies at decommission.

---

### R10 — No rollback / backup confidence (High)
**Evidence:** Only one `.bak` SQLite file; no automated backups; backup is a manual download; no migration history.

**Impact:** Failed cut-over could cause prolonged downtime or data loss.

**Mitigation:** Documented backup of DB + uploads + env before cut-over; verified restore test on staging; keep DNS TTL low; keep old stack running read-only for 30 days; defined rollback trigger and owner.

---

### R11 — Enquiry CRM parity (Medium)
**Evidence:** Custom statuses (`new/contacted/closed`), notes, bulk actions, CSV export, stats.

**Impact:** Staff workflow disruption; slower lead response.

**Mitigation:** Choose a form plugin with entries + statuses + notes + export, or build a small custom plugin/CPT. Train users; document the new flow.

---

### R12 — Performance (Medium)
**Evidence:** Large PNGs (up to 5 MB), no AVIF, no CDN configured, many plugins likely.

**Impact:** Poor Core Web Vitals, especially mobile.

**Mitigation:** Compress images, serve WebP/AVIF, lazy-load, page cache + CDN, limit plugins, audit third-party scripts, monitor Lighthouse.

---

### R13 — Plugin/theme risk (Medium)
**Evidence:** WordPress will add 8–12 plugins (ACF, SEO, forms, security, backup, caching, MFA, redirects, cookie consent).

**Impact:** Vulnerabilities, conflicts, abandonment, lock-in.

**Mitigation:** Prefer reputable, actively maintained plugins; pin versions; staging updates; remove unused plugins; document dependencies; avoid page builders.

---

### R14 — Audit log history (Low)
**Evidence:** 200 rows, custom schema, tied to old admin IDs.

**Impact:** Loss of historical traceability (not website content).

**Mitigation:** Export to CSV/JSON and archive; start fresh logging in WordPress.

---

### R15 — Cut-over downtime (Medium)
**Impact:** Lost enquiries/traffic during DNS propagation.

**Mitigation:** Low TTL before switch, staging validation, maintenance window, redirect testing immediately after switch, monitor uptime and forms.

---

### R16 — Legal/privacy (Medium)
**Evidence:** Privacy policy references a custom CRM and IP recording; no cookie consent; terms dated January 2026; WordPress may add analytics/cookies.

**Impact:** Non-compliance (DPDP Act/GDPR depending on audience).

**Mitigation:** Update privacy policy for WordPress/plugins/analytics, add cookie consent if tracking is added, define retention for form entries, review terms with the owner.

---

### R17 — Structured data / AI discovery (Low)
**Evidence:** Custom JSON-LD (`Organization`, `WebSite`, `Product`, `AboutPage`), `llms.txt`, custom sitemap logic.

**Impact:** Rich results or AI-crawler discoverability may change.

**Mitigation:** Recreate schema via SEO plugin + custom JSON-LD where needed; validate with Rich Results Test; recreate `llms.txt` if desired.

---

### R18 — URL canonicalisation (Medium)
**Impact:** Duplicate URLs, redirect chains, diluted rankings.

**Mitigation:** Choose trailing-slash policy, enforce one canonical form, 301 the other, update internal links, verify with a crawler.

---

### R19 — Hosting limits (Medium)
**Evidence:** `UPLOAD_MAX_MB=25`, large images, 36 MiB media today (could grow), SQLite → MySQL conversion.

**Impact:** Failed uploads, timeouts, DB import errors.

**Mitigation:** Confirm Hostinger PHP memory (≥256 MB), `upload_max_filesize`, `post_max_size`, MySQL size, and backup retention. Test media import on staging.

---

### R20 — Operational continuity (Medium)
**Evidence:** Only 2 admin users; MFA off; one developer context; no documentation for editors.

**Impact:** Lockout or inability to update content.

**Mitigation:** At least two administrators with MFA, documented runbook, training session, emergency access procedure, plugin/theme documentation.

---

## 3. Risk matrix

| Likelihood ↓ / Impact → | Low | Medium | High | Critical |
|---|---|---|---|---|
| **High** | R14 | R11 | R4, R7 | R1, R2, R3 |
| **Medium** | — | R12, R13, R15, R18, R19, R20, R16 | R5, R6, R8, R9, R10 | — |
| **Low** | R17 | — | — | — |

---

## 4. Missing information blocking a safe migration

| # | Missing item | Why it matters | Who can provide |
|---|---|---|---|
| M1 | Production database dump | Real content/leads source | Site owner / previous developer |
| M2 | Production uploads archive | Real media | Site owner / host |
| M3 | Production domain + DNS access | Cut-over and redirects | Site owner |
| M4 | Hosting plan details (Hostinger) | PHP limits, backups, SSL | Site owner |
| M5 | Vercel/API hosting status | Whether anything is live today | Site owner |
| M6 | Email/SMTP provider + sending domain | Lead delivery | Site owner |
| M7 | Google Business Profile access | Reviews/maps | Site owner |
| M8 | Certificate evidence for ISO/NABL/CE | Legal compliance | Site owner |
| M9 | Real product specifications | Data accuracy | Technical team |
| M10 | Real photography + brand assets | Visual fidelity | Site owner |
| M11 | Founder identity confirmation | About page accuracy | Site owner |
| M12 | Legal review of privacy/terms | Compliance | Site owner/legal |
| M13 | Analytics/Search Console access | SEO continuity | Site owner |
| M14 | Decision on e-commerce | Product model choice (CPT vs WooCommerce) | Site owner |

---

## 5. Assumptions made in this audit

1. `apps/backend/prisma/dev.db` is the only database available to this audit.
2. No production deployment is currently reachable from this environment.
3. The WordPress target is self-hosted PHP + MySQL (Hostinger-class), not WordPress.com.
4. The site will remain a brochure/catalogue site (no online payments) unless stated otherwise.
5. English is the only language required.
6. Existing product slugs should be preserved.
7. The Next.js/Express stack will be retired after a rollback window, not kept headless.

If any assumption is wrong, the corresponding sections in the mapping and readiness reports must be revised.

---

## 6. Go / No-Go criteria

**GO only when all are true:**
- [ ] Production data source confirmed and exported.
- [ ] Demo/placeholder content replaced or explicitly approved.
- [ ] Unverified claims resolved.
- [ ] Product data corrected and validated.
- [ ] Media imported with zero broken references.
- [ ] Redirect map implemented and tested.
- [ ] Forms deliver email and store entries; spam protection active.
- [ ] WordPress hardened; MFA enabled; fresh admin accounts.
- [ ] Backups taken and a restore has been tested.
- [ ] Staging reviewed and signed off by the owner.
- [ ] Rollback plan and owner agreed.

**NO-GO if:** production data is unavailable, claims remain unverified, or no tested backup exists.
