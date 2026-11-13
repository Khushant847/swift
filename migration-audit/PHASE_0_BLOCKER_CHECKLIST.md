# PHASE 0 — CONSOLIDATED BLOCKER CHECKLIST

**Project:** Swift Instruments — migration to Pure WordPress (PHP + MySQL)
**Phase:** 0 — Preparation (documentation only)
**Date:** 13 Nov 2026
**Status of this document:** Working checklist — **no blocker is marked resolved**
**Rules honoured:** No website, database, media or DNS changes were made. No credentials are recorded here. No production content was migrated.

---

## 0. How to use this checklist

| Status | Meaning |
|---|---|
| **OPEN** | Known blocker, no owner action started |
| **IN PROGRESS** | Owner action started |
| **BLOCKED** | Cannot proceed without third-party access/decision |
| **RESOLVED** | Acceptance criteria met and evidence attached |
| **WAIVED** | Owner formally accepts the risk in writing |

**Rule:** Phase 1 staging development may start with dummy content while P1–P10 remain open. **Production content import and cut-over are NO-GO until every Critical item is RESOLVED.**

**Credentials rule:** never send passwords, API keys, DB credentials or panel logins through chat/email. Place them in a password manager or the hosting panel and grant least-privilege, time-boxed access.

---

## 1. Critical path (top 10)

| Rank | ID | Blocker | Why it stops the project |
|---:|---|---|---|
| 1 | PR-01 | Production source of truth not confirmed | We cannot know whether local demo data is real |
| 2 | PR-02 | Production database dump unavailable | Real products/leads may be lost or demo data published |
| 3 | PR-03 | Production media archive unavailable | Real images may be missing; only local files are visible |
| 4 | PR-08 | Unverified claims (ISO/NABL/CE/120+/15,000+) | Legal exposure if migrated as-is |
| 5 | PD-01 | `test-tube-warmer` shows wrong product content | Publishes incorrect technical information |
| 6 | PD-02 | `centrifuge` duplicated/incorrect specs | Publishes incorrect technical information |
| 7 | HS-01..05 | Hosting capabilities unconfirmed | A plan may not support WordPress requirements |
| 8 | DN-01..03 | Domain/DNS access unconfirmed | Cut-over and redirects cannot be executed safely |
| 9 | SEO-01 | Redirect map not approved | Ranking/traffic loss risk |
| 10 | SC-01/02 | Fresh admin accounts + secret rotation not planned in writing | Security/account takeover risk |

---

## 2. Missing production resources

| ID | Blocker | Evidence | How to obtain (safe procedure) | Acceptance criteria | Status |
|---|---|---|---|---|---|
| PR-01 | Actual source of truth not confirmed | Local `dev.db` contains demo content (picsum images, seeded reviews, test enquiries); no production connection string; all domains are `yourdomain.com` placeholders | Owner confirms in writing: (a) never deployed, (b) deployed but dormant, or (c) live production exists. Attach URL + host + last deploy date | Written confirmation signed/dated; named production URL (or explicit "no production") | OPEN |
| PR-02 | Production database dump missing | Only `apps/backend/prisma/dev.db` (397 KB) and one `.bak` exist locally | Host panel → database export; or `pg_dump`/`mysqldump` via read-only user; or support ticket. Save to encrypted storage, record SHA-256 | Dump file + checksum + row counts; restored successfully on a temporary DB | BLOCKED |
| PR-03 | Production media archive missing | Only local `apps/backend/uploads` (32 files) inspected | SFTP/File Manager archive of server `uploads/`, or S3/Cloudinary bucket export; include directory tree | Archive + checksum + file count matches production references | BLOCKED |
| PR-04 | Production URL/domain unknown | Docs use `yourdomain.com` only; `DEPLOY_VERCEL.md` references a domain bought from WordPress.com | Owner provides registrar + primary domain + `www` policy | Domain confirmed; current DNS snapshot attached | BLOCKED |
| PR-05 | Hosting/panel access not available | No Hostinger/Vercel/Railway/Render account access in this environment | Owner grants delegated access (not password in chat) or performs exports with screenshots | Access verified or owner-run exports received | BLOCKED |
| PR-06 | Deployment handover missing | Repo has no git history, CI config, or server inventory | Previous developer/host handover: repo origin, deploy method, cron, email, backups | Written handover document | OPEN |
| PR-07 | Production database engine/version unknown | Local is SQLite; intended production is Postgres; target is MySQL | Host panel → MySQL/MariaDB version; confirm if any Postgres exists | Engine + version + charset/collation recorded | OPEN |
| PR-08 | Claims/certificates evidence missing | `certifications`, `employees=120+`, `installations=15,000+`, ISO/NABL/CE text | Owner supplies certificate numbers/scope or approves removal | Evidence on file or written removal approval | OPEN |
| PR-09 | Brand assets & real photography missing | 11 placeholder images + 1 stock video; no brand kit in repo | Owner supplies logo source files, product photos, facility/team photos, permissions | Asset pack with usage rights documented | OPEN |
| PR-10 | Legal content sign-off missing | Privacy/Terms dated Jan 2026, reference old CRM/IP capture | Legal/owner review for WordPress, forms, analytics, retention | Signed approval or revised text | OPEN |

---

## 3. Database access requirements

| ID | Requirement | Detail | Acceptance criteria | Status |
|---|---|---|---|---|
| DB-01 | Engine and version | Confirm MySQL 8.0+ / MariaDB 10.6+ for WordPress; confirm whether a Postgres production DB exists today | Version string captured | OPEN |
| DB-02 | Read-only export access | Least-privilege DB user limited to `SELECT`/dump for the export window; credentials via vault only | Access tested; user removed/rotated after export | BLOCKED |
| DB-03 | Export method | Panel export, `mysqldump --single-transaction`, or `pg_dump`; include routines/triggers if any | Export completes without errors | OPEN |
| DB-04 | Write freeze | Announce a content freeze during final export (`Enquiry` inserts may continue; note them separately) | Freeze window agreed; delta plan documented | OPEN |
| DB-05 | Integrity verification | Row counts for all 14 tables; checksum; character set; timezone | Counts match source; timezone confirmed (currently UTC epoch ms) | OPEN |
| DB-06 | PII handling | Enquiries contain names/emails/phones/IPs; admins contain hashes | Export stored encrypted; hashes never printed; retention agreed | OPEN |
| DB-07 | Target DB provisioning | New MySQL database + user for staging, separate from any live DB | DB created; `SHOW GRANTS` least privilege | OPEN |
| DB-08 | Backup/restore proof | Restore export into a temporary DB and query it | Restore verified before any import | OPEN |

---

## 4. Media access requirements

| ID | Requirement | Detail | Acceptance criteria | Status |
|---|---|---|---|---|
| MD-01 | Production uploads location | Local path, S3 bucket, Cloudinary, or CDN — confirm which is authoritative | Path/bucket documented | BLOCKED |
| MD-02 | Export method | SFTP/File Manager ZIP, bucket sync, or CDN origin pull | Archive downloaded intact | OPEN |
| MD-03 | Manifest | SHA-256 per file, byte size, dimensions, MIME, folder, original name | Manifest generated and compared to DB `Media` rows | OPEN |
| MD-04 | Reference reconciliation | Every `/uploads/...` URL in content must map to a file; list orphans and missing | 0 missing references; orphan list approved | OPEN |
| MD-05 | Rights and alt text | Confirm ownership/licence for product/founder/gallery images; write alt text | Rights documented; alt text drafted | OPEN |
| MD-06 | Compression policy | Keep originals; generate WebP/AVIF derivatives; strip EXIF GPS | Derivatives approved; originals archived | OPEN |
| MD-07 | Legacy URL mapping | Preserve old `/uploads/<uuid>` paths for 301 redirects | Mapping table approved | OPEN |
| MD-08 | Test artefacts exclusion | `cms-test/*`, `general/*` 1×1/4×4 images, duplicate copies | Exclusion list approved | OPEN |

---

## 5. Product data defects (no auto-correction)

| ID | Defect | Evidence | Decision needed | Status |
|---|---|---|---|---|
| PD-01 | `test-tube-warmer` title ≠ content (Dry Bath Incubator SW/DB01 copy/specs) | Description and 13 specs are dry-bath data | Correct content, or rename product and create a real warmer entry | OPEN |
| PD-02 | `centrifuge` duplicate/foreign spec rows | Two `Dimensions` labels + `Standard Block`/`Tube Capacity` rows from a dry bath | Confirm true dimensions and which rows to remove | OPEN |
| PD-03 | Category `"Utility "` trailing space | DB value `"Utility "` | Approve trim to `Utility` | OPEN |
| PD-04 | Spec formatting corruption | Tabs in labels, escaped quotes in 7 products | Approve normalisation rules | OPEN |
| PD-05 | Placeholder images | 8 gallery + 3 upcoming picsum; 1 MDN video | Replace before import | OPEN |
| PD-06 | Test/demo reviews | 4 seeded testimonials | Confirm real reviews or remove | OPEN |
| PD-07 | Test enquiries | 3 of 6 look like internal tests | Exclude from production CRM | OPEN |
| PD-08 | Unverified claims | ISO/NABL/CE, 120+, 15,000+, 25+ years | Evidence or removal | OPEN |
| PD-09 | Founder identity mismatch | Seed `S. K. Sharma` vs DB `Mr. B.V.S. Kashyap` | Confirm correct person/details | OPEN |
| PD-10 | Low-resolution product images | Two 163×139 PNGs unused | Exclude or replace | OPEN |
| PD-11 | Generic social links | Platform home pages, not brand profiles | Supply real URLs | OPEN |
| PD-12 | Empty banner subtitle / teaser text | Banner #1 subtitle empty; all upcoming teasers empty | Approve final copy | OPEN |

Full correction sheet: `DATA_CLEANUP_APPROVAL.md`.

---

## 6. Security requirements

| ID | Requirement | Detail | Acceptance criteria | Status |
|---|---|---|---|---|
| SC-01 | Fresh WordPress admins | Do not reuse seed accounts; create named admins with strong unique passwords | Accounts created; MFA enrolled | OPEN |
| SC-02 | Secret rotation | New WP salts, DB password, SMTP password, API keys; retire old `.env` values | Rotation log (no values) | OPEN |
| SC-03 | Email authentication | SPF, DKIM, DMARC for sending domain | Test mail passes authentication | OPEN |
| SC-04 | Spam protection | Captcha/honeypot + rate limiting on forms | Spam test blocked; real test delivered | OPEN |
| SC-05 | Hardening | Force HTTPS, disable file edit, limit login attempts, least privilege, disable XML-RPC if unused | Hardening checklist signed | OPEN |
| SC-06 | Security headers/WAF | CSP compatible with WordPress, HSTS, X-Frame-Options; WAF if available | Header scan passes | OPEN |
| SC-07 | Plugin governance | Reputable plugins only, pinned versions, staging-first updates | Plugin register approved | OPEN |
| SC-08 | PII retention | Define retention for form entries and IP addresses | Written policy | OPEN |
| SC-09 | Backup encryption | Backups encrypted at rest, access limited | Restore test + access list | OPEN |

---

## 7. Hosting requirements

| ID | Requirement | Minimum | Acceptance criteria | Status |
|---|---|---|---|---|
| HS-01 | PHP | 8.2+ recommended (8.1 absolute minimum), with `mysqli`, `curl`, `mbstring`, `xml`, `zip`, `gd`/`imagick`, `intl`, `exif` | phpinfo confirms | OPEN |
| HS-02 | Database | MySQL 8.0+ or MariaDB 10.6+, utf8mb4 | Version + collation confirmed | OPEN |
| HS-03 | Disk/inodes | ≥10 GB free recommended today (36 MiB media + growth/backups) | Quota confirmed | OPEN |
| HS-04 | PHP limits | `upload_max_filesize` ≥32M, `post_max_size` ≥32M, `memory_limit` ≥256M, `max_execution_time` ≥300 | Values confirmed | OPEN |
| HS-05 | SSL | Free/renewable certificate + HTTPS redirect | Valid cert on staging | OPEN |
| HS-06 | Panel/SSH | cPanel/hPanel access; SSH + WP-CLI strongly preferred | Access tested | OPEN |
| HS-07 | Backups | Daily automated + on-demand + restore option | Restore test scheduled | OPEN |
| HS-08 | Subdomains/staging | At least one subdomain with separate docroot + DB | Staging subdomain created | OPEN |
| HS-09 | Cron | Real cron or reliable WP-Cron alternative | Test event fires | OPEN |
| HS-10 | Email | SMTP allowed; outbound port 587/465 not blocked | Test email delivered | OPEN |
| HS-11 | Image processing | GD or Imagick with WebP support | Thumbnails generated | OPEN |
| HS-12 | Performance | HTTP/2+, caching (LiteSpeed/Redis/opcache), CDN optional | Cache hit ratio acceptable | OPEN |

Full report: `HOSTING_REQUIREMENTS.md`.

---

## 8. Domain and DNS requirements

| ID | Requirement | Detail | Acceptance criteria | Status |
|---|---|---|---|---|
| DN-01 | Registrar access | Confirm registrar (docs mention a WordPress.com-registered domain) | Delegated access or owner-run changes | BLOCKED |
| DN-02 | DNS snapshot | Export A/AAAA/CNAME/MX/TXT before any change | Snapshot stored | OPEN |
| DN-03 | TTL strategy | Lower TTL to 300 s ≥24 h before cut-over | TTL verified | OPEN |
| DN-04 | Subdomain | `staging.<domain>` with own docroot/DB | Subdomain resolves + SSL | OPEN |
| DN-05 | Email continuity | Preserve MX/TXT; do not break business email | Mail flow tested during cut-over | OPEN |
| DN-06 | Canonical host | Choose `www` vs non-`www`; 301 the other | Redirect tested | OPEN |
| DN-07 | SSL/HTTPS | Force HTTPS, HSTS after validation | No mixed content | OPEN |
| DN-08 | Rollback DNS | Document old A/CNAME values | Rollback tested on paper | OPEN |

---

## 9. SEO migration requirements

| ID | Requirement | Detail | Acceptance criteria | Status |
|---|---|---|---|---|
| SEO-01 | Redirect map | Every old URL → new URL, incl. `/uploads/<uuid>`; preserve product slugs | Crawl shows 0 unintended 404s | OPEN |
| SEO-02 | Metadata parity | Titles/descriptions/canonicals for all 10 pages + 11 products | Side-by-side diff approved | OPEN |
| SEO-03 | Structured data | Organization, WebSite, Product, Breadcrumb, About/Contact | Rich Results validation passes | OPEN |
| SEO-04 | Sitemap/robots | Native WP sitemap or SEO plugin; correct domain | Submitted to Search Console | OPEN |
| SEO-05 | 404 behaviour | Real HTTP 404 + helpful page (current site has a documented 200/streaming caveat) | Status-code test passes | OPEN |
| SEO-06 | Search Console | Verify property; keep old property; monitor 90 days | Access granted | BLOCKED |
| SEO-07 | Analytics/consent | GA4/Ads decision; cookie consent if tracking added | Consent configured before tags | OPEN |
| SEO-08 | `llms.txt` | Decide keep/drop | Written decision | OPEN |
| SEO-09 | Image SEO | Descriptive filenames + alt text | Audit passes | OPEN |

---

## 10. Consolidated counts

| Category | Items | Resolved | Open/Blocked |
|---|---:|---:|---:|
| Production resources | 10 | 0 | 10 |
| Database access | 8 | 0 | 8 |
| Media access | 8 | 0 | 8 |
| Product data defects | 12 | 0 | 12 |
| Security | 9 | 0 | 9 |
| Hosting | 12 | 0 | 12 |
| Domain / DNS | 8 | 0 | 8 |
| SEO | 9 | 0 | 9 |
| **Total** | **76** | **0** | **76** |

> **Note:** local source code and local data are fully readable — those are **not** blockers. The blockers are production access, content authenticity, hosting confirmation and cut-over logistics.

---

## 11. Safe ways to close access blockers (no credentials in chat)

### Option A — Owner-run export (fastest, safest)
1. Owner logs into hosting panel.
2. Exports DB + uploads ZIP.
3. Uploads to a shared encrypted folder (or provides a one-time download link).
4. Auditor verifies checksums and row counts, then deletes the transfer copy.

### Option B — Delegated, least-privilege access
1. Create a temporary DB user with read-only rights.
2. Create a temporary SFTP user restricted to the uploads directory.
3. Share credentials via password manager (not chat).
4. Revoke both after export; rotate passwords.

### Option C — Host support ticket
1. Owner requests a full account backup from the host.
2. Host provides a download link.
3. Audit verifies and stores it encrypted.

**Never:** paste passwords/keys in chat, commit `.env`, email ZIPs unencrypted, or reuse the current `JWT_SECRET` anywhere.

---

## 12. Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Site owner | | Confirm source of truth (PR-01) | |
| Site owner | | Approve data corrections (`DATA_CLEANUP_APPROVAL.md`) | |
| Hosting admin | | Confirm hosting capabilities | |
| SEO owner | | Approve redirect map | |
| Migration lead | | Phase 0 acceptance | |

**Phase 0 recommendation:** **NO-GO for production migration.** Conditional GO for Phase 1 staging scaffolding **only after** hosting access is confirmed and this checklist is acknowledged. Full rationale: `PHASE_0_COMPLETION_REPORT.md`.
