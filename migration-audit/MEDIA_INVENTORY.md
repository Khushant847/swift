# MEDIA INVENTORY — Swift Instruments

**Audit date:** 13 Nov 2026
**Scope:** `apps/backend/uploads/` (the only media store currently in use)
**Method:** Filesystem walk + SHA-256 hashing + image metadata extraction with `sharp` (read-only). Cross-referenced against every URL stored in the database.
**Production media:** **[NOT ACCESSIBLE]** — only the local development uploads folder could be inspected.

---

## 1. Totals

| Metric | Value |
|---|---|
| Files (excluding `.gitkeep`) | 32 |
| Total size | 37,907,247 bytes (**≈ 36.1 MiB**) |
| PNG | 27 files |
| JPG | 2 files |
| WebP | 2 files |
| MP4 | 1 file |
| Folders | 6 (`banners`, `branding`, `cms-test`, `general`, `products`, `team`) |
| Files referenced by website content | 16 |
| Files not referenced by any content | 16 |
| Database `Media` rows | 32 (exact 1:1 match with disk) |
| Missing files referenced by content | **0** |
| Duplicate hash groups | 3 (7 files → 4 unique assets) |
| Files > 1 MB | 20 |
| Largest file | `team/10328b43-…png` — 5,137 KB (2480×3312 founder photo) |

---

## 2. Full file inventory

`Usage` = where the URL is referenced in the database. "UNUSED" means no product, banner, or company-info row points at it (it may still appear in the Media Library screen).

| File (under `/uploads/`) | Dimensions | Size | Used by |
|---|---|---:|---|
| `banners/0306c2af-7680-4178-8f26-d107c8eeae2b.mp4` | video (not probed*) | 1102 KB | UNUSED |
| `banners/22a670cd-c4ab-4a49-bf9a-0acf5ad528a7.png` | 1584×396 | 665 KB | UNUSED |
| `banners/5dc41491-60de-4a2d-a00c-e5ffe8669180.png` | 1600×900 | 1552 KB | UNUSED |
| `banners/68b487a4-c25c-4479-b8b3-db3b8e335ad5.webp` | 704×396 | 25 KB | UNUSED |
| `banners/76e0deea-96b3-4c2d-a750-ea8e414c267e.jpg` | 1584×396 | 57 KB | HeroBanner #0 |
| `banners/80176734-ff66-446b-a825-2255c7e7a4ad.jpg` | 1584×396 | 57 KB | UNUSED (byte-identical to above) |
| `banners/8eb72503-ef41-40e1-a3ca-a602b7fb7aea.png` | 1600×900 | 1411 KB | HeroBanner #1 |
| `banners/9be0db6f-cfca-4d9b-aa57-1185605a7b94.webp` | 704×396 | 25 KB | UNUSED |
| `banners/d2c9b5a5-dc9f-4cfa-a563-c586c542c5f5.png` | 1584×396 | 554 KB | HeroBanner #2 |
| `branding/23564808-cda5-4933-af1a-d2369719f4e5.png` | 1254×1254 | 1324 KB | UNUSED (shield emblem) |
| `branding/62dff9b0-8b7e-4542-947f-ba3e48cb7c85.png` | 212×181 | 37 KB | CompanyInfo `logo_url` |
| `cms-test/2eaf1079-6c47-415e-b97c-d22f3e2ae70c.png` | 1×1 | 0 KB (70 B) | UNUSED — test artefact |
| `general/ef4428ef-c878-4cf0-a890-c353434ed82c.png` | 4×4 | 0 KB (68 B) | UNUSED — e2e test artefact |
| `products/008ec64f-b0f6-455e-900e-503e858a197a.png` | 1254×1254 | 1629 KB | Product `laminar-air-flow-iui-ivf-usage-size-2x3-ft` |
| `products/01631e45-5028-4881-971c-08088c23b8c5.png` | 1254×1254 | 1689 KB | Product `laminar-air-flow-ivf-usage-size-2x4-ft` |
| `products/13e88174-3b9e-4d61-849b-ae10ab271298.png` | 1448×1086 | 1839 KB | Product `utility-table` |
| `products/19884cce-a516-42df-987c-da9ab904aaa2.png` | 1254×1254 | 1623 KB | Product `laminar-air-flow-iui-usage-size-2x2-ft` |
| `products/20016187-ce0d-4356-86ba-ff5f3b495bf2.png` | 1080×1080 | 1149 KB | Product `clean-air-system-air-purifier` |
| `products/2b1aa8c4-64e8-4cf9-bd91-021635f47f05.png` | 1448×1086 | 1839 KB | UNUSED (duplicate of utility-table image) |
| `products/6cf0ab40-5a9e-42d0-b5ec-ea7e61ef48c3.png` | 445×445 | 117 KB | Product `anti-vibration-table` |
| `products/6df03dd2-2f9d-48af-b5c4-34e0c57cd89a.png` | 163×139 | 40 KB | UNUSED — low resolution |
| `products/6e317e18-e6dc-4b9a-94e2-68cf12313b23.png` | 1254×1254 | 1811 KB | UNUSED |
| `products/7d5ad969-1b3a-4fd8-ac0c-6c9715e10873.png` | 1254×1254 | 1852 KB | Product `test-tube-warmer` |
| `products/b5231f7c-59f6-4951-90da-2e0f71de253d.png` | 1080×1080 | 1204 KB | Product `positive-pressure-clean-air-module-ppm` |
| `products/b854c328-e267-4670-a08a-60523c9ebc87.png` | 1199×1312 | 1766 KB | Product `digital-heating-incubator` |
| `products/c4985204-513e-47c0-b6c9-32af048ca170.png` | 1536×1024 | 1652 KB | Product `centrifuge` |
| `products/c9a5fe94-7ce7-430e-8e57-87e3de9179a1.png` | 1254×1254 | 1629 KB | UNUSED (duplicate of 008ec64f) |
| `products/cfda0a73-7577-4c42-b4d5-e4795faf7836.png` | 1254×1254 | 1690 KB | UNUSED (near-duplicate set) |
| `products/d30414ab-28f7-4cdf-9898-832babacf83b.png` | 163×139 | 35 KB | UNUSED — low resolution |
| `products/ecdc48c6-3e3e-4d2b-8679-92cea94a8070.png` | 1348×1167 | 1670 KB | Product `laminar-air-flow-ivf-work-station-2ftx6ft` |
| `team/10328b43-dfd9-41f0-a7fc-c9949f66b327.png` | 2480×3312 | 5137 KB | CompanyInfo `founder_photo` |
| `team/3d842b14-7947-49e5-b086-204615c918a9.png` | 1448×1086 | 1839 KB | UNUSED (duplicate of utility-table image) |

\* The MP4 was not probed for duration/codec — no `ffprobe` binary is installed. It is 1,128,375 bytes and is **not referenced** by any banner or gallery row.

---

## 3. Duplicates (SHA-256 verified)

| Hash (prefix) | Files | Original name |
|---|---|---|
| `dec80424…` | `banners/76e0deea…jpg`, `banners/80176734…jpg` | Swift Instruments website hero banner.jpg |
| `33775755…` | `products/008ec64f…png`, `products/c9a5fe94…png` | Swift Laboratory Workstation Product Shot.png |
| `4db5860b…` | `products/13e88174…png`, `products/2b1aa8c4…png`, `team/3d842b14…png` | Industrial Utility Table Catalog Collage.png |

**Interpretation:** 7 physical files represent only 4 distinct images → 3 redundant copies (**≈5.2 MB**, 5,493,053 bytes). The `team/` copy is clearly misplaced (a product collage stored as a team photo). These should be de-duplicated during import, keeping the referenced copy.

---

## 4. Referenced vs orphan media

**Referenced by website content (16 files):**
- 3 hero banners
- 11 product images
- 1 logo
- 1 founder photo

**Orphaned / unreferenced (16 files, ≈ 13.3 MiB / 13,959,561 bytes):**
- 6 banner files (incl. 1 MP4, 2 WebP variants, 1 duplicate JPG, 2 unused PNGs)
- 6 unused product PNGs
- 2 branding/team files (shield emblem, misplaced collage)
- 2 test artefacts (`cms-test`, `general`)

**Recommendation:** migrate only the 16 referenced files plus any extra assets the owner explicitly wants (e.g. the shield emblem may be a brand asset). Archive the rest.

---

## 5. External media references (not in the media store)

The database also points at 13 external URLs that are **not** local files:

| Source | Count | URLs |
|---|---:|---|
| `GalleryMedia.mediaUrl` | 7 | `https://picsum.photos/seed/{lab-1,lab-2,office-1,office-2,team-1,factory-1,events-1}/1200/800` |
| `GalleryMedia.mediaUrl` | 1 | `https://mdn.github.io/shared-assets/videos/flower.mp4` (stock video) |
| `UpcomingProduct.imageUrl` | 3 | `https://picsum.photos/seed/{swiftscan,microbalance,autocheck}/800/600` |
| `CompanyInfo.map_embed` | 1 | Google Maps embed URL (intentional external embed) |
| `CompanyInfo.map_url` | 1 | `https://maps.app.goo.gl/QRJr22r9AgJa585Y9` (intentional) |

**These are placeholders.** A WordPress migration cannot "carry" them as brand media; they must be replaced with real photography. The Google Maps embed is legitimate and should be re-created with the business's real place data / API key.

---

## 6. Media quality and compliance observations

| # | Observation | Files | Action |
|---|---|---|---|
| M1 | Product images are large PNGs (1.1–1.9 MB each), no WebP/AVIF variants | 11 used product images | Compress + generate responsive sizes on import (WordPress can do this, but max upload and memory limits must allow ~2 MB originals) |
| M2 | Founder photo is 2480×3312 / 5.1 MB | `team/10328b43…png` | Resize before/at import; check EXIF/geo metadata |
| M3 | Two product images at 163×139 px | `products/6df03dd2…`, `products/d30414ab…` | Too small for product cards; do not migrate |
| M4 | 1×1 and 4×4 px test images | `cms-test/`, `general/` | Delete, do not migrate |
| M5 | UUID filenames carry no SEO value | all 32 | Rename on import to descriptive slugs (`utility-table-01.png`) and keep a redirect map for old `/uploads/...` URLs |
| M6 | `Media` table has no width/height | all | Re-derive on import |
| M7 | Video banner file exists but is unused | `banners/0306c2af…mp4` | Confirm whether a video hero was intended; if not, archive |
| M8 | No alt text stored for most images | all | Alt text currently comes from captions/titles; WordPress requires real alt text for accessibility and image SEO |
| M9 | Image licensing unknown | all | Confirm ownership/rights for product photos and especially the founder portrait before publishing |

---

## 7. WordPress Media Library mapping plan

1. Preserve the original folder structure as a source manifest (`source URL → new attachment`).
2. Upload with `wp media import` (WP-CLI) or a custom importer, keeping original filenames where safe.
3. Store the mapping table in `wp_postmeta` (`_swift_legacy_url`) so old links can be rewritten.
4. Rewrite every content reference:
   - `Product.imageUrl` → featured image / ACF image field
   - `HeroBanner.mediaUrl` → slider slide image
   - `GalleryMedia.mediaUrl` → gallery item attachment
   - `CompanyInfo.logo_url`, `founder_photo` → theme/ACF image fields
5. Keep `/uploads/<uuid>.<ext>` redirects (301) to the new attachment URLs for at least 12 months.
6. Delete/never import: `cms-test/*`, `general/*`, and unreferenced duplicates.

---

## 8. Access status

| Item | Status |
|---|---|
| Local uploads folder | Fully inspected (32 files, hashes, dimensions) |
| Production uploaded media | **NOT ACCESSIBLE** |
| CDN / S3 / Cloudinary bucket | Not configured (`STORAGE_DRIVER=local`) |
| Video metadata (duration/codec) | Not measured — no ffprobe |
| Image EXIF (camera/GPS) | Not inspected — recommend stripping on import |
