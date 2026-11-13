# DATA CLEANUP APPROVAL SHEET — Swift Instruments

**Phase:** 0 — Preparation
**Date:** 13 Nov 2026
**Status:** **No correction has been applied.** This is an approval sheet, not a change log.
**Rule:** Product specifications will **not** be auto-corrected. Every technical change requires explicit owner/technical approval. No database, file or media has been modified.

---

## 1. Status definitions

| Status | Meaning |
|---|---|
| **Verified** | Defect confirmed from source code / database / file evidence |
| **Requires confirmation** | Defect confirmed, but the correct value or business decision needs owner/technical input |
| **Approved for correction** | Owner has explicitly approved the proposed correction in writing |
| **Not approved** | Correction is not authorised (default for all rows today) |

Two columns are used because a finding can be factually verified while the **fix** is still unapproved:

- **Finding status** → `Verified` or `Requires confirmation`
- **Correction approval** → `Not approved` or `Approved for correction`

**As of this document: 13 findings, 0 approved corrections, 13 not approved.**

---

## 2. Correction principles

1. **Backup first** (`BACKUP_PLAN.md` B1–B5) before touching any data.
2. **Staging-first:** corrections are applied to an export/import mapping, never directly to the live database.
3. **No invented specs:** if the correct value is unknown, leave it blank/mark "to be supplied" — never guess.
4. **One change, one approval:** initials + date required per row.
5. **Diff before/after:** every correction must show a before/after diff and a re-validation result.
6. **Reversible:** the original value is preserved in the import mapping/backup.
7. **No mass rewrite** without a dry-run and row counts.
8. **Claims are not "copy edits":** they require documentary evidence.

---

## 3. Correction sheet

### DC-01 — `test-tube-warmer` content mismatch

| Field | Detail |
|---|---|
| Entity | Product `test-tube-warmer` |
| Finding | Title says **Test Tube Warmer**, but the description and all specs are for a **Digital Dry Bath Incubator (SW/DB01)** |
| Evidence | Description begins "The SW/DB01 Digital Dry Bath Incubator…"; specs include `Model=SW/DB01`, `Temperature Range=Ambient +1°C to +65°C`, `Heater Power=75 W`; product image is a dry-bath-style unit |
| Risk if unchanged | Customers receive wrong technical information; quotation/application errors; SEO page ranks for the wrong product |
| Proposed correction (not applied) | **Option A:** rename title + slug to "Digital Dry Bath Incubator" (301 from old slug) and later create a genuine Test Tube Warmer product. **Option B:** replace content/specs with correct Test Tube Warmer data and keep the slug. |
| Finding status | **Requires confirmation** |
| Correction approval | **Not approved** |
| Decision owner | Technical/product owner |
| Verification after fix | Title, slug, description, specs and image all describe the same product; redirect tested |

### DC-02 — `centrifuge` duplicated and foreign spec rows

| Field | Detail |
|---|---|
| Entity | Product `centrifuge` |
| Finding | Two `Dimensions` rows exist, and three rows appear copied from a dry bath: `Dimensions (L × W × H)=200 × 250 × 115 mm`, `Standard Block=03`, `Tube Capacity=15 mL × 6 Tubes per Block` |
| Evidence | Earlier row: `Dimensions=(L × W × H)\t265 × 305 × 205 mm`; later duplicate with different values. Dry-bath rows match the SW/DB01 spec set. |
| Risk if unchanged | Incorrect dimensions/capacity published; customer compatibility issues |
| Proposed correction (not applied) | Confirm the correct centrifuge dimensions and remove the duplicate/foreign rows. Do **not** infer which dimension is correct. |
| Finding status | **Requires confirmation** |
| Correction approval | **Not approved** |
| Decision owner | Technical/product owner |
| Verification after fix | Exactly one `Dimensions` row; no dry-bath terms; row count diff documented |

### DC-03 — Category `"Utility "` trailing space

| Field | Detail |
|---|---|
| Entity | Product `utility-table` → category |
| Finding | Category value is `"Utility "` (trailing space), creating a third category distinct from intended `Utility` |
| Evidence | DB category distribution: `Laboratory Instruments` 8, `Air Purifier` 2, `"Utility "` 1 |
| Risk if unchanged | Phantom filter/category in WordPress taxonomy; duplicate terms; inconsistent navigation |
| Proposed correction (not applied) | Trim to `Utility`; confirm it should remain a separate category (vs merging into Laboratory Instruments). |
| Finding status | **Verified** |
| Correction approval | **Not approved** |
| Decision owner | Content owner |
| Verification after fix | Taxonomy has no terms with leading/trailing whitespace; product count per term matches |

### DC-04 — Product specification formatting

| Field | Detail |
|---|---|
| Entity | 7 products (`utility-table`, 4 laminar-air-flow variants, `digital-heating-incubator`, `centrifuge`) |
| Finding | JSON spec values contain tab characters and escaped double quotes, e.g. `"Product\tUtility"`, `"\"2\"\" × 2\"\"\""`, `"HEPA Filters": "\"0.3 Micron; Efficiency: 99.99%\""` |
| Evidence | Parsed `specs` JSON from all 11 products; 7 contain tabs or embedded quotes |
| Risk if unchanged | Broken table layout, mangled quotes after re-import, CSV/JSON conversion errors |
| Proposed correction (not applied) | **Formatting only:** replace tabs with a single space; normalise escaped quotes to typographic units (e.g. `2" × 2"`); preserve the semantic value. Any value that changes meaning needs separate approval. |
| Finding status | **Verified** (formatting); some values also **Requires confirmation** |
| Correction approval | **Not approved** |
| Decision owner | Technical owner |
| Verification after fix | No `\t` in any spec; no malformed JSON; before/after semantic diff reviewed |

### DC-05 — Placeholder gallery and upcoming images

| Field | Detail |
|---|---|
| Entity | `GalleryMedia` (8), `UpcomingProduct` (3) |
| Finding | 7 gallery images are `picsum.photos` placeholders; 1 gallery video is a stock MDN flower clip; 3 upcoming images are picsum placeholders |
| Evidence | URLs verified in DB; no corresponding local files |
| Risk if unchanged | Publishing stock/placeholder imagery; copyright/credibility issues |
| Proposed correction (not applied) | Replace with real facility/team/product photos and original videos; do not import placeholders. Supply at least 1200×800 images. |
| Finding status | **Verified** |
| Correction approval | **Not approved** |
| Decision owner | Owner/marketing |
| Verification after fix | All gallery/upcoming media resolve to owned local attachments; alt text present |

### DC-06 — Seeded/demo reviews

| Field | Detail |
|---|---|
| Entity | `Review` (4 rows) |
| Finding | All 4 reviews were inserted by the seed at the same timestamp; `source=manual`; `googleReviewId` null; authors "Dr. Ananya Rao", "Vikram Mehta", "Priya Nair", "Rakesh Gupta" |
| Evidence | Seed file creates them; all `reviewTime` identical; no Google sync ever ran |
| Risk if unchanged | Fake testimonials published; consumer-protection/trust risk |
| Proposed correction (not applied) | Hide/remove demo reviews; replace only with real, consented testimonials; keep evidence of consent. |
| Finding status | **Verified** |
| Correction approval | **Not approved** |
| Decision owner | Owner |
| Verification after fix | Each published review has a real source/consent reference |

### DC-07 — Test enquiries

| Field | Detail |
|---|---|
| Entity | `Enquiry` (6 rows) |
| Finding | 3 subjects look like internal test submissions: "Post-fix verification", "Proxy path check", "QC lab query" may be a test; the first three ("Analytical balance quote", "AMC enquiry", "Bulk pricing") look like demo leads |
| Evidence | Subjects, message lengths (61–72 chars), timestamps clustered 2026-10-12 and 2026-10-27 |
| Risk if unchanged | Test/PII data imported into the new CRM; confusing reporting |
| Proposed correction (not applied) | Owner identifies real enquiries. Do not import test rows. Keep original DB untouched; exclusion happens at import. |
| Finding status | **Verified** |
| Correction approval | **Not approved** |
| Decision owner | Sales/owner |
| Verification after fix | Imported enquiry count matches approved list; no test subjects present |

### DC-08 — Unverified company claims

| Field | Detail |
|---|---|
| Entity | `CompanyInfo`, `Setting.footer_text`, `WhyChooseUs`, `HeroBanner` |
| Finding | Claims: ISO 9001, NABL, CE, Make in India; "120+" employees; "15,000+" installations; "25+ years"; "ISO-certified calibration"; "NABL-traceable" |
| Evidence | `certifications` JSON, `employees`, `installations`, history HTML, footer text, banner #0, USP cards |
| Risk if unchanged | Advertising-claim/legal exposure; reputational damage |
| Proposed correction (not applied) | Owner supplies certificate numbers/scope/validity, or approves removal/rephrasing. Do not soften into a different unverified claim. |
| Finding status | **Requires confirmation** |
| Correction approval | **Not approved** |
| Decision owner | Owner/legal |
| Verification after fix | Evidence file per claim, or claim absent from all content |

### DC-09 — Founder identity mismatch

| Field | Detail |
|---|---|
| Entity | `CompanyInfo.founder_name`, `founder_title`, `founder_bio`, `founder_photo` |
| Finding | Live DB says **Mr. B.V.S. Kashyap**; `prisma/seed.ts` says **Mr. S. K. Sharma** |
| Evidence | DB row vs seed file; founder photo is a 2480×3312 PNG |
| Risk if unchanged | Wrong person named on the About page |
| Proposed correction (not applied) | Owner confirms the correct founder name/title/bio/photo; seed file remains untouched (demo only). |
| Finding status | **Requires confirmation** |
| Correction approval | **Not approved** |
| Decision owner | Owner |
| Verification after fix | About page, JSON-LD and metadata agree; photo approved |

### DC-10 — Low-resolution product images

| Field | Detail |
|---|---|
| Entity | `products/6df03dd2-….png` (163×139), `products/d30414ab-….png` (163×139) |
| Finding | Both are unused, below usable product-card resolution |
| Evidence | Dimensions measured with `sharp`; neither referenced by a product |
| Risk if unchanged | Blurry cards if accidentally used |
| Proposed correction (not applied) | Exclude from import; replace only if the owner identifies them. |
| Finding status | **Verified** |
| Correction approval | **Not approved** |
| Decision owner | Owner |
| Verification after fix | No imported attachment below 400 px on the long edge (except icons) |

### DC-11 — Generic social links

| Field | Detail |
|---|---|
| Entity | `Setting.social_links` |
| Finding | URLs are `https://linkedin.com`, `https://facebook.com`, `https://instagram.com`, `https://youtube.com` — platform home pages, not brand profiles |
| Evidence | Parsed JSON value |
| Risk if unchanged | Footer sends visitors away from the brand |
| Proposed correction (not applied) | Replace with the company's real profile URLs or remove the icons. |
| Finding status | **Verified** |
| Correction approval | **Not approved** |
| Decision owner | Owner/marketing |
| Verification after fix | Each URL opens the correct brand profile |

### DC-12 — Empty copy fields

| Field | Detail |
|---|---|
| Entity | `HeroBanner` #0 subtitle; all 3 `UpcomingProduct.teaserDesc`; `expectedLaunch` = "Coming soon" for all |
| Finding | Empty/placeholder marketing copy |
| Evidence | DB values |
| Risk if unchanged | Empty space or generic cards on the home page |
| Proposed correction (not applied) | Owner supplies final copy or approves hiding the element. |
| Finding status | **Verified** |
| Correction approval | **Not approved** |
| Decision owner | Owner/marketing |
| Verification after fix | No empty required fields; approved copy in staging |

### DC-13 — Editor-generated HTML noise

| Field | Detail |
|---|---|
| Entity | Product descriptions, `founder_bio`, `history` |
| Finding | Descriptions contain editor-specific classes, e.g. `<span class="a_GcMg font-feature-liga-off …">`; raw `<p>`/`<span>` markup |
| Evidence | HTML strings in DB |
| Risk if unchanged | Bloated/inconsistent markup; styling conflicts in WordPress |
| Proposed correction (not applied) | Sanitise with a conservative allow-list (`p`, `strong`, `em`, `ul`, `ol`, `li`, `br`, `h2`–`h4`, `a`), strip unknown classes/attributes; convert to Gutenberg blocks. |
| Finding status | **Verified** |
| Correction approval | **Not approved** |
| Decision owner | Content owner |
| Verification after fix | HTML validates; no unknown classes; visual diff reviewed |

### DC-14 — Duplicate media

| Field | Detail |
|---|---|
| Entity | Media files (3 hash groups, 7 files) |
| Finding | Two identical banner JPGs; two identical product PNGs; three copies of the "Industrial Utility Table Catalog Collage" (one stored under `team/`) |
| Evidence | SHA-256 groups: `dec80424…`, `33775755…`, `4db5860b…` |
| Risk if unchanged | Wasted storage; wrong image attached to founder/team |
| Proposed correction (not applied) | Import one copy per hash; keep the referenced copy; confirm the `team/` copy is not the intended founder photo. |
| Finding status | **Verified** |
| Correction approval | **Not approved** |
| Decision owner | Content owner |
| Verification after fix | One attachment per distinct hash; references point to the kept copy |

---

## 4. Summary table

| ID | Issue | Finding status | Correction approval |
|---|---|---|---|
| DC-01 | `test-tube-warmer` mismatch | Requires confirmation | Not approved |
| DC-02 | `centrifuge` duplicate/foreign specs | Requires confirmation | Not approved |
| DC-03 | Category trailing space | Verified | Not approved |
| DC-04 | Spec formatting (tabs/quotes) | Verified | Not approved |
| DC-05 | Placeholder gallery/upcoming images | Verified | Not approved |
| DC-06 | Seeded reviews | Verified | Not approved |
| DC-07 | Test enquiries | Verified | Not approved |
| DC-08 | Unverified claims | Requires confirmation | Not approved |
| DC-09 | Founder mismatch | Requires confirmation | Not approved |
| DC-10 | Low-resolution images | Verified | Not approved |
| DC-11 | Generic social links | Verified | Not approved |
| DC-12 | Empty copy fields | Verified | Not approved |
| DC-13 | HTML noise | Verified | Not approved |
| DC-14 | Duplicate media | Verified | Not approved |

**Counts:** 14 findings total → 10 Verified, 4 Requires confirmation, 0 Approved for correction, 14 Not approved.

---

## 5. How approved corrections will be applied (later, not now)

1. Freeze source and take backups (B1–B5).
2. Export affected tables to staging (`dev.db` copy → transform → import).
3. Apply only approved rows with a versioned transformation script.
4. Produce a before/after diff per row and a row-count report.
5. Reviewer signs the diff.
6. Re-run validation:
   - JSON parses, no tabs
   - exactly one dimension row for `centrifuge`
   - no category with leading/trailing spaces
   - no placeholder URLs
   - no unapproved claims
7. Keep the original export untouched for rollback.

**No production DB write is part of this plan.** Corrections happen in the WordPress import layer, with the legacy data preserved.

---

## 6. Approval sign-off

**Instructions:** initial each row you approve. "Approved for correction" means the proposed correction may be applied during the WordPress import on staging. It does **not** authorise editing the live database.

| ID | Approve? (Y/N) | Correct value / instruction | Initials | Date |
|---|---|---|---|---|
| DC-01 | | Option A / Option B: | | |
| DC-02 | | Correct dimensions: | | |
| DC-03 | | Trim / merge: | | |
| DC-04 | | Formatting-only: | | |
| DC-05 | | Replacement assets: | | |
| DC-06 | | Hide/remove/keep: | | |
| DC-07 | | Keep list: | | |
| DC-08 | | Evidence / remove: | | |
| DC-09 | | Correct founder: | | |
| DC-10 | | Exclude / replace: | | |
| DC-11 | | Real URLs: | | |
| DC-12 | | Final copy: | | |
| DC-13 | | Sanitise allow-list: | | |
| DC-14 | | Keep copy: | | |

| Role | Name | Signature | Date |
|---|---|---|---|
| Owner | | | |
| Technical reviewer | | | |
| Migration lead | | | |

---

## 7. Explicit non-authorisations

- Product specifications are **not** corrected by this document.
- No claim is removed or reworded without evidence/approval.
- No review, enquiry or media is deleted.
- No live database record is updated in Phase 0.
- No content is migrated to WordPress in Phase 0.
