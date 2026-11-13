# Swift Instruments — Website + Admin Control System

Production-grade monorepo for the **Swift Instruments** corporate website and its enterprise
Admin Panel / CMS, implemented from `prd.md` and `architecture.md`.

```
apps/
  backend/   Node.js + Express + Prisma REST API (security-hardened)
  web/       Next.js (App Router / SSR) + Tailwind — public website
  admin/     React + Vite SPA + Tailwind — protected admin panel
```

---

## Tech Stack

| Layer         | Choice                                            |
| :------------ | :------------------------------------------------ |
| Website       | Next.js (App Router, SSR/SSG) + Tailwind + Lucide |
| Admin Panel   | React + Vite (SPA) + Tailwind + Lucide            |
| API           | Node.js + Express + Prisma ORM                    |
| Database      | SQLite for local dev (Postgres-ready schema)      |
| Media         | Local disk adapter now, S3/Cloudinary-ready       |
| Auth          | JWT in HttpOnly cookies + MFA (TOTP / Email OTP)  |
| Email         | Nodemailer (console dev transport, SMTP via env)  |

---

## Deployment

The public website (`apps/web`) can be hosted on **Vercel**; the Express API,
database and uploads need a separate host. See
[`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md) for the full setup, environment
variables, domain/DNS steps and post-deploy checks.

---

## Quick Start

```bash
# 1. install everything (npm workspaces)
npm install

# 2. create env files from the examples
copy apps\backend\.env.example apps\backend\.env
copy apps\web\.env.example apps\web\.env.local
copy apps\admin\.env.example apps\admin\.env

# 3. create + seed the database, then run all three apps
npm run setup
npm run dev
```

`npm run dev` starts the API first and waits for **readiness** (`GET /health/ready` returns
HTTP 200, meaning the database answers) before starting the website and admin panel. A slow
Prisma/SQLite start therefore never produces a first render with missing products or images.
If the API is already running, the readiness gate succeeds immediately. The wait is bounded
(90 s by default; override with `API_READY_TIMEOUT_MS`) and prints an actionable error instead
of hanging forever.

```bash
# run the pieces individually if you prefer separate terminals
npm run dev:api
npm run dev:web      # website only (starts even if the API is offline; ISR refetches)
npm run dev:admin
```

| App         | URL                     |
| :---------- | :---------------------- |
| Website     | http://localhost:3000   |
| Admin Panel | http://localhost:5173   |
| REST API    | http://localhost:4000   |

### Health checks

| Endpoint             | Meaning                                                        |
| :------------------- | :------------------------------------------------------------- |
| `GET /health`        | Liveness — the API process is accepting requests.               |
| `GET /health/ready`  | Readiness — process **and** database are usable (503 if not).   |
| `GET /api/health`    | Same readiness probe on the `/api` path (used by the website).  |

The website polls `/api/health` only while it believes the backend is offline, shows a
"Reconnecting…" banner, and calls `router.refresh()` once the API recovers. Server-side API
fetches retry transient failures (connection refused, 5xx, 408/429) with bounded backoff.

If the backend is down during `next build`, affected routes are marked dynamic instead of
being pre-rendered with empty content, so the first request after startup renders live data.
Tune the windows with `API_FETCH_TIMEOUT_MS`, `NEXT_PUBLIC_REVALIDATE` and
`NEXT_PUBLIC_COMPANY_REVALIDATE` in `apps/web/.env`.

### Default seeded admin

| Email                     | Password        | Role          |
| :------------------------ | :-------------- | :------------ |
| `admin@swiftinstruments.in` | `Admin@12345` | `super_admin` |
| `editor@swiftinstruments.in`| `Editor@12345`| `content_editor` |

> MFA is **off** by default for these demo accounts (toggle it from *Settings → Security* inside the admin panel).

---

## Scripts (root)

| Script              | Purpose                                            |
| :------------------ | :------------------------------------------------- |
| `npm run dev`       | Start API, wait for readiness, then web + admin     |
| `npm run dev:api`   | Start only the backend API                         |
| `npm run dev:web`   | Start only the Next.js website                     |
| `npm run dev:admin` | Start only the admin SPA                           |
| `npm run build`     | Build all three apps                               |
| `npm run typecheck` | Type-check all three apps                          |
| `npm run db:push`   | Sync Prisma schema to the database                 |
| `npm run db:seed`   | Seed demo content + admin users                    |
| `npm run db:reset`  | Drop, re-create and re-seed the database           |

---

## Security Highlights

- **Auth** — bcrypt password hashing, JWT issued only into `HttpOnly`, `SameSite` cookies, 20-min
  session expiry, server-enforced **and** client-enforced inactivity auto-logout.
- **MFA / 2FA** — TOTP authenticator apps (`otplib` + QR) **and** email OTP via the mailer.
- **RBAC** — `super_admin` vs `content_editor`; `super_admin`-only routes for users/settings/backups.
- **Rate limiting** — strict sliding windows on `/auth/login`, `/auth/mfa`, and public `/enquiries`
  (Redis-compatible, in-memory fallback).
- **Validation & Sanitization** — Zod on every request body; `isomorphic-dompurify` strips unsafe HTML
  from WYSIWYG content before persistence.
- **Uploads** — mouthful MIME + extension allow-list, random UUID filenames, size caps.
- **Headers** — Helmet with a strict Content-Security-Policy, HSTS, frame/referrer policies.
- **CSRF / Origin guard** — mutating admin requests are checked against an origin allow-list.
- **Audit log** — every add/edit/delete/config change is recorded with actor, entity, IP and diff.

## Production notes

- Swap the Prisma datasource `provider = "sqlite"` → `"postgresql"` (see
  `apps/backend/prisma/schema.postgres.prisma`) and point `DATABASE_URL` at your Postgres instance.
- Set `REDIS_URL` to enable distributed rate-limit + session stores.
- Set `STORAGE_DRIVER=s3|cloudinary` and the matching credentials to move media off local disk.
- Set SMTP vars (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) to enable real email + OTP delivery.
