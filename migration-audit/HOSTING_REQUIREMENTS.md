# HOSTING REQUIREMENTS — Swift Instruments WordPress Migration

**Phase:** 0 — Preparation
**Date:** 13 Nov 2026
**Status:** Requirements + verification procedure. **No hosting was purchased, no plan was changed, no DNS was touched.**
**Rule:** Nothing in this document is a claim about a specific provider. Every capability below must be **verified on the actual plan** before it is marked PASS.

---

## 1. Why this document exists

The audit proved that the current stack is **not** standard shared WordPress hosting:

| Current reality (verified) | Target requirement |
|---|---|
| Next.js frontend (`apps/web`) | PHP 8.x + WordPress |
| Express API (`apps/backend`) | PHP (no Node process needed) |
| SQLite database (`dev.db`) | MySQL 8 / MariaDB 10.6+ |
| Local disk uploads (`apps/backend/uploads`) | WordPress Media Library on disk |
| Admin = React SPA + JWT | `wp-admin` + roles/capabilities |
| Deploy = Vercel + Railway/Render/Fly (intended) | One shared hosting account |

So the hosting question is not "does it run Node?" — it is "does this plan meet the **WordPress minimums** and the **operational requirements** (staging subdomain, backups, cron, mail, SSL)?"

**A cheap plan that fails three of these requirements costs more than a correct plan.** This document is the checklist used to reject a plan before purchase.

---

## 2. Workload sizing (from verified audit data)

These numbers come from `DATABASE_AUDIT.md`, `MEDIA_INVENTORY.md` and `BACKUP_PLAN.md` — not estimates.

| Item | Verified today | WordPress implication |
|---|---:|---|
| Database tables | 14 | ~12 core WP tables + CPT/taxonomy/ACF rows |
| Database rows | 310 | Very small; DB will stay < 50 MB for years |
| Local DB file | 397,312 bytes | MySQL equivalent similar or smaller |
| Media files | 32 | Each upload generates 3–6 thumbnails → ~100–200 files |
| Media bytes | 37,907,247 (≈36.1 MiB) | Modest; growth depends on new photography |
| Products | 11 | Low write volume |
| Enquiries | 6 (3 test-like) | Low form volume; no scaling concern |
| Audit log rows | 200 | Will be replaced by a WP activity log (if approved) |
| Expected plugins | 8–12 | Plugin code dominates disk/inode usage |
| Traffic | **unverified** | Must be supplied by owner (see §3.4) |

### Recommended capacity (not a purchase recommendation)

| Resource | Minimum | Comfortable | Why |
|---|---|---|---|
| Disk | 10 GB | 20–50 GB | WP core + plugins ≈ 150–300 MB; media 36 MiB now; 3 backup generations; logs; staging copy |
| Inodes | 100,000 | 200,000+ / unlimited | Plugins + thumbnails + backups consume inodes fast |
| MySQL DB size | 1 GB | 2 GB+ | Small today; headroom for revisions, logs, form entries |
| Monthly visitors | **to confirm** | 25k–100k | Determines caching/CDN need |
| PHP memory | 256 MB | 512 MB | Page builders are avoided, but media/import tools need headroom |

> If the owner expects < 5,000 monthly visitors and < 200 products, a standard shared plan is sufficient **provided every §4 item passes**. If traffic or catalogue is larger, a cloud/VPS plan should be evaluated instead.

---

## 3. Inputs still required from the owner

| # | Input | Why it matters | Status |
|---|---|---|---|
| 3.1 | Registrar + DNS control (docs mention a domain bought from WordPress.com) | Subdomain creation and cut-over depend on it | **Missing** |
| 3.2 | Current hosting provider/account (if a live site exists) | Determines whether a migration or a fresh install is needed | **Missing** |
| 3.3 | Whether email is hosted with the domain (MX records) | Breaking MX during cut-over stops business email | **Missing** |
| 3.4 | Traffic estimate + peak concurrency | Shared vs cloud plan decision | **Missing** |
| 3.5 | Budget ceiling (optional) | Narrows plan matrix | **Missing** |
| 3.6 | Preferred data region (India vs global) | Latency + DPDP considerations | **Missing** |
| 3.7 | Who will be hosting admin after handover | Access model + least privilege | **Missing** |

**No plan should be purchased until 3.1–3.4 are answered.**

---

## 4. Requirements matrix

Legend: **M** = mandatory, **R** = strongly recommended, **O** = optional/nice-to-have.
Status is **UNVERIFIED** for every row until evidence is attached.

### 4.1 Runtime

| ID | Requirement | Level | Target / minimum | Verification method | Status |
|---|---|---|---|---|---|
| HR-01 | PHP version | M | 8.2 or 8.3 (8.1 absolute minimum; 8.4 only after plugin compatibility check) | hPanel → PHP version; `php -v`; WP Site Health | UNVERIFIED |
| HR-02 | PHP version switch per directory | R | Ability to pin production to 8.2 while staging tests 8.3 | Try changing version on the subdomain only | UNVERIFIED |
| HR-03 | `mysqli` / `pdo_mysql` | M | Enabled | phpinfo / Site Health | UNVERIFIED |
| HR-04 | `curl`, `mbstring`, `xml`, `json`, `zip`, `fileinfo` | M | Enabled | Site Health → Info | UNVERIFIED |
| HR-05 | `gd` **or** `imagick` | M | GD with WebP, or Imagick | Site Health → Media handling | UNVERIFIED |
| HR-06 | `intl`, `exif` | R | Enabled | phpinfo | UNVERIFIED |
| HR-07 | `opcache` | R | Enabled | phpinfo | UNVERIFIED |
| HR-08 | `memory_limit` | M | ≥256 MB | `WP_DEBUG` / Site Health | UNVERIFIED |
| HR-09 | `max_execution_time` | M | ≥300 s (imports, backups) | phpinfo | UNVERIFIED |
| HR-10 | `upload_max_filesize` | M | ≥32 MB (64 MB recommended for future video) | Media upload test | UNVERIFIED |
| HR-11 | `post_max_size` | M | ≥32 MB | Same test | UNVERIFIED |
| HR-12 | `max_input_vars` | M | ≥3000 (menus, ACF, bulk edit break at 1000) | Save a large menu + ACF group | UNVERIFIED |
| HR-13 | `max_input_time` | R | ≥120 s | phpinfo | UNVERIFIED |
| HR-14 | Disabled functions allow-list | M | `exec`, `shell_exec` not required; but allow `putenv`, `gd`, `zip` | Test plugin install + image processing | UNVERIFIED |
| HR-15 | WordPress auto-updates | O | Core minor auto-updates work | Site Health | UNVERIFIED |

### 4.2 Database

| ID | Requirement | Level | Target | Verification | Status |
|---|---|---|---|---|---|
| HR-16 | MySQL 8.0+ / MariaDB 10.6+ | M | utf8mb4, `utf8mb4_unicode_ci` | `SELECT VERSION();` + `SHOW VARIABLES LIKE 'character_set%';` | UNVERIFIED |
| HR-17 | InnoDB default | M | InnoDB, `innodb_file_per_table` | `SHOW ENGINES;` | UNVERIFIED |
| HR-18 | DB user privileges | M | SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, LOCK TABLES — **no SUPER** | `SHOW GRANTS FOR CURRENT_USER();` | UNVERIFIED |
| HR-19 | Multiple databases | M | ≥2 (production + staging), ideally 3 (plus test) | Panel → MySQL databases | UNVERIFIED |
| HR-20 | `max_user_connections` | R | ≥20 or unlimited | Panel/DB variables | UNVERIFIED |
| HR-21 | Remote MySQL | O | Not required (more secure without) | — | N/A |
| HR-22 | DB backup tool | M | Panel export or `mysqldump`, no row/size cap | Export a test DB and restore it | UNVERIFIED |
| HR-23 | DB disk quota | R | Separate from file quota, ≥1 GB | Panel | UNVERIFIED |

### 4.3 Files, SSL and access

| ID | Requirement | Level | Target | Verification | Status |
|---|---|---|---|---|---|
| HR-24 | Disk quota | M | ≥10 GB | Panel → Disk usage | UNVERIFIED |
| HR-25 | Inode limit | M | ≥100k or unlimited | Panel → Inodes | UNVERIFIED |
| HR-26 | Free SSL (Let's Encrypt) | M | Auto-renew, works on subdomains | Visit `https://staging.…`, check expiry | UNVERIFIED |
| HR-27 | Force HTTPS | M | Panel toggle or `.htaccess` | `http://` → 301 `https://` | UNVERIFIED |
| HR-28 | cPanel / hPanel / equivalent | M | File manager, DB tools, DNS zone editor, cron, SSL, backups | Log in and locate each | UNVERIFIED |
| HR-29 | SSH access | R | Needed for WP-CLI, `wp db export`, search-replace, file permissions | `ssh <user>@<host>` | UNVERIFIED |
| HR-30 | WP-CLI | R | v2.10+ available or installable | `wp --info` | UNVERIFIED |
| HR-31 | SFTP/FTP | M | For media/theme uploads if no SSH | Connect with SFTP client | UNVERIFIED |
| HR-32 | File manager upload limit | M | ≥32 MB via browser | Upload a 30 MB zip | UNVERIFIED |
| HR-33 | Cron jobs | M | Real cron (not just wp-cron), min 5-min interval | Add a job that writes a timestamp; confirm it fires | UNVERIFIED |
| HR-34 | PHP error logs | R | Accessible per domain | Trigger a warning, read log | UNVERIFIED |
| HR-35 | Access logs | R | Downloadable raw logs | Panel → Raw access logs | UNVERIFIED |

### 4.4 Domains, subdomains, staging

| ID | Requirement | Level | Target | Verification | Status |
|---|---|---|---|---|---|
| HR-36 | Addon/subdomain creation | M | `staging.<domain>` with its own docroot | Create in panel, confirm folder path | UNVERIFIED |
| HR-37 | Multiple docroots | M | One per site/subdomain | Panel → Domains | UNVERIFIED |
| HR-38 | DNS zone editor | M | A, CNAME, TXT, MX editing with TTL | Open zone editor (read-only in Phase 0) | UNVERIFIED |
| HR-39 | Nameserver control | R | Either host NS or external DNS | Registrar + panel | UNVERIFIED |
| HR-40 | Wildcard subdomain | O | Useful for previews | Panel | UNVERIFIED |
| HR-41 | Staging password protection | M | HTTP auth / IP allowlist / host staging tool | Enable, verify 401 without creds | UNVERIFIED |
| HR-42 | Subdomain SSL | M | Certificate covers `staging.…` | Padlock + no mixed content | UNVERIFIED |
| HR-43 | Domain transfer lock | M | Registrar lock enabled | Registrar panel | UNVERIFIED |

### 4.5 Backups, mail, performance, security

| ID | Requirement | Level | Target | Verification | Status |
|---|---|---|---|---|---|
| HR-44 | Automated backups | M | Daily files + DB, ≥14 days retention | Panel backup list | UNVERIFIED |
| HR-45 | On-demand backup | M | Before every change | Create one, restore to temp | UNVERIFIED |
| HR-46 | Restore capability | M | Self-service restore, not support-only | Restore test log | UNVERIFIED |
| HR-47 | Off-site backup export | R | Download full account backup | Download + checksum | UNVERIFIED |
| HR-48 | SMTP sending | M | Outbound 587/465 open; authenticated SMTP | Send test mail; check headers | UNVERIFIED |
| HR-49 | SPF/DKIM/DMARC | M | Editable TXT records for sending domain | DNS lookup + `mail-tester` score | UNVERIFIED |
| HR-50 | Email deliverability | R | Not blacklisted; dedicated IP not required at low volume | Check IP reputation | UNVERIFIED |
| HR-51 | HTTP/2 or HTTP/3 | R | Enabled | Browser devtools protocol | UNVERIFIED |
| HR-52 | Server caching | R | LiteSpeed cache / opcache / Redis (any one) | Header + Site Health | UNVERIFIED |
| HR-53 | CDN | O | Cloudflare or host CDN | Optional | UNVERIFIED |
| HR-54 | WAF / ModSecurity | R | Enabled, but REST/admin-ajax not blocked | Test forms + REST | UNVERIFIED |
| HR-55 | Login protection | R | Fail2ban / host brute-force protection | Attempt limit test | UNVERIFIED |
| HR-56 | Malware scanning | R | Host-level or plugin | Panel feature list | UNVERIFIED |
| HR-57 | Isolated resources (CPU/RAM) | R | No noisy-neighbour throttling at expected traffic | Ask host; monitor after launch | UNVERIFIED |
| HR-58 | Data region | R | India preferred for latency/DPDP | Panel/server location | UNVERIFIED |
| HR-59 | PHP mail() | O | Not relied upon; SMTP preferred | — | N/A |
| HR-60 | Node.js support | O | **Not required** for pure WordPress | — | N/A |

---

## 5. Plan matrix — to confirm, not to purchase

Do **not** treat these as verified product specs. They are the **questions** to ask of any candidate plan. Provider names are intentionally generic until the owner chooses one.

| Capability | Entry shared | Business shared | Cloud / VPS | Notes |
|---|---|---|---|---|
| PHP 8.2/8.3 + extensions | ? | ? | ? | Entry plans often lack `intl`/`imagick` |
| MySQL 8 / MariaDB 10.6 | ? | ? | ? | Some shared plans still ship MariaDB 10.3 |
| Disk ≥10 GB | ? | ? | ? | Watch "unlimited" fair-use clauses |
| Inodes ≥100k | ? | ? | ? | Often hidden in fine print |
| `max_input_vars` ≥3000 | ? | ? | ? | Common silent failure |
| SSH + WP-CLI | ? | ? | ? | Usually only business+ |
| 2+ databases | ? | ? | ? | Entry plans sometimes cap at 1 |
| Free SSL on subdomain | ? | ? | ? | Usually yes |
| Daily backups + restore | ? | ? | ? | Restore may be support-only |
| Real cron | ? | ? | ? | Usually yes |
| SMTP outbound | ? | ? | ? | Port 25 often blocked; 587 usually open |
| Staging tool | ? | ? | ? | Some hosts provide one-click staging |
| Staging password protection | ? | ? | ? | Needs HTTP auth or IP allowlist |
| WAF without blocking REST | ? | ? | ? | Test before launch |
| India data centre | ? | ? | ? | Latency + compliance |

**Decision rule:** reject any plan where a **mandatory (M)** row is "no" or "unknown". "Unlimited" marketing claims must be checked against the actual inode/CPU policy.

### Indicative budget bands (planning only, not a quote)
| Tier | Typical monthly range | Fits if |
|---|---|---|
| Entry shared | lowest | small catalogue, low traffic, SSH not needed |
| Business shared | mid | SSH/WP-CLI, staging, daily backups needed |
| Cloud/VPS | highest | high traffic, many plugins, custom cron, isolated CPU |

Prices must be confirmed on the provider's site at purchase time. **No purchase in Phase 0.**

---

## 6. Verification procedure (run only after owner approval)

> These are read-only or staging-only checks. Do not run them on a live production site.

### Step 1 — Panel inventory
Capture screenshots (no credentials visible) of: PHP version selector, PHP extensions, MySQL version, disk/inode usage, SSL status, cron, backups, subdomains, DNS zone editor.

### Step 2 — PHP probe
Upload a temporary `phpinfo.php` to the **staging** docroot only, record: version, `memory_limit`, `upload_max_filesize`, `post_max_size`, `max_input_vars`, `max_execution_time`, loaded extensions. **Delete the file immediately after** (it leaks server info).

### Step 3 — Database probe
```sql
SELECT VERSION();
SHOW VARIABLES LIKE 'character_set%';
SHOW VARIABLES LIKE 'collation%';
SHOW VARIABLES LIKE 'max_connections';
SHOW GRANTS FOR CURRENT_USER();
```
Expected: 8.0+/10.6+, `utf8mb4`, no `SUPER`/`GRANT` privileges.

### Step 4 — WordPress health
Fresh staging install → **Tools → Site Health**:
- HTTPS: pass
- REST API: pass
- Cron: pass (or real cron configured)
- Communication with WordPress.org: pass
- Media handling: GD/Imagick + WebP
- No failed loopback requests

### Step 5 — Upload test
Upload a 30 MB test file and a large image; confirm thumbnails are generated and WebP conversion works (if the media plugin is installed).

### Step 6 — Mail test
Send to a mailbox you control; inspect headers for SPF/DKIM/DMARC pass. Score with a deliverability tester. Test the enquiry form end-to-end.

### Step 7 — Backup restore test
Create an on-demand backup → restore to a **temporary** database/docroot → confirm login, media, and page render. Record date, operator, result.

### Step 8 — Isolation test
Confirm `staging.…` is password-protected, `noindex`, and cannot read/write the production database. Confirm production is untouched.

### Step 9 — Performance baseline
Measure TTFB, LCP, total page weight on staging with caching enabled and disabled. Record before/after.

### Step 10 — Record evidence
Fill the scorecard in §7 and attach screenshots/log excerpts (no secrets).

---

## 7. Verification scorecard

| ID | Requirement | Result (PASS/FAIL/UNKNOWN) | Evidence file | Verified by | Date |
|---|---|---|---|---|---|
| HR-01 | PHP 8.2/8.3 | | | | |
| HR-03 | mysqli | | | | |
| HR-05 | GD/Imagick + WebP | | | | |
| HR-08 | memory_limit ≥256M | | | | |
| HR-10 | upload ≥32M | | | | |
| HR-12 | max_input_vars ≥3000 | | | | |
| HR-16 | MySQL 8/MariaDB 10.6 | | | | |
| HR-19 | ≥2 databases | | | | |
| HR-24 | Disk ≥10 GB | | | | |
| HR-25 | Inodes ≥100k | | | | |
| HR-26 | SSL + subdomain SSL | | | | |
| HR-28 | Panel access | | | | |
| HR-29 | SSH + WP-CLI | | | | |
| HR-33 | Real cron | | | | |
| HR-36 | Subdomain + docroot | | | | |
| HR-41 | Staging protection | | | | |
| HR-44 | Daily backups | | | | |
| HR-46 | Restore tested | | | | |
| HR-48 | SMTP works | | | | |
| HR-49 | SPF/DKIM/DMARC | | | | |
| HR-54 | WAF doesn't block admin | | | | |

**Gate:** all **M** rows PASS → hosting approved. Any M row FAIL → choose a different plan. Any M row UNKNOWN → not approved.

---

## 8. Questions to send the host (copy-paste template)

> 1. Which PHP versions are selectable per domain/subdomain, and can I pin different versions per site?
> 2. Is `intl`, `exif`, `imagick`/`gd` (with WebP), `zip`, `curl`, `mbstring` enabled?
> 3. What are `memory_limit`, `upload_max_filesize`, `post_max_size`, `max_input_vars`, `max_execution_time`?
> 4. Which MySQL/MariaDB version, and is utf8mb4 the default?
> 5. How many databases and database users are included? Is `SUPER` excluded?
> 6. What is the disk quota and the **inode** limit? What happens on overage?
> 7. Is SSH access included? Is WP-CLI preinstalled?
> 8. Are real cron jobs included, and what is the minimum interval?
> 9. Are daily automated backups included, how long are they retained, and can I self-restore?
> 10. Can I create subdomains with independent document roots and separate SSL certificates?
> 11. Is outbound SMTP (587/465) allowed? Can I edit SPF/DKIM/DMARC TXT records?
> 12. Is a WAF/ModSecurity enabled, and can REST API/admin-ajax be whitelisted if blocked?
> 13. Which data-centre region hosts the account?
> 14. Is there CPU/RAM throttling on shared plans, and what are the limits?
> 15. Is a one-click staging environment included, and is it password-protectable?

---

## 9. Known hosting risks

| Risk | Impact | Mitigation |
|---|---|---|
| MariaDB 10.3 or older | WP/plugins may require 10.6+ | Verify before purchase; choose another plan |
| `max_input_vars` = 1000 | Menus/ACF silently truncate | Require ≥3000; test saving a large menu |
| Inode cap ("unlimited" disk) | Uploads/backups fail | Confirm inode limit; prune backups |
| No SSH | Slow, risky search-replace | Require SSH, or use a reviewed WP-CLI-over-panel path |
| Shared IP email reputation | Enquiry emails land in spam | SMTP provider + SPF/DKIM/DMARC |
| Backup is support-only | Slow recovery | Require self-service restore |
| WAF blocks REST/admin-ajax | Forms and editor break | Test early; request whitelist |
| Staging shares the live DB | Data corruption risk | Enforce separate DB in `STAGING_DEPLOYMENT_PLAN.md` |
| "Unlimited" CPU fair-use | Site throttled at peak | Confirm limits; monitor after launch |
| PHP 8.4 auto-update | Plugin breakage | Pin version; test on staging first |

---

## 10. Out of scope for Phase 0

- No hosting purchase, upgrade or cancellation.
- No DNS record change, nameserver change or domain transfer.
- No WordPress installation.
- No production data upload.
- No SSL issuance on the live domain.

---

## 11. Sign-off

| Role | Name | Confirms | Date |
|---|---|---|---|
| Owner | | Plan choice + budget | |
| Hosting admin | | All M requirements PASS (scorecard §7) | |
| Migration lead | | Requirements complete and verified | |

**Hosting verdict:** **UNVERIFIED — no plan approved.** Hosting approval is a prerequisite for Phase 1. See `PHASE_0_COMPLETION_REPORT.md`.
