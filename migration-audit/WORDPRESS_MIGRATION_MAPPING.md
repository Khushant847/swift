# WORDPRESS MIGRATION MAPPING — Swift Instruments

**Audit date:** 13 Nov 2026
**Target:** Pure WordPress (PHP + MySQL) replacement of the Next.js website, Express API and React admin panel.
**Status:** Planning only — no WordPress installation, database, theme or plugin has been created.

---

## 1. Recommended migration strategy

| Decision | Recommendation | Why |
|---|---|---|
| CMS | WordPress (latest stable) with a **custom classic or block theme** built for this site | The current design is bespoke; a generic theme will not reproduce it |
| Content modelling | **Custom Post Types + ACF (or Meta Box) + native taxonomies** | Mirrors the relational model cleanly |
| Page builder | Gutenberg blocks + a small set of custom ACF blocks | Avoid heavy builders (Elementor/Divi) for performance and portability |
| Forms | A reputable form plugin (Gravity Forms / WPForms / CF7 + Flamingo) | Must support entries storage + CSV export + spam protection |
| SEO | Rank Math or Yoast | Recreate titles, canonicals, sitemap, schema |
| Media | Native Media Library, compressed WebP/AVIF, descriptive filenames | Improves on current UUID storage |
| Hosting | Hostinger (per stated intent) with PHP 8.2+, MySQL 8, object/page cache, daily backups | Matches the target stack |
| Staging | Mandatory staging site before cut-over | Content + redirect testing |
| Front-end | WordPress theme (no headless Next.js) | User's requirement is a pure WordPress migration |

**Not recommended:** keeping Next.js as a headless front end with WordPress as backend. It preserves the current complexity (two hosting environments, cache invalidation, CORS/cookies) and does not match the "pure WordPress" goal.

---

## 2. High-level data flow after migration

```
Visitor → WordPress (PHP) → MySQL
                │
                ├── Media Library (uploads/)
                ├── ACF fields / CPTs
                ├── Form plugin → entries + email
                └── SEO plugin → sitemap / schema
Admin → wp-admin (users, roles, nonces, MFA plugin)
```

Everything the Express API currently does must be covered by WordPress core, a plugin, or a small custom plugin.

---

## 3. Entity-by-entity mapping

### 3.1 Admin → `wp_users` / `wp_usermeta`

| Current | WordPress | Notes |
|---|---|---|
| `Admin.email` | `user_email` | Unique |
| `Admin.username` | `user_login` | Must be unique, sanitised |
| `Admin.passwordHash` (bcrypt) | `user_pass` (phpass) | **Cannot be reused** — force password reset on first login |
| `role = super_admin` | `administrator` | Full access |
| `role = content_editor` | `editor` (or custom `content_manager`) | Restrict plugins/settings |
| `isActive` | User role / `user_status` | Deactivate instead of delete |
| `mfaEnabled`, `mfaSecret` | Two-factor plugin | Re-enrol at cut-over |
| `lastLoginAt` | Plugin (WP Activity Log / Last Login) | Optional |
| AuditLog rows | WP Activity Log plugin | Historical rows can be imported read-only or archived |

### 3.2 Product → CPT `product` (+ ACF)

| Current field | WordPress | Type |
|---|---|---|
| `title` | `post_title` | text |
| `slug` | `post_name` | slug (unique, sanitised) |
| `category` | taxonomy `product_category` | term (trim whitespace!) |
| `shortDesc` | ACF `short_description` | textarea |
| `description` (HTML) | `post_content` | Gutenberg blocks (clean editor spans first) |
| `imageUrl` | Featured image + ACF `gallery` | attachment |
| `specs` (JSON string) | ACF repeater `specifications` (`label`, `value`) | repeater |
| `isFeatured` | ACF true/false `featured` | boolean |
| `isActive` | `post_status` (`publish` / `draft`) | status |
| `createdAt` | `post_date` | datetime |
| `updatedAt` | `post_modified` | datetime |
| — | ACF `seo_title`, `seo_description` | NEW (missing today) |
| — | ACF `product_code` | Optional, recommended |

**Data fixes required before import:** trailing-space category, `test-tube-warmer` content, duplicate/incorrect spec rows, escaped quotes/tabs in spec values.

### 3.3 HeroBanner → ACF Options repeater or CPT `hero_slide`

| Current | WordPress |
|---|---|
| `title` | slide heading |
| `subtitle` | slide subheading |
| `ctaLabel` / `ctaUrl` | link field |
| `mediaUrl` | image/video field |
| `mediaType` | select (image/video) |
| `displayOrder` | repeater order / menu_order |
| `intervalSeconds` | number |
| `isActive` | toggle |

### 3.4 WhyChooseUs → ACF repeater or CPT `usp`

| Current | WordPress |
|---|---|
| `title` | text |
| `description` | textarea |
| `icon` (Lucide name) | select field mapped to inline SVG or an icon font |
| `displayOrder` | repeater order |
| `isActive` | toggle |

### 3.5 UpcomingProduct → CPT `upcoming_product`

| Current | WordPress |
|---|---|
| `title` | `post_title` |
| `teaserDesc` | ACF textarea |
| `expectedLaunch` | ACF text/date |
| `imageUrl` | featured image |
| `displayOrder` | `menu_order` |
| `isActive` | `post_status` |

### 3.6 GalleryMedia → CPT `gallery_item` or native gallery block

| Current | WordPress |
|---|---|
| `mediaUrl` | attachment (image/video) |
| `mediaType` | auto-detected |
| `categoryTag` | taxonomy `gallery_tag` |
| `caption` | attachment caption / ACF caption |
| `uploadedAt` | `post_date` |
| — | NEW: alt text (required) |

### 3.7 Review → CPT `review`

| Current | WordPress |
|---|---|
| `authorName` | `post_title` |
| `rating` | ACF number 1–5 |
| `text` | `post_content` |
| `profilePhotoUrl` | ACF image |
| `source` | select (manual/google) |
| `googleReviewId` | ACF text (unique) |
| `isFeatured` | ACF toggle |
| `isHidden` | `post_status` (`publish`/`private`) or toggle |
| `reviewTime` | `post_date` |

**Caution:** only migrate reviews that the owner can substantiate. Demo testimonials should be replaced with real customer feedback.

### 3.8 CompanyInfo → ACF Options page "Company"

| Current key | WordPress field |
|---|---|
| `company_name` | Site title (`wp_options.blogname`) |
| `tagline` | Tagline (`blogdescription`) / ACF |
| `logo_url` | Custom Logo (theme mod) |
| `certifications` (JSON) | ACF repeater `certifications` (text) |
| `address` | ACF textarea (consider structured fields) |
| `phone`, `fax`, `mobile`, `whatsapp`, `email` | ACF text fields |
| `founder_name`, `founder_title` | ACF text |
| `founder_photo` | ACF image |
| `founder_bio` (HTML) | ACF wysiwyg |
| `history` (HTML) | ACF wysiwyg |
| `map_embed` | ACF oEmbed / raw iframe field |
| `map_url` | ACF URL |
| `established_year` | ACF number |
| `employees`, `installations` | ACF text (verify claims) |
| `working_hours` | ACF text |

### 3.9 Setting → `wp_options` / ACF Options

| Current key | WordPress |
|---|---|
| `enquiry_recipients` | Form plugin notification recipients |
| `footer_text` | ACF Options textarea / widget |
| `copyright` | ACF Options text |
| `legal_disclaimer` | ACF Options textarea |
| `social_links` (JSON) | ACF repeater (label, URL, icon) |

### 3.10 NavigationLink → WP Menus

| Current | WordPress |
|---|---|
| `location=header` | Menu assigned to `primary` |
| `location=footer` | Menu assigned to `footer` |
| `title` | Navigation label |
| `url` | Custom link / page / CPT archive |
| `position` | Menu order |
| `isActive` | Remove from menu |

Add missing pages: `/sitemap` (or use SEO plugin sitemap), plus real pages like "Quality", "Services" if the owner wants them.

### 3.11 Media → `wp_posts` (attachment) + `wp_postmeta`

| Current | WordPress |
|---|---|
| File bytes | `wp-content/uploads/YYYY/MM/` |
| `url` | `attachment guid` / metadata |
| `originalName` | Title / alt seed |
| `mimeType`, `size` | attachment metadata |
| `folder` | Optional taxonomy or folder plugin |
| `tags` | Media tags (plugin) or ACF |
| `width`, `height` | Regenerated by WordPress |
| UUID filename | Rename to descriptive slug; keep redirect map |

### 3.12 Enquiry → form entries (plugin) or CPT `enquiry`

| Current | WordPress |
|---|---|
| `name`, `email`, `phone`, `companyName`, `subject`, `message` | Form fields |
| `status` (`new`/`contacted`/`closed`) | Entry status / CPT taxonomy |
| `notes` | Entry note field |
| `ipAddress` | Entry metadata (privacy-aware retention) |
| `createdAt` | Entry date |
| CSV export | Plugin feature / custom exporter |
| Bulk actions | Plugin feature / WP bulk actions |

**Recommendation:** use a form plugin with entries (Gravity Forms or WPForms) rather than building a custom CPT, unless the CRM workflow needs heavy customisation.

### 3.13 AuditLog → WP Activity Log plugin

- Historical rows are not essential website content. Archive them as a CSV for compliance; do not attempt to import into a plugin's schema unless required.
- Configure the plugin to log content, user, settings and plugin changes going forward.

### 3.14 EmailOtp → not migrated

Empty table; MFA will be handled by the chosen two-factor plugin.

---

## 4. URL and redirect map

| Current URL | WordPress URL | Redirect |
|---|---|---|
| `/` | `/` | — |
| `/about` | `/about/` | 301 (trailing slash normalisation) |
| `/products` | `/products/` (CPT archive) | 301 |
| `/products/<slug>` | `/products/<slug>/` | 301; keep slugs stable |
| `/upcoming` | `/upcoming/` | 301 |
| `/gallery` | `/gallery/` | 301 |
| `/contact` | `/contact/` | 301 |
| `/privacy` | `/privacy-policy/` | 301 |
| `/terms` | `/terms/` | 301 |
| `/sitemap` | `/sitemap/` (HTML page) | 301 |
| `/sitemap.xml` | `/wp-sitemap.xml` or `/sitemap_index.xml` | 301 |
| `/robots.txt` | `/robots.txt` (SEO plugin) | Keep |
| `/llms.txt` | `/llms.txt` (custom route/plugin) | Optional |
| `/uploads/<uuid>.<ext>` | `/wp-content/uploads/...` | 301 via mapping table |
| Unknown product | 404 | Must return real HTTP 404 |

**Critical:** preserve product slugs exactly (`utility-table`, `laminar-air-flow-…`). Any change requires a redirect to avoid losing rankings and inbound links.

---

## 5. Feature parity matrix

| Feature | Current | WordPress plan | Parity |
|---|---|---|---|
| Public pages | Next.js SSR | Theme templates | Full |
| Product catalogue | Custom CRUD | CPT + ACF | Full |
| Product specs | JSON string | ACF repeater | Better |
| Hero slider | Custom | ACF + slider JS | Full |
| Gallery + video | Custom | Native/CPT + lightbox | Full |
| Reviews | Custom | CPT/plugin | Full |
| Enquiry form | Custom | Form plugin | Full |
| Enquiry CRM | Custom | Plugin entries / light CRM | Partial |
| CSV export | Custom | Plugin | Full |
| Media library | Custom | Native | Better |
| Image crop/guidance | Custom | Native + plugin | Partial |
| Admin users/RBAC | Custom | Native roles | Full |
| MFA | Custom | Plugin | Full |
| Audit log | Custom | Plugin | Full |
| Backup | Manual download | Plugin + host | Better |
| ISR caching | Next.js | Page cache + CDN | Equivalent |
| SEO metadata | Code-generated | SEO plugin | Full |
| JSON-LD | Code-generated | SEO plugin + custom | Full |
| `llms.txt` | Custom route | Custom plugin/route | Optional |
| API status banner | Custom | Not needed | Retired |
| Strict Zod validation | Custom | Plugin/theme validation | Must re-implement for forms |
| SameSite/Origin CSRF | Custom | WP nonces | Equivalent |
| Rate limiting | Express middleware | WAF/plugin/host | Equivalent |

---

## 6. Import pipeline (recommended order)

### Phase 0 — Preparation
1. Obtain **production** DB dump + uploads archive (currently missing).
2. Freeze content editing during the final export window.
3. Fix data defects (category, specs, product content, claims, placeholders).
4. Provision staging WordPress + MySQL + SSL.

### Phase 1 — Foundation
5. Install WordPress, choose theme base, install ACF/Meta Box, SEO plugin, form plugin, security/MFA plugin, backup plugin.
6. Create CPTs, taxonomies, ACF field groups, menus, roles.

### Phase 2 — Media
7. Compress/convert images; rename meaningfully; strip EXIF.
8. Import media with WP-CLI; write legacy-URL mapping (`_swift_legacy_url` postmeta).
9. Verify every content reference resolves.

### Phase 3 — Content
10. Import products → CPT (HTML cleaned, specs → repeater, taxonomy fixed).
11. Import company info → ACF Options.
12. Import banners, why-choose-us, upcoming, gallery, reviews.
13. Import settings + menus.
14. Recreate Privacy/Terms and all hardcoded copy as pages/blocks.

### Phase 4 — Functionality
15. Build enquiry form + notifications + spam protection + entries.
16. Configure redirects (legacy URLs, `/uploads`, trailing slashes).
17. Configure SEO titles/descriptions, schema, sitemap, robots.
18. Configure caching, image optimisation, security headers.

### Phase 5 — Verification
19. Content diff vs source (counts, titles, slugs, images, specs).
20. Crawl staging for 404s/broken media.
21. Test forms end-to-end (delivery + entries + CSV).
22. Lighthouse/Core Web Vitals, mobile, accessibility.
23. Redirect test matrix.

### Phase 6 — Cut-over
24. Final incremental content sync.
25. DNS switch with low TTL; keep old stack read-only for 30 days.
26. Submit sitemap, monitor Search Console, 404 logs, form delivery.
27. Decommission Next.js/Express only after the rollback window.

---

## 7. Data transformation rules

| Rule | Detail |
|---|---|
| Trim all category/title strings | Fixes `"Utility "` |
| Sanitise HTML with a conservative allow-list | Removes editor-specific `<span class="a_GcMg …">` noise |
| Convert HTML to blocks | `wp autop` + block conversion; manual review of product descriptions |
| Parse `specs` JSON safely | Drop rows with tab/quote corruption after manual correction |
| Boolean conversion | `0/1` → `false/true` |
| Timestamp conversion | Epoch ms → `Y-m-d H:i:s` in site timezone |
| Slug generation | `sanitize_title()`; verify uniqueness; preserve existing slugs |
| External URLs | Replace picsum/MDN placeholders before import |
| PII | Do not import test enquiries; anonymise if used for form testing |

**Sample transformation for specs**

```
Input : [{"label":"Pipe Size","value":"\"2\"\" × 2\"\"\""}]
Output: ACF repeater row → label: "Pipe Size", value: 2" × 2"
```

---

## 8. What cannot be migrated 1:1

| Item | Reason | Handling |
|---|---|---|
| bcrypt password hashes | WordPress uses phpass | Force reset |
| JSON `specs` strings | No native JSON field | Convert to repeater |
| Bespoke admin UI/UX | WordPress admin differs | Retrain users; document new workflows |
| Media guidance/crop dialog | Custom React components | Replace with plugin/native tools or accept loss |
| API status watcher | No client-side API in WP | Retire |
| `llms.txt` route | Custom Next.js route | Recreate as a small plugin if still wanted |
| ISR semantics | Different caching model | Page cache + purge on publish |
| Audit log history | Plugin schema differs | Archive CSV; start fresh |
| Test/demo data | Not real | Exclude |

---

## 9. Ownership and approvals needed

| Decision | Owner input required |
|---|---|
| Real vs demo content | Which products, reviews, stats, certifications are genuine |
| Founder identity | Confirm name/title/photo/bio |
| Product data corrections | Technical specs for each product, especially `test-tube-warmer` and `centrifuge` |
| Real photography | Gallery, upcoming products, banners, team |
| Domain + hosting | Final domain, Hostinger plan, SSL |
| Email sending | SMTP/provider, sender domain, SPF/DKIM |
| Enquiry workflow | Who receives leads, SLA, retention policy |
| Legal pages | Current privacy/terms text and jurisdiction |
| Analytics/consent | Whether GA4/Search Console/Ads will be added |

---

## 10. Access status

| Item | Status |
|---|---|
| Source systems | Fully inspected locally |
| Production data | **NOT ACCESSIBLE** |
| WordPress hosting | Not provisioned |
| Domain/DNS | **NOT ACCESSIBLE** |
| Brand guidelines | Not present |
| Content owner sign-off | Pending |
