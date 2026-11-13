# Deploying the Swift Instruments website on Vercel

This project is a **monorepo**:

| App | Path | Host |
| --- | --- | --- |
| Public website (Next.js) | `apps/web` | **Vercel** |
| Admin panel (Vite SPA) | `apps/admin` | Vercel / Netlify (separate project) |
| REST API (Express + Prisma) | `apps/backend` | Railway / Render / Fly.io / VPS |

> Vercel can host the Next.js website, but **not** the Express API, SQLite database or local uploads folder as-is. The API must be deployed and reachable over HTTPS before the website can show live content.

---

## 1. Prerequisites

1. Code pushed to **GitHub / GitLab / Bitbucket** (Vercel deploys from Git).
2. Backend deployed at a public HTTPS URL, e.g. `https://api.yourdomain.com`.
3. PostgreSQL database for production (not SQLite).
4. Persistent storage for uploads:
   - a mounted volume at `apps/backend/uploads`, **or**
   - an S3/Cloudinary driver implemented in `apps/backend/src/lib/storage.ts`.
5. A Vercel account. Use **Pro** for a commercial website (Hobby is for personal, non-commercial projects).

---

## 2. Deploy the backend first

The website fetches products, banners, reviews and company info from the API. Deploy the API before the first production build.

### Build settings (Railway / Render)

- **Root directory:** repository root
- **Build command:**
  ```bash
  npm install && npm run db:generate:postgres -w @swift/backend && npm run build -w @swift/backend
  ```
- **Start command:**
  ```bash
  node apps/backend/dist/server.js
  ```
- **Health check:** `/health/ready`

### Database

Use `apps/backend/prisma/schema.postgres.prisma` for PostgreSQL. Apply it once:

```bash
npx prisma db push --schema apps/backend/prisma/schema.postgres.prisma
```

Do **not** run `npm run db:seed` in production — it inserts demo reviews, placeholder images and unverified claims.

### Environment variables

```env
NODE_ENV=production
PORT=4000
PUBLIC_BASE_URL=https://api.yourdomain.com
DATABASE_URL=postgresql://...
JWT_SECRET=<long-random-secret>
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://admin.yourdomain.com
COOKIE_DOMAIN=.yourdomain.com
STORAGE_DRIVER=local
UPLOAD_MAX_MB=25
```

If you use email, set the SMTP values. If you use a persistent disk, mount it at `apps/backend/uploads`.

---

## 3. Import the website into Vercel

1. Vercel → **Add New → Project** → import the repository.
2. Set **Root Directory** to `apps/web`.
3. Framework preset: **Next.js** (auto-detected).
4. Leave Build and Install commands at their defaults — Vercel detects the npm workspace root.
5. If the build cannot find workspace files outside `apps/web`, enable:
   **Settings → General → Include source files outside of the Root Directory in the Build Step**.
6. Add the environment variables below **before** the first production build.

### Environment variables

| Name | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.com` | Final custom domain, no trailing slash |
| `API_URL` | `https://api.yourdomain.com` | Public backend URL used by SSR/build |
| `NEXT_PUBLIC_API_URL` | *(empty)* | Browser uses the same-origin `/api` proxy |
| `NEXT_PUBLIC_REVALIDATE` | `60` | ISR window |
| `NEXT_PUBLIC_COMPANY_REVALIDATE` | `15` | Header/footer branding refresh |
| `API_FETCH_TIMEOUT_MS` | `5000` | Per-attempt API timeout |

`NEXT_PUBLIC_SITE_URL` is compiled into the build. If you change the domain later, **redeploy** the website.

The included `apps/web/vercel.json` sets the function region to `bom1` (Mumbai). Change it if your backend or audience is elsewhere.

---

## 4. Connect the domain bought from WordPress.com

You do **not** need WordPress hosting. A custom domain registered at WordPress.com can point to Vercel.

1. Vercel → Project → **Settings → Domains** → add:
   - `yourdomain.com`
   - `www.yourdomain.com`
2. Vercel shows the exact DNS values for **this project**. Use those values, not values from old guides.
3. WordPress.com → **Hosting Dashboard → Domains → your domain → DNS records**:
   - Replace the default `A @` record with Vercel's A record.
   - Replace the `www` CNAME with Vercel's CNAME target.
   - Keep existing **MX** and **TXT** records so email keeps working.
   - Do **not** add an AAAA record.
4. Wait for propagation. Vercel issues SSL automatically.
5. In Vercel, choose your primary domain (`yourdomain.com` or `www.yourdomain.com`) and redirect the other to it.
6. Make sure `NEXT_PUBLIC_SITE_URL` matches the primary domain exactly, then redeploy.

> If WordPress.com does not allow replacing the records, or the domain is locked to a WordPress plan, transfer the domain to Cloudflare Registrar or Namecheap after the 60-day ICANN lock.

---

## 5. Build behaviour and ISR

- All public pages are cached with ISR. The product detail page is server-rendered on demand.
- If the API is unreachable **during** the Vercel build, pages are built with empty fallbacks and marked dynamic where possible. They recover on the next revalidation, but the first crawl may see empty content.
- **Keep the API online during the production build** for correct first-paint content and SEO.
- Preview deployments are automatically sent `X-Robots-Tag: noindex` and `noindex` metadata so they do not compete with production.

---

## 6. Verify after deployment

```bash
# Home page and headers
curl -I https://yourdomain.com

# SEO routes must show the real domain, not localhost
curl https://yourdomain.com/robots.txt
curl https://yourdomain.com/sitemap.xml

# Canonical + JSON-LD in the HTML
curl -s https://yourdomain.com/ | grep -E 'canonical|application/ld\+json'
```

Then check:

- `https://yourdomain.com/sitemap.xml` → all URLs start with `https://yourdomain.com`
- `https://yourdomain.com/robots.txt` → sitemap URL is correct
- `https://yourdomain.com/sitemap-page` → `noindex, follow`
- A product URL → canonical, Product JSON-LD, BreadcrumbList
- Unknown URL → real **404**
- Enquiry form → succeeds and creates an enquiry in the admin
- Images in the header, gallery and products → load through `/uploads` or your CDN
- Vercel preview URL → `X-Robots-Tag: noindex, nofollow`

---

## 7. Known production limitations

1. **SQLite is not suitable for Vercel/serverless.** Use PostgreSQL.
2. **Local uploads are not persistent on Vercel.** The API must run with a persistent volume or cloud storage.
3. **Vercel Hobby is non-commercial.** Use Pro for this business site.
4. **Demo content still needs review.** Replace/remove seeded reviews, ISO/NABL/CE claims, `120+`, `15,000+`, founder name and picsum placeholder images before launch.
5. **NEXT_PUBLIC_SITE_URL is build-time.** Changing it requires a redeploy.
6. **Domain email**: do not delete MX/TXT records while changing website DNS.
