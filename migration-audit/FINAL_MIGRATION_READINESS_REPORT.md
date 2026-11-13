# FINAL MIGRATION READINESS REPORT — Swift Instruments

**Audit date:** 13 Nov 2026
**Audit scope:** Complete pre-migration read-only audit of the Next.js website, Express API, React admin panel, SQLite database and local media store.
**Target:** Pure WordPress (PHP + MySQL) migration.
**Reports in this set:** `PROJECT_ARCHITECTURE.md`, `DATABASE_AUDIT.md`, `MEDIA_INVENTORY.md`, `ADMIN_PANEL_AUDIT.md`, `API_ENDPOINTS.md`, `ENVIRONMENT_VARIABLES.md`, `WEBSITE_CONTENT_INVENTORY.md`, `WORDPRESS_MIGRATION_MAPPING.md`, `MIGRATION_RISK_REPORT.md`, `FINAL_MIGRATION_READINESS_REPORT.md`.

---

## 1. Verdict

> ## Status: **CONDITIONALLY READY — NOT READY FOR CUT-OVER**
>
> The codebase and local data are fully understood and the migration path is clear. However, the **production data source has not been confirmed or accessed**, and the only accessible database contains **demo content and unverified claims**. Migration can start on staging, but a production cut-over must not happen until the Phase 0 conditions in §9 are met.

| Dimension | Score | Comment |
|---|---|---|
| Code/architecture understanding | 10 / 10 | Every app, route, model and component inspected |
| Local data completeness | 8 / 10 | 13 of 14 tables populated; one empty (expected) |
| Local media completeness | 8 / 10 | 32 files hashed and mapped; 16 orphans identified |
| Content authenticity | 3 / 10 | Demo images, seeded reviews, unverified claims |
| Production access | 0 / 10 | No production DB, media, domain or hosting access |
| Migration mapping clarity | 9 / 10 | Field-by-field mapping produced |
| Security readiness | 6 / 10 | Good current design; MFA off, default accounts |
| Backup readiness | 4 / 10 | One stale `.bak`; no tested restore |
| **Overall readiness** | **~6 / 10** | Safe to begin staging work; not safe to go live |

---

## 2. What was actually accessible

### 2.1 Source code — fully accessible
- `apps/web` — 15 route files, 19 components, SEO/schema/API utilities.
- `apps/backend` — app bootstrap, 6 middleware modules, 6 route modules + CRUD factory, schemas, storage, mailer, auth, rate limits, security.
- `apps/admin` — 16 pages, 11 components, auth provider, API client.
- Root/workspace manifests, `.env.example` files, deployment docs.

### 2.2 Database — local only
**Engine:** SQLite 3 (`apps/backend/prisma/dev.db`, 397,312 bytes, last write 2026-11-07).
**Backup:** `dev.db.bak-cms-20261027-161054` (229,376 bytes, 2026-10-27).

| Table | Rows | Migratable as website content? |
|---|---:|---|
| `Product` | 11 | Yes, after data cleanup |
| `CompanyInfo` | 21 | Yes, after claim verification |
| `NavigationLink` | 9 | Yes |
| `HeroBanner` | 3 | Yes |
| `WhyChooseUs` | 6 | Yes, after claim verification |
| `UpcomingProduct` | 3 | Yes, after image replacement |
| `GalleryMedia` | 8 | Structure yes; all media are placeholders |
| `Review` | 4 | **No** — demo testimonials |
| `Setting` | 5 | Yes (fix social URLs) |
| `Media` | 32 | Yes (16 useful files) |
| `Enquiry` | 6 | 3 real-looking + 3 test submissions |
| `Admin` | 2 | Accounts only; passwords must be reset |
| `AuditLog` | 200 | Archive only |
| `EmailOtp` | 0 | Nothing to migrate |
| **Total** | **310** | |

### 2.3 Media — local only
- 32 files, 37,907,247 bytes (≈36.1 MiB), 6 folders.
- 16 files referenced by content, 16 orphans.
- 0 broken local references.
- 3 duplicate hash groups (7 files → 4 unique assets).
- 13 external placeholder URLs (picsum/MDN) plus 2 legitimate Google Maps URLs.
- No production media archive available.

### 2.4 Not accessible
- Production database (Postgres/MySQL or hosted SQLite).
- Production uploaded media / CDN / S3 bucket.
- Production domain, DNS, SSL, hosting dashboards (Vercel, Hostinger, Railway/Render).
- SMTP provider and sending-domain configuration.
- Google Business Profile / Places data.
- Analytics, Search Console, Ads accounts.
- Certificate evidence for ISO/NABL/CE claims.
- Brand guidelines, real photography, legal sign-off.

---

## 3. What can be migrated directly (with cleanup)

| Content | Volume | Cleanup needed |
|---|---|---|
| Products | 11 | Fix `test-tube-warmer`, `centrifuge` specs, `utility-table` label, category trim, HTML cleanup |
| Product categories | 3 → 2 real | Remove trailing space |
| Company info | 21 keys | Verify claims, confirm founder, structure address |
| Navigation | 9 links | Recreate as WP menus; add missing pages |
| Hero banners | 3 slides | Replace/verify banner 1 claim; confirm image choices |
| Why Choose Us | 6 cards | Verify ISO/NABL; map icons |
| Settings | 5 keys | Replace generic social URLs |
| Media | 16 useful files | Compress, rename, alt text, redirect map |
| Page copy | Privacy, Terms, section headings | Convert JSX to blocks |
| SEO metadata | 10 page titles/descriptions | Recreate in SEO plugin |

---

## 4. What needs redevelopment or a plugin decision

| Feature | Current implementation | WordPress approach | Effort |
|---|---|---|---|
| Enquiry CRM (status, notes, bulk, CSV) | Custom Express + React | Form plugin with entries, or custom CPT/plugin | Medium |
| Audit log | Custom table + UI | WP Activity Log plugin | Low |
| MFA (TOTP/email OTP) | Custom | Two-factor plugin | Low |
| Backup download | Custom endpoint | Backup plugin + host snapshots | Low |
| Media guidance + crop dialog | Custom React | Native tools / plugin or retire | Low–Medium |
| Product specs editor | Custom JSON editor | ACF repeater | Medium |
| Role model | `super_admin`/`content_editor` | WP roles/capabilities | Low |
| Rate limiting / CSRF / validation | Express middleware | WAF, WP nonces, plugin validation | Medium |
| ISR caching + revalidation | Next.js | Page cache + CDN purge | Medium |
| API status watcher | Custom component | Retire | — |
| `llms.txt` | Custom route | Small plugin (optional) | Low |
| 404/noindex behaviour | Next.js | Theme 404 + SEO plugin | Low |

---

## 5. Content that must be verified or replaced before launch

| # | Item | Why |
|---|---|---|
| 1 | ISO 9001 / NABL / CE / Make in India claims | Legal exposure |
| 2 | "120+ team members", "15,000+ installations" | Unverified statistics |
| 3 | 4 testimonials | Consent/authenticity |
| 4 | 8 gallery images + 3 upcoming images | Copyright-free placeholders |
| 5 | 1 stock video (MDN flower.mp4) | Not brand content |
| 6 | Founder name/title/photo/bio | Seed vs DB mismatch |
| 7 | `test-tube-warmer` product content | Wrong product data |
| 8 | `centrifuge` duplicated specs | Wrong technical data |
| 9 | Social links | Generic home pages |
| 10 | Privacy/Terms currency | Legal review |
| 11 | Hero banner 1 subtitle | Empty in DB |
| 12 | Test enquiries and test media | Do not publish/migrate |

---

## 6. Required backups before any migration action

| # | Backup | Method | Verification |
|---|---|---|---|
| B1 | Full SQLite DB file | File copy ×2 locations + SHA-256 | Open copy read-only, row counts match |
| B2 | Logical export of all 14 tables | JSON + CSV | Row counts + spot-check |
| B3 | Uploads archive | Zip/tar of `apps/backend/uploads` | SHA-256 manifest + file count (32) |
| B4 | Env/config snapshot | Encrypted vault (not repo) | Key list matches `ENVIRONMENT_VARIABLES.md` |
| B5 | Source code snapshot | Zip of repo excluding `node_modules`/builds | Restore to temp dir and typecheck |
| B6 | Production DB dump | **Still required** | Restore on staging and compare |
| B7 | Production media archive | **Still required** | File count + checksums |
| B8 | DNS/hosting configuration export | Screenshots/config files | Documented |
| B9 | WordPress staging backup before cut-over | Host/plugin snapshot | Restore test completed |

> **Rule:** no production change until B1–B5 are completed and B6–B7 are obtained or formally waived by the owner.

---

## 7. Recommended migration sequence

| Phase | Work | Exit criteria |
|---|---|---|
| **0. Confirm & clean** | Confirm production data source; obtain dumps; content freeze; fix product data; verify claims; replace placeholders | Signed content inventory |
| **1. Stage setup** | Hosting, SSL, WordPress, MySQL, theme base, ACF, SEO, forms, security, backup, caching | Staging URL reachable |
| **2. Model** | CPTs, taxonomies, ACF fields, roles, menus | Editor can create content matching old model |
| **3. Media** | Compress, rename, import, alt text, mapping, redirects | Zero broken media in crawl |
| **4. Content** | Products, company, banners, USPs, upcoming, gallery, reviews, settings, pages, SEO | Content diff passes |
| **5. Functionality** | Enquiry form + email + entries + spam, redirects, schema, sitemap, cache, hardening | Forms and redirects tested |
| **6. Verify** | Crawl, Lighthouse, accessibility, mobile, cross-browser, content sign-off | Owner approval |
| **7. Cut-over** | Final sync, DNS, smoke tests, Search Console, monitoring | Live and stable |
| **8. Stabilise** | 30-day rollback window, fix 404s, review leads, decommission old stack | Sign-off |

---

## 8. Pre-migration prerequisite checklist

### Access & information
- [ ] Production database dump obtained and restored on staging
- [ ] Production media archive obtained and verified
- [ ] Production domain + DNS access confirmed
- [ ] Hosting plan confirmed (PHP version, memory, upload limits, MySQL, backups)
- [ ] Current deployment status clarified (is anything live on Vercel/API host?)
- [ ] SMTP provider + sending domain chosen
- [ ] Google Business Profile access (if reviews sync is wanted)
- [ ] Analytics/Search Console access
- [ ] Legal reviewer identified

### Content
- [ ] Every product verified by the technical team
- [ ] Categories finalised (2 or more real categories)
- [ ] Product specs cleaned and validated
- [ ] Claims verified or removed
- [ ] Real photography supplied
- [ ] Reviews approved or removed
- [ ] Founder details confirmed
- [ ] Social links corrected
- [ ] Privacy/Terms approved
- [ ] All hardcoded website copy exported

### Technical
- [ ] Backups B1–B5 complete with checksums
- [ ] WordPress staging installed and hardened
- [ ] Redirect map drafted and reviewed
- [ ] Media import pipeline tested
- [ ] Form plugin tested end-to-end
- [ ] Email deliverability tested (SPF/DKIM/DMARC)
- [ ] Security headers and caching configured
- [ ] MFA enabled for all admins
- [ ] Fresh admin accounts created; seed accounts removed
- [ ] Restore test completed
- [ ] Rollback plan documented and owner-approved

### Acceptance
- [ ] Content diff (counts + spot checks) passed
- [ ] Crawl shows 0 broken internal links/media
- [ ] Mobile + desktop visual review passed
- [ ] Core Web Vitals acceptable
- [ ] Forms deliver + store + export correctly
- [ ] Owner sign-off recorded

---

## 9. Go / No-Go summary

**GO for staging work now:** yes — the code and mapping are ready.

**GO for production cut-over only if:**
1. Production data source is confirmed (or local data is formally declared authoritative).
2. All demo/placeholder content and unverified claims are resolved.
3. Product data defects are fixed.
4. Media import is verified with zero broken references.
5. Redirects, forms, email and security are tested.
6. Backups exist and a restore has been proven.
7. Owner signs off on staging.

**NO-GO if:** production data is inaccessible and unconfirmed, claims remain unverified, or backups are untested.

---

## 10. Estimated effort (indicative)

| Workstream | Effort |
|---|---|
| Data cleaning + content verification | Medium–High (owner-dependent) |
| WordPress setup + theme build | Medium–High |
| Content model (CPT/ACF/taxonomies) | Medium |
| Media import + redirects | Medium |
| Form/CRM + email | Medium |
| Security + backup + caching | Low–Medium |
| QA + cut-over | Medium |
| **Total** | **A multi-week project**, dominated by content verification rather than code |

Timelines should be set only after Phase 0 access is resolved.

---

## 11. Final recommendation

1. **Do not start the WordPress build blindly on demo data.** First resolve the production-data question — it is the single biggest unknown.
2. **Start staging in parallel** using local data as a structural reference, because the content model, media mapping and redirect plan can be built and tested safely.
3. **Treat content verification as the critical path**, not development. Claims, product specs and photography need owner input.
4. **Do not reuse any current credential** (JWT secret, admin passwords, SMTP) in WordPress.
5. **Keep the current stack intact and read-only** until the WordPress site has been live and stable for 30 days.
6. **Re-run this audit's data/media checks** against the production dump when it becomes available — the counts and defects in these reports describe the local database only.

**Bottom line:** the migration is technically feasible and well understood, but it is **not safe to migrate production yet**. Resolve access + content authenticity first, then proceed through the phased plan above.
