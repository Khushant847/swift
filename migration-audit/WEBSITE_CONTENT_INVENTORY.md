# WEBSITE CONTENT INVENTORY — Swift Instruments

**Audit date:** 13 Nov 2026
**Application:** `apps/web` — Next.js 15 App Router (SSR/ISR), React 19, Tailwind
**Method:** Read-only review of every route, component, SEO helper and database row that feeds the public site.

---

## 1. Page inventory

| # | URL | Page | Rendering | Content source |
|---:|---|---|---|---|
| 1 | `/` | Home | Server (ISR 60 s) | DB: banners, featured products, company info, why-choose-us, upcoming, gallery, reviews; static section copy |
| 2 | `/about` | About Us | Server (ISR) | DB: company info + why-choose-us |
| 3 | `/products` | Products & Services | Server (ISR) | DB: products + categories |
| 4 | `/products/[slug]` | Product detail | Server (dynamic) | DB: single product + company info + enquiry form |
| 5 | `/upcoming` | Upcoming Products | Server (ISR) | DB: upcoming products |
| 6 | `/gallery` | Gallery | Server (ISR) | DB: gallery media + tags |
| 7 | `/contact` | Contact Us | Server (ISR) | DB: company info; client enquiry form + address/map |
| 8 | `/privacy` | Privacy Policy | Static | Hardcoded JSX |
| 9 | `/terms` | Terms of Service | Static | Hardcoded JSX |
| 10 | `/sitemap-page` | Sitemap (HTML) | Server | DB: nav + products |
| — | `/sitemap` (rewrite) | XML sitemap | Route handler | DB: nav + active products |
| — | `/robots.txt` | Robots | Route handler | `NEXT_PUBLIC_SITE_URL` |
| — | `/llms.txt` | LLM discovery file | Route handler | DB + site constants |
| — | 404 | Not Found | Static UI | Hardcoded |

### Global layout (every page)
| Area | Content | Source |
|---|---|---|
| Header top bar | Phone, email, address, certifications badges, WhatsApp | DB company info + settings |
| Header nav | 6 links | DB `NavigationLink` (header) |
| Logo | Image | DB `logo_url` |
| Footer | About blurb, quick links, product/category links, contact block, social icons, copyright, legal disclaimer | DB settings + company info + nav |
| Floating actions | WhatsApp, call, scroll-to-top | DB contact data |
| SEO / JSON-LD | Organization + WebSite schema | DB company info |
| API status watcher | "backend offline" banner | Runtime health check |

---

## 2. Home page composition

| Order | Section | Purpose | Data | Static copy present |
|---:|---|---|---|---|
| 1 | Hero carousel | 3 rotating slides with CTA + certification badges | `HeroBanner`, company certifications | Slide copy is CMS-driven |
| 2 | Why Choose Us | 6 USP cards | `WhyChooseUs` | Section heading |
| 3 | Featured products | Up to 6 featured products (5 exist) | `Product` (`isFeatured`) | Section heading |
| 4 | About company | Founder story, history, certifications, stats | `CompanyInfo` | Section heading |
| 5 | Upcoming products | 3 teaser cards | `UpcomingProduct` | Section heading |
| 6 | Gallery preview | Image/video grid + "View Full Gallery" link | `GalleryMedia` | Section heading + link label |
| 7 | Reviews | Carousel with average rating | `Review` | Section heading |
| 8 | Address & map | Address, hours, Google Map embed | `CompanyInfo` | Labels |
| 9 | Enquiry section | "Have a requirement? Let's talk." + phone/email + compact form | `CompanyInfo` + form | Yes (heading, copy, "Call Sales", response promise) |
| 10 | Footer | Sitemap + contact + socials | Settings/CompanyInfo | Labels |

**Verified:** the home page fetches all of the above in parallel via `Promise.all`; missing data degrades gracefully (sections hide rather than invent content).

---

## 3. Content volume (what migration actually moves)

| Content type | Records | Notes |
|---|---:|---|
| Pages with static copy | 2 (Privacy, Terms) | Hardcoded JSX, need manual block conversion |
| Products | 11 | HTML descriptions + JSON specs + image |
| Product categories | 3 (one malformed `"Utility "`) | Free-text, not a taxonomy |
| Hero banners | 3 | Image, title, subtitle, CTA |
| Why Choose Us cards | 6 | Icon names + text |
| Upcoming products | 3 | Placeholder images, empty teaser text |
| Gallery items | 8 | 7 external placeholders + 1 stock video |
| Reviews | 4 | Demo testimonials |
| Navigation links | 9 (6 header, 3 footer) | Flat menus |
| Company info keys | 21 | Contacts, founder, history, map, claims |
| Settings keys | 5 | Footer, copyright, disclaimer, socials, recipients |
| Media files | 32 (16 used) | Images/video on local disk |
| Enquiries | 6 (3 test) | CRM data, not website content |
| Admin users | 2 | Internal |
| Audit log | 200 | Internal |

---

## 4. Detailed content by page

### 4.1 Home
- Hero slides (CMS):
  1. "Engineering Accuracy You Can Trust" — ISO-certified calibration claim — CTA "About Swift Instruments".
  2. "Inside Our Manufacturing Facility" — CTA "View Gallery".
  3. "Precision Weighing Instruments" — CTA "Explore Products".
- Featured products rendered as cards: image, title, short description, category, "View details".
- About: founder name/title/photo/bio, history, certifications list (only first certification shown in stat tile), established year, employees, installations.
- Why Choose Us: ISO 9001 Certified, In-house Calibration, 25+ Years Experience, Nationwide Service, Custom Engineering, Rapid Support.
- Upcoming: SwiftScan X1, MicroBalance MX, AutoCheck Pro (all placeholder imagery).
- Reviews: 4 testimonials, average 4.75.
- Enquiry form: name, email, phone, company, subject, message.

### 4.2 About
- Page hero: "About Swift Instruments" + tagline.
- Founder section (photo, name, title, bio).
- History section (HTML paragraphs).
- Certifications and stats.
- Why Choose Us (repeated).
- Address/map.
- No separate team page, no careers page.

### 4.3 Products
- Category filter pills generated from active product categories.
- Search box (client-side over fetched list) and product grid.
- 11 active products.
- Each card links to `/products/<slug>`.

### 4.4 Product detail
- Breadcrumb, title, category, image, short description, long HTML description.
- Specs table rendered from JSON (safe parser tolerates malformed JSON).
- Enquiry form (compact) plus contact CTA.
- JSON-LD `Product` schema.
- 404 UI for unknown slug (`noindex`), with a documented caveat that the HTTP status can be 200 due to streaming (see risk report).

### 4.5 Upcoming
- 3 teaser cards.
- `expectedLaunch` shows "Coming soon" for all.
- No launch date, no notify-me form.

### 4.6 Gallery
- Filter by tag: Lab, Office, Team, Events.
- Image grid + video support (lightbox).
- Captions serve as alt text.
- All assets are external placeholders (picsum / MDN).

### 4.7 Contact
- Page hero: "Contact Us" + static subtitle.
- Two-column layout: enquiry form (left) and address/map (right).
- Static headings: "Send a Message", "Talk to our team", plus a support sentence.
- Address block shows company address, phone/fax/mobile, email, WhatsApp, working hours.
- Google Maps embed + "open in Maps" link.
- No Why Choose Us strip on this page.

### 4.8 Privacy Policy (static, "Last updated: January 2026")
Sections: Information we collect (name, email, phone, company, subject, message + IP), How we use it (respond, quote, support; no selling), Data retention (CRM; deletion via `sales@swiftinstruments.in`), Cookies (no tracking cookies; strict session cookie for admin), Contact (Greenfield, Faridabad).

### 4.9 Terms of Service (static, "Last updated: January 2026")
Sections: Website use (information only; specs subject to change), Quotations (not an order; written quotes), Intellectual property, Liability.

### 4.10 Sitemap (HTML + XML)
- HTML sitemap lists all pages, nav links and active products.
- XML sitemap includes 8 static routes + active product URLs; excludes `/sitemap`, `/sitemap-page`, `/api`.
- `robots.txt` disallows admin/api paths and points to the sitemap.
- `llms.txt` summarises the company and product catalogue for AI crawlers.

---

## 5. SEO metadata (verified)

| Page | Title | Description source |
|---|---|---|
| Home | "Swift Instruments — Precision Weighing & Measurement Solutions" | Static |
| About | "About Us" | Static |
| Products | "Products & Services" | Static |
| Product detail | Product title + brand | DB |
| Upcoming | "Upcoming Products" | Static |
| Gallery | "Gallery" | Static |
| Contact | "Contact Us" | Static |
| Privacy | "Privacy Policy" | Static |
| Terms | "Terms of Service" | Static |
| Sitemap | "Sitemap" | Static |

All pages get canonical URLs from `NEXT_PUBLIC_SITE_URL`, Open Graph/Twitter tags, and a default OG image. Unknown products get `noindex`.

---

## 6. Hardcoded copy that must be re-created in WordPress

These are **not** in the database and would be lost if only DB content is migrated:

1. Privacy Policy (all sections).
2. Terms of Service (all sections).
3. Page hero titles/subtitles ("About Swift Instruments", "Contact Us", etc.).
4. Section headings ("Featured Products", "Why Choose Us", "Upcoming Products", "Gallery", "What our customers say", …).
5. Form labels, placeholders and validation messages.
6. Footer column headings.
7. 404 page copy.
8. SEO titles/descriptions listed in §5.
9. JSON-LD schema text.

**Action:** export these strings from the JSX into the WordPress page content or a translation/strings file before decommissioning the Next.js app.

---

## 7. Dynamic/behavioural content

| Feature | Behaviour | WordPress implication |
|---|---|---|
| Hero autoplay | Interval per slide (default 5 s) | Slider plugin setting |
| Reviews carousel | Autoplay with pause control | Block/plugin |
| Gallery lightbox | Client-side modal | Lightbox plugin/block |
| Product search | Client-side filtering | WP search or plugin |
| Enquiry form | Client validation + server Zod + rate limit + captcha hook | Form plugin + spam protection |
| API status banner | Polls `/api/health` | Not needed (PHP renders server-side); could show maintenance notice |
| WhatsApp/call floating buttons | Deep links from company info | Theme setting |
| ISR revalidation | 60 s content / 15 s company | Page cache + purge-on-publish |

---

## 8. Content-quality / compliance flags

| # | Item | Where | Action before/at migration |
|---|---|---|---|
| C1 | ISO 9001, NABL, CE, Make in India claims | Company info, footer, why-choose-us, banner 1 | Verify certificates or remove |
| C2 | "120+ team members", "15,000+ installations", "25+ years" | Company info, why-choose-us | Verify or remove |
| C3 | Founder identity mismatch between seed (`S. K. Sharma`) and live DB (`Mr. B.V.S. Kashyap`) | DB vs seed file | Confirm the real founder details |
| C4 | 4 testimonials with full names | Reviews | Confirm consent or anonymise before publishing |
| C5 | Placeholder images | Gallery (8), Upcoming (3) | Replace with real photography |
| C6 | Generic social URLs | Footer | Replace with real profiles |
| C7 | Product content error | `test-tube-warmer` shows dry-bath content | Fix data before migrating |
| C8 | Malformed specs | `utility-table`, `centrifuge`, 5 others | Clean before importing to ACF repeaters |
| C9 | Legal pages dated "January 2026" | Privacy/Terms | Confirm current/valid |
| C10 | No cookie consent banner | Site-wide | Add if analytics/marketing tags are introduced in WordPress |

---

## 9. WordPress content model recommendation

| Current content | WordPress representation |
|---|---|
| Home | Front page composed of blocks + ACF fields |
| About | Page + ACF founder/history fields |
| Products | CPT `product` + ACF (specs repeater, short desc, category taxonomy) |
| Product categories | `product_category` taxonomy (fix `"Utility "` first) |
| Upcoming products | CPT `upcoming_product` |
| Hero banners | ACF options repeater or slider plugin |
| Why Choose Us | ACF repeater / CPT |
| Gallery | Native media + gallery block or CPT |
| Reviews | CPT `review` or plugin |
| Navigation | WP Menus (header/footer) |
| Company info | ACF Options page |
| Settings | ACF Options / Customizer |
| Privacy / Terms | Pages (block editor) |
| Sitemap | Native (`wp-sitemap.xml`) + SEO plugin |
| 404 | Theme template |
| Enquiry form | Form plugin + entries |

---

## 10. Access status

| Item | Status |
|---|---|
| Full public source | Inspected |
| Local rendered site | Not exercised in this audit (no dev server started) |
| Production website | **NOT ACCESSIBLE** |
| Analytics / Search Console | **NOT ACCESSIBLE** |
| Brand asset kit (logos, fonts, guidelines) | Not present in repo beyond uploaded images |
