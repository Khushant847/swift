# Deploying Swift Instruments on Vercel (Services)

This monorepo deploys as **one Vercel project with three services**, plus MySQL
and object storage:

| Service | Path in repo | Public path | Runtime |
| --- | --- | --- | --- |
| `web` — public website | `apps/web` | `/` (everything not matched below) | Next.js |
| `admin` — admin console | `apps/admin` | `/admin`, `/admin/*` | Vite static SPA |
| `backend` — REST API | `apps/backend` | `/api/*`, `/uploads/*` | Express (Node) |

Root [`vercel.json`](../vercel.json) is the only deployment config — there is no
per-app `vercel.json`.

```jsonc
{
  "regions": ["bom1"],
  "services": {
    "admin":   { "root": "apps/admin",   "framework": "vite" },
    "backend": { "root": "apps/backend", "framework": "express",
                 "entrypoint": "src/server.ts",
                 "buildCommand": "node scripts/prisma-generate.mjs" },
    "web":     { "root": "apps/web",     "framework": "nextjs",
                 "bindings": [{ "type": "service", "service": "backend",
                                "format": "url", "env": "BACKEND_URL" }] }
  },
  "rewrites": [
    { "source": "/admin",       "destination": { "service": "admin" } },
    { "source": "/admin/(.*)",  "destination": { "service": "admin" } },
    { "source": "/api/(.*)",    "destination": { "service": "backend" } },
    { "source": "/uploads/(.*)","destination": { "service": "backend" } },
    { "source": "/(.*)",        "destination": { "service": "web" } }
  ]
}
```

Why this shape:

- Services are **private by default**; the top-level rewrites are what expose
  them. A service never sees another service's routes.
- `web` gets `BACKEND_URL` from the **binding** at runtime. Bindings do not exist
  during `next build`, so server components read it per request
  (`apps/web/src/lib/api.ts`). The build may log a warning — that is expected.
- The admin SPA is built with `base: '/admin/'` and talks to the API on the
  **same origin** (`/api/...`). That keeps the HttpOnly, `SameSite=Strict` auth
  cookie working. Do **not** set `VITE_API_URL` in production.
- `express.static()` is ignored on Vercel, and the function filesystem is
  read-only/ephemeral. `/uploads/*` is served by a handler in
  `apps/backend/src/app.ts` that streams from local disk (dev) or S3 (prod).

---

## 1. Prerequisites

1. Repo pushed to GitHub/GitLab/Bitbucket.
2. **MySQL 8+** database reachable from Vercel (PlanetScale, Aiven, RDS, etc.).
   SQLite is dev-only and cannot persist on Vercel.
3. An **S3-compatible bucket** (AWS S3, Cloudflare R2, DO Spaces, MinIO) for
   uploads.
4. SMTP credentials for real email/MFA delivery (otherwise `MAIL_DRIVER=console`
   only logs messages).
5. Vercel CLI (`npx --yes vercel@latest`) and a logged-in account.

---

## 2. Database (MySQL 8+)

Apply the schema from a machine that can reach the database — **never** run
migrations in the Vercel build:

```bash
cd apps/backend
DATABASE_URL='mysql://USER:PASS@HOST:3306/DB' \
  npx prisma migrate deploy --schema prisma/schema.mysql.prisma
```

Then seed only if this is a fresh, empty database:

```bash
DATABASE_URL='mysql://...' npm run db:seed
```

How clients are generated:

- Local dev / tests → `prisma/schema.prisma` (SQLite) → `npm run db:generate`.
- Production build → `node scripts/prisma-generate.mjs` (MySQL). Vercel runs this
  via the backend service's `buildCommand`; locally you can force it with
  `npm run db:generate:prod`. Both write to the default `@prisma/client`
  location, so the app code does not branch on provider.

---

## 3. Object storage (uploads)

Create a bucket and an access key with read/write permission for that bucket.
Media is stored under the `uploads/` prefix and served by the API's
`/uploads/*` route with immutable cache headers.

```bash
# Preview what would be copied (no credentials needed beyond the bucket name)
S3_BUCKET=my-bucket npm run storage:migrate

# Copy existing local files (safe: skips objects that already exist)
S3_BUCKET=my-bucket \
S3_REGION=ap-south-1 \
S3_ACCESS_KEY_ID=... \
S3_SECRET_ACCESS_KEY=... \
  npm run storage:migrate -- --apply
```

The script only uploads — it never edits or deletes database rows or local
files. Existing rows keep their `/uploads/...` URLs and resolve against the
bucket automatically.

Optional: set `S3_PUBLIC_URL` (e.g. `https://cdn.example.com`) so **new** uploads
return absolute CDN URLs. Leave it empty to serve everything through `/uploads`
(simpler, and cached at the edge).

---

## 4. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production
and Preview). Values below are placeholders.

### backend

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | `mysql://USER:PASS@HOST:3306/DB` |
| `JWT_SECRET` | yes | ≥ 32 random chars; the API refuses to start in production without it |
| `CORS_ORIGINS` | yes | Comma-separated public origins, e.g. `https://swiftinstruments.in,https://www.swiftinstruments.in`. The admin's mutating requests send an `Origin` header, so omitting it returns 403 |
| `COOKIE_DOMAIN` | no | Leave **empty** (host-only cookie) |
| `PUBLIC_BASE_URL` | yes | Public site origin (used in emails/logs) |
| `STORAGE_DRIVER` | yes | `s3` |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | yes | `S3_REGION` may be `auto` for R2 |
| `S3_ENDPOINT` | R2/Spaces/MinIO | Omit for AWS S3 |
| `S3_PUBLIC_URL` | no | CDN/bucket origin; empty = proxy through `/uploads` |
| `S3_FORCE_PATH_STYLE` | no | `true` for MinIO/most self-hosted gateways |
| `UPLOAD_MAX_MB` | no | Default 25 |
| `MAIL_DRIVER` | yes | `smtp` in production |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | yes with SMTP | |
| `MAIL_FROM` | no | Sender address |
| `TRUST_PROXY` | no | Defaults to `1` in production (Vercel proxy) |
| `REDIS_URL` | recommended | Distributed rate limiting across function instances |

### web

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonicals/sitemap use it; e.g. `https://swiftinstruments.in` |
| `NEXT_PUBLIC_API_URL` | **leave empty** | Empty = same-origin `/api`; a value is inlined at build time and points browsers elsewhere |
| `BACKEND_URL` | injected | Do not set manually — the service binding provides it |

### admin

No variables required. `VITE_API_URL` must stay empty (same-origin `/api`).
`VITE_PROXY_TARGET` is dev-only.

> `NEXT_PUBLIC_*` and `VITE_*` values are baked in at build time. Everything else
> is read at runtime; changing it only needs a redeploy, not a rebuild.

---

## 5. Deploy

```bash
npx --yes vercel@latest login
npx --yes vercel@latest link          # creates .vercel/ and links the project

# Add env vars (repeat per variable; or use the dashboard)
npx --yes vercel@latest env add DATABASE_URL production

# Preview first
npx --yes vercel@latest

# Production
npx --yes vercel@latest --prod
```

Before the first production deploy, make sure the database schema is applied
(section 2) and local media is copied (section 3).

---

## 6. Post-deploy checks

```bash
# API readiness (DB connected) — expect {"success":true,...}
curl -s https://YOUR-DOMAIN/api/health

# Public data — expect a non-zero total
curl -s 'https://YOUR-DOMAIN/api/v1/products?limit=1'

# Uploaded media — expect 200 + image/video content type + immutable cache
curl -sI https://YOUR-DOMAIN/uploads/banners/<file>

# Admin SPA assets must be under /admin/assets/
curl -sI https://YOUR-DOMAIN/admin/ | head
```

Then open `https://YOUR-DOMAIN/admin`, log in, upload an image, and confirm it
renders on the public site (that exercises S3 write + `/uploads` read).

---

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Deployment crash: `JWT_SECRET` invalid | Set a ≥ 32-char `JWT_SECRET` for the environment |
| `/api/*` returns 500, logs mention Prisma engine/provider | `DATABASE_URL` is MySQL but the client was generated for SQLite. Confirm `node scripts/prisma-generate.mjs` ran in the backend build (it prints `provider=mysql`) |
| Admin login returns 403 | `CORS_ORIGINS` is missing the exact origin (scheme + host) |
| Images 404 under `/uploads/...` | Bucket credentials/bucket missing, or old files were never copied — run `npm run storage:migrate -- --apply` |
| Admin page loads but is blank | Assets 404 — the build must use `base: '/admin/'` (set in `apps/admin/vite.config.ts`) |
| Web pages show stale/no data | `BACKEND_URL` is injected at runtime only. Check the function logs for the resolved origin; do not hardcode `localhost` |
| `express.static()` warnings | Expected: static serving is replaced by the `/uploads` handler |

---

## Notes and limits

- Vercel Functions are ephemeral: any write to the local filesystem is lost.
  MySQL + object storage are the durable stores.
- `/uploads` responses are cached as `immutable`; because filenames are random
  UUIDs, replacing a file means uploading a new one (the admin already does).
- `admin` is publicly reachable at `/admin` but protected by login + MFA and
  sends `noindex, nofollow`.
- Logs: `vercel logs <deployment-url>` or the dashboard's Functions tab.
