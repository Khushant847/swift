# BACKUP PLAN — Swift Instruments Pre-Migration

**Phase:** 0 — Preparation (plan only; no backup was created, moved, overwritten or deleted)
**Date:** 13 Nov 2026
**Scope:** Original source code, local and production databases, media, environment variable names, domain configuration.
**Security rule:** This document contains **no credential values**. Passwords, keys and tokens must be stored in a password manager, never in this repository, this document, chat, or email.

---

## 1. Objectives

1. Guarantee that every original asset can be restored **before** any WordPress work touches production.
2. Preserve the existing local database and media **without overwriting** the existing `.bak` file.
3. Produce verifiable backups (checksums + restore test), not just copies.
4. Keep backups encrypted and access-controlled because they contain PII (enquiries) and password hashes (admins).
5. Provide a safe acquisition path for production data that never exposes credentials.

**3-2-1 rule:** at least **3 copies**, on **2 different media**, with **1 off-site/offline**.

---

## 2. Current asset inventory (verified)

| Asset | Location | Size / count | Notes |
|---|---|---|---|
| Source code | repository root | 3 apps + docs + scripts | No git repository; disk-only |
| Local database | `apps/backend/prisma/dev.db` | 397,312 bytes | Last write 2026-11-07 14:50 |
| Existing DB backup | `apps/backend/prisma/dev.db.bak-cms-20261027-161054` | 229,376 bytes | **Do not overwrite or delete** |
| Local media | `apps/backend/uploads/` | 32 files, 37,907,247 bytes (≈36.1 MiB) | 6 folders; `.gitkeep` excluded |
| Backend env | `apps/backend/.env` | key/value file | Values secret — back up encrypted; report key names only |
| Web env | `apps/web/.env` | key/value file | Values not secret but back up |
| Admin env | none | — | `.env.example` only |
| Prisma schemas | `apps/backend/prisma/schema*.prisma` | 2 files | SQLite + Postgres variants |
| Seed file | `apps/backend/prisma/seed.ts` | 1 file | Demo content — do not run in production |
| Deployment docs | `docs/DEPLOY_VERCEL.md` etc. | 6 markdown files | Domain/DNS context |
| Production DB | unknown | unknown | **Not accessible** |
| Production media | unknown | unknown | **Not accessible** |
| DNS zone | unknown | unknown | **Not accessible** |

### Existing backup that must be preserved
`dev.db.bak-cms-20261027-161054` predates the latest content changes. It must be treated as **read-only history** and never used as the working backup.

---

## 3. Source-of-truth assessment (do not assume)

| Question | Evidence | Conclusion |
|---|---|---|
| Is `dev.db` production data? | Contains picsum placeholder images, 4 seeded reviews, 3 test enquiries, seed-created admins; seed script warns not to run in production | **No — it is a development/demo database** |
| Is there a remote production DB? | No connection string, no Postgres URL, no dump, no host access | **Unknown — must be confirmed** |
| Is there a live production website? | All domains in the repo are `yourdomain.com`; docs describe an intended Vercel deployment | **Unknown — must be confirmed** |
| Is local media production media? | 16 of 32 files referenced by local content; 16 orphans; demo placeholders exist in DB | **Only valid for local content** |
| Is external storage used? | `STORAGE_DRIVER=local`; S3/Cloudinary env keys empty | **No evidence of external storage** |

**Formal position for Phase 0:** the local SQLite database is the **only verified dataset**, but it is **not certified as production content**. PR-01 in the blocker checklist must be answered in writing before any content import.

---

## 4. Backup scope matrix

| # | Backup | Source | Include | Exclude | Encrypted? |
|---|---|---|---|---|---|
| B1 | Source code snapshot | repo | all source, docs, configs, `.env.example` | `node_modules`, `.next`, `dist`, `.turbo`, caches | No (no secrets) |
| B2 | Local DB file copy | `dev.db` | whole file | — | Yes |
| B3 | Local DB logical export | `dev.db` | all 14 tables (JSON + CSV) | — | Yes |
| B4 | Local media archive | `uploads/` | all files + `.gitkeep` | — | Yes |
| B5 | Media SHA-256 manifest | `uploads/` | path, bytes, SHA-256, MIME, dimensions | — | No |
| B6 | Environment key inventory | `.env` files | **key names + state only** | values | No |
| B7 | Environment value vault | `.env` files | full values | — | Yes |
| B8 | Domain/DNS snapshot | registrar/panel | A/AAAA/CNAME/MX/TXT, TTL, nameservers | — | No |
| B9 | Production DB dump | production | full dump + checksum | — | Yes |
| B10 | Production media archive | production | files + manifest | — | Yes |
| B11 | Content exports | DB | products, company info, settings, nav, banners, USPs, upcoming, gallery, reviews | hashes/secrets | Yes (PII) |
| B12 | WordPress staging backup | staging | files + DB, before cut-over | — | Yes |

---

## 5. Naming, storage and retention

### Naming convention
```
swift-backup-YYYYMMDD-HHMMSS/
  B1-source/
  B2-db-file/
  B3-db-export/
  B4-media/
  B5-manifest/
  B6-env-keys/
  B7-env-values/        (encrypted)
  B8-dns/
  B9-prod-db/           (encrypted)
  B10-prod-media/
  B11-content-exports/  (encrypted)
  SHA256SUMS.txt
```

### Storage
| Copy | Location | Access |
|---|---|---|
| 1 | Local encrypted external drive | Owner + migration lead |
| 2 | Client-controlled cloud storage (private bucket) | Owner + migration lead |
| 3 | Offline/off-site encrypted archive | Owner |

**Forbidden destinations:** the project folder, any git repository, public cloud links, chat attachments, email attachments.

### Retention
| Backup | Retention |
|---|---|
| B1–B8 (pre-migration) | Until 90 days after successful cut-over |
| B9–B11 (production) | Until 90 days after cut-over, then per legal policy |
| B12 (staging pre-cutover) | 30 days after cut-over |
| Final production backup | Per client retention policy (minimum 12 months) |

---

## 6. Procedures

> Run every command from the repository root unless stated otherwise. Replace placeholders like `<HOST>` manually; never paste secrets into a shared shell history. Use `Read-Host -AsSecureString` or let tools prompt.

### B1 — Source code snapshot

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dest  = "D:\swift-backups\swift-backup-$stamp\B1-source"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
robocopy . $dest /E /XD node_modules .next dist .turbo .git /XF *.log
Get-ChildItem $dest -Recurse -File | Get-FileHash -Algorithm SHA256 |
  Select-Object Hash, Path | Export-Csv "$dest\..\B1-sha256.csv" -NoTypeInformation
```

Acceptance: source tree opens; `package.json` files present; no `node_modules`; hash file created.

### B2 — Local database file copy (preserve the existing `.bak`)

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dest  = "D:\swift-backups\swift-backup-$stamp\B2-db-file"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item 'apps\backend\prisma\dev.db' "$dest\dev.db"          # never overwrite the .bak
Copy-Item 'apps\backend\prisma\dev.db.bak-cms-20261027-161054' "$dest\" -ErrorAction SilentlyContinue
Get-FileHash "$dest\dev.db" -Algorithm SHA256
```

**Rule:** do not use `Move-Item`, do not delete, do not rename the original `.bak`, do not run `prisma db push/reset/seed`.

### B3 — Local database logical export (JSON + CSV)

Use a **read-only** connection. Full export contains PII and password hashes → encrypt immediately.

Procedure outline (Node 22+ with `node:sqlite`):

1. Open `dev.db` with `readOnly: true`.
2. List all tables from `sqlite_master` (exclude `sqlite_*`).
3. For each table: `SELECT *` → write `table.json`; flatten to CSV with proper quoting.
4. Write `_manifest.json` containing: table name, row count, export timestamp, source file size, SHA-256.
5. Verify row counts against the verified baseline (§7).
6. Encrypt the output folder (7-Zip AES-256 or OS-level encrypted volume) and delete the plaintext copy after verification.

**Do not** include plaintext exports in the project folder or repository.

### B4 — Local media archive

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dest  = "D:\swift-backups\swift-backup-$stamp\B4-media"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item 'apps\backend\uploads\*' $dest -Recurse -Force
Compress-Archive -Path "$dest\*" -DestinationPath "D:\swift-backups\swift-backup-$stamp\media.zip" -CompressionLevel Optimal
```

Acceptance: 32 files (plus `.gitkeep`), 37,907,247 bytes excluding `.gitkeep`, archive opens.

**Never delete or "clean up" media during backup.**

### B5 — Media SHA-256 manifest

For every file record:

| Field | Example |
|---|---|
| Relative path | `apps/backend/uploads/products/<uuid>.png` |
| URL path | `/uploads/products/<uuid>.png` |
| Bytes | `1882943` |
| SHA-256 | full 64-char hash |
| MIME / format | `image/png` |
| Width × height | `1448×1086` |
| Referenced by | product slug / banner / company key / none |
| Duplicate group | hash prefix if duplicated |

Store as CSV + JSON. This manifest is the acceptance test for the WordPress media import later.

### B6 — Environment variable names (safe inventory)

- Record **key names**, whether each is set/empty, and a classification (URL scheme, enum value, length class).
- **Never record values.**
- The existing `ENVIRONMENT_VARIABLES.md` already satisfies this for the local environment.
- For production, repeat the same key-name inventory from the hosting panel.

### B7 — Environment value vault

- Export `.env` files into an encrypted vault entry (1Password/Bitwarden/KeePass).
- Label: `Swift Instruments — legacy stack env — <date>`.
- Restrict access to owner + migration lead.
- Rotate all secrets at cut-over; archive the old entry as "retired" (do not delete until rollback window closes).

### B8 — Domain and DNS snapshot

From the registrar/panel:
1. Screenshot or export the DNS zone: A, AAAA, CNAME, MX, TXT (SPF/DKIM/DMARC), TTL, nameservers.
2. Record registrar, expiry date, lock status, and who controls it.
3. Record the canonical host decision (`www` vs apex) and current redirects.
4. Store the snapshot with the backups.

**No DNS record may be changed in Phase 0.** Email records (MX/TXT) must be preserved at cut-over.

### B9 — Production database (when access exists)

Preferred: host panel export.
Alternative (run by the owner/host, credentials via prompt/vault):

```bash
# MySQL / MariaDB
mysqldump --single-transaction --routines --triggers --default-character-set=utf8mb4 \
  -h <HOST> -u <USER> -p <DATABASE> > swift_prod_YYYYMMDD.sql

# PostgreSQL
pg_dump -h <HOST> -U <USER> -d <DATABASE> -Fc -f swift_prod_YYYYMMDD.dump
```

Then:
1. Compute SHA-256.
2. Record row counts and table list.
3. Restore into a temporary database and query a few tables.
4. Store the dump encrypted; delete any unencrypted intermediate file.

**Do not** request the DB password in chat. Use the panel or a password manager.

### B10 — Production media (when access exists)

1. Archive the server uploads directory (SFTP/File Manager) or export the bucket.
2. Preserve folder structure and original filenames.
3. Generate a manifest (same schema as B5).
4. Compare against production content references.
5. Store encrypted.

### B11 — Content exports (products, company info, existing website content)

| Export | Source | Format | Notes |
|---|---|---|---|
| Products | DB `Product` | JSON + CSV | Include specs JSON; exclude nothing except secrets (none) |
| Company info | DB `CompanyInfo` | JSON + CSV | Contains contact data, not secrets |
| Settings | DB `Setting` | JSON + CSV | Contains recipients/social links |
| Navigation | `NavigationLink` | CSV | |
| Banners | `HeroBanner` | CSV + media refs | |
| USPs / Upcoming / Gallery / Reviews | respective tables | CSV | |
| Static pages | `apps/web/src/app/privacy`, `terms` | extract JSX text | Manual copy into blocks later |
| Section/heading copy | web components | text file | Needed because it is hardcoded |
| SEO metadata | `page.tsx` files | CSV | Title, description, path |
| Enquiries | DB `Enquiry` | CSV | **PII — encrypted, access-limited** |
| Admins | DB `Admin` | CSV **without** `passwordHash`/`mfaSecret` | Username/email/role only |

### B12 — Staging backup (Phase 1, for completeness)

Before any cut-over: `wp db export`, archive `wp-content`, export plugin/theme list, store encrypted, prove restore.

---

## 7. Verification baseline

Use these verified numbers to prove a restore is complete:

| Check | Expected |
|---|---|
| Tables | 14 |
| Total rows | 310 |
| Products | 11 |
| Company info keys | 21 |
| Navigation links | 9 |
| Banners | 3 |
| Why Choose Us | 6 |
| Upcoming products | 3 |
| Gallery items | 8 |
| Reviews | 4 |
| Settings | 5 |
| Enquiries | 6 |
| Admins | 2 (hashes excluded from reports) |
| Media rows | 32 |
| Audit rows | 200 |
| Email OTP rows | 0 |
| Media files (excl. `.gitkeep`) | 32 |
| Media bytes (excl. `.gitkeep`) | 37,907,247 |

A backup is accepted only when **all** counts match and a restore has been opened read-only successfully.

---

## 8. Restore test procedure

1. Copy the backup to a **temporary/isolated** folder (not over the originals).
2. Open the DB copy read-only and run the §7 counts.
3. Extract the media archive to a temp folder; verify file count and SHA-256 manifest.
4. Restore the source snapshot to a temp folder; confirm `package.json` and app folders exist.
5. Record results in a restore log (date, operator, checks, outcome).
6. Delete temporary plaintext after verification; keep the encrypted archive.

**A backup without a successful restore test is not a backup.**

---

## 9. Backup execution checklist

| # | Task | Owner | Status |
|---|---|---|---|
| 1 | Create timestamped backup root outside project | Migration lead | ☐ Pending |
| 2 | B1 source snapshot + hash | Migration lead | ☐ Pending |
| 3 | B2 DB file copy (preserve `.bak`) | Migration lead | ☐ Pending |
| 4 | B3 logical JSON/CSV export + manifest | Migration lead | ☐ Pending |
| 5 | B4 media archive | Migration lead | ☐ Pending |
| 6 | B5 SHA-256 media manifest | Migration lead | ☐ Pending |
| 7 | B6 env key inventory | Migration lead | ☐ Pending |
| 8 | B7 env values to vault | Owner | ☐ Pending |
| 9 | B8 DNS/registrar snapshot | Owner | ☐ Pending |
| 10 | B9 production DB dump | Owner/Host | ☐ **Blocked** |
| 11 | B10 production media archive | Owner/Host | ☐ **Blocked** |
| 12 | B11 content exports | Migration lead | ☐ Pending |
| 13 | Encrypt + store 3 copies | Owner | ☐ Pending |
| 14 | Restore test + log | Migration lead | ☐ Pending |
| 15 | Sign-off | Owner | ☐ Pending |

---

## 10. Do-not-do list

- ❌ Do not overwrite/delete `dev.db.bak-cms-20261027-161054`.
- ❌ Do not run `prisma db push`, `db reset`, `db seed`, or any write query.
- ❌ Do not delete or compress original media in place.
- ❌ Do not store backups in the project folder, git, chat or public links.
- ❌ Do not print credentials, hashes of passwords, or secret values in reports.
- ❌ Do not change DNS, MX or hosting during Phase 0.
- ❌ Do not use the existing `JWT_SECRET` in WordPress.
- ❌ Do not treat a file copy as a verified backup without a restore test.

---

## 11. Sign-off

| Role | Name | Confirms | Date |
|---|---|---|---|
| Owner | | Backup locations + encryption | |
| Migration lead | | Procedures + restore baseline | |
| Hosting admin | | Production export path (B9/B10) | |
