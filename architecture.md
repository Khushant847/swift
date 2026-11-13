
# System Architecture Document
## Swift Instruments Website & Admin Control System 

---

## 1. High-Level Architecture Overview
The system follows a **Modern 3-Tier Architecture** decoupled into a responsive Client Frontend, a secure RESTful API Backend, and a Cloud-backed Relational Database & Media Storage.


```

+-----------------------------------------------------------------+
|                        CLIENT TIER                              |
|   [ Mobile Browser ]        [ Desktop Browser ]                 |
+--------------------------------+--------------------------------+
| HTTPS / SSL (TLS 1.3)
v
+-----------------------------------------------------------------+
|                     CDN & EDGE SECURITY                         |
|           Cloudflare (DDoS Protection, WAF, Edge Caching)       |
+--------------------------------+--------------------------------+
|
+-----------------------+-----------------------+
|                                               |
v                                               v
+------------------------+                     +------------------------+
|   FRONTEND (Client)    |                     |    ADMIN PANEL (SPA)   |
| Next.js / Tailwind CSS |                     |   React.js / Vite      |
+------------------------+                     +------------------------+
|                                               |
+-----------------------+-----------------------+
| REST API (HttpOnly Cookie JWT)
v
+-----------------------------------------------------------------+
|                      BACKEND API SERVER                         |
|            Node.js / Express.js (or Python / FastAPI)           |
|  - Redis Rate Limiting  - Input Sanitization  - RBAC Middleware |
+--------------------------------+--------------------------------+
|
+-----------------------+-----------------------+
|                                               |
v                                               v
+------------------------+                     +------------------------+
|    DATABASE STORAGE    |                     |     MEDIA STORAGE      |
|    PostgreSQL / MySQL  |                     |   AWS S3 / Cloudinary  |
| (Indexed & Connection  |                     | (Auto WebP / AVIF &    |
|        Pooled)         |                     |    Lazy Loading)       |
+------------------------+                     +------------------------+

```

---

## 2. Technology Stack & Performance Selection

| Layer | Technology Choice | Purpose |
| :--- | :--- | :--- |
| **Frontend (Website)** | Next.js (SSR / SSG) + Tailwind CSS | Lightning-fast page loads, superior SEO optimization, and pre-rendered static content. |
| **Admin Panel** | React.js / Vite (SPA) | Dynamic, component-driven dashboard for content management. |
| **Backend API** | Node.js with Express.js (or Python FastAPI) | Asynchronous request handling, robust routing, and security middleware. |
| **Database** | PostgreSQL or MySQL | ACID compliance, secure storage for products, enquiries, and credentials with indexed queries. |
| **Media Storage** | AWS S3 / Cloudinary | Scalable cloud storage with automated image/video compression (WebP/AVIF) and CDN delivery. |
| **Caching & Rate Limiting** | Redis | Session management, sliding-window rate limiting, and response caching for ultra-low latency. |
| **Hosting & Infra** | Vercel (Frontend) + AWS ECS / DigitalOcean (Backend) + NGINX | Scalable cloud deployment with SSL termination. |

---

## 3. Database Schema Design (Core Tables)

### 3.1. `admins` (Admin Users & RBAC)
* `id` (PK, UUID / INT)
* `username` (VARCHAR)
* `email` (VARCHAR, UNIQUE)
* `password_hash` (VARCHAR - Bcrypt)
* `role` (ENUM: `super_admin`, `content_editor`)
* `created_at`, `updated_at`

### 3.2. `navigation_links` (Header & Footer)
* `id` (PK)
* `title` (VARCHAR)
* `url` (VARCHAR)
* `position` (INT - for ordering)
* `location` (ENUM: `header`, `footer`)
* `is_active` (BOOLEAN)

### 3.3. `hero_banners` (Display Section Carousel)
* `id` (PK)
* `media_url` (VARCHAR)
* `media_type` (ENUM: `image`, `video`)
* `display_order` (INT)
* `interval_seconds` (INT)
* `is_active` (BOOLEAN)

### 3.4. `products_services`
* `id` (PK)
* `title` (VARCHAR)
* `category` (VARCHAR - Indexed for fast filtering)
* `description` (TEXT)
* `image_url` (VARCHAR)
* `is_featured` (BOOLEAN - shows on homepage)
* `created_at`

### 3.5. `company_info` (About Us, Address & Settings)
* `id` (PK)
* `key_name` (VARCHAR - e.g., `founder_bio`, `address`, `phone`, `fax`, `mobile`, `map_iframe`)
* `key_value` (TEXT)
* `updated_at`

### 3.6. `upcoming_products`
* `id` (PK)
* `title` (VARCHAR)
* `teaser_desc` (TEXT)
* `expected_launch` (VARCHAR)
* `image_url` (VARCHAR)

### 3.7. `gallery_media`
* `id` (PK)
* `media_url` (VARCHAR)
* `category_tag` (VARCHAR - e.g., `Lab`, `Office`, `Team`)
* `media_type` (ENUM: `image`, `video`)
* `uploaded_at`

### 3.8. `enquiries` (Lead Generation CRM)
* `id` (PK)
* `name` (VARCHAR)
* `email` (VARCHAR)
* `phone` (VARCHAR)
* `company_name` (VARCHAR)
* `message` (TEXT)
* `status` (ENUM: `new`, `contacted`, `closed` - Indexed)
* `created_at`

---

## 4. API Endpoints Architecture (RESTful)

### Public Endpoints (Frontend Consumption)
* `GET /api/v1/nav` - Fetch navigation links.
* `GET /api/v1/banners` - Fetch active hero display images/videos.
* `GET /api/v1/products` - Fetch products and services (supports search & category filters).
* `GET /api/v1/company-info` - Fetch address, contact numbers, map iframe, and about us info.
* `GET /api/v1/upcoming` - Fetch upcoming R&D products.
* `GET /api/v1/gallery` - Fetch internal environment media gallery.
* `POST /api/v1/enquiries` - Submit new customer enquiry form (Rate-limited & Captcha protected).

### Protected Endpoints (Admin Panel Management - Requires JWT)
* `POST /api/v1/admin/login` - Admin authentication (Rate-limited).
* `POST /api/v1/admin/logout` - Clear HttpOnly auth cookie.
* `CRUD /api/v1/admin/banners` - Manage hero slides.
* `CRUD /api/v1/admin/products` - Manage products and services.
* `CRUD /api/v1/admin/company-info` - Update company details, address, and founder info.
* `CRUD /api/v1/admin/gallery` - Upload/Delete internal gallery items.
* `GET /api/v1/admin/enquiries` - View, filter, and export customer leads (CSV).
* `GET /api/v1/admin/reviews-sync` - Trigger Google Places API review sync.

---

## 5. Performance, Smoothness & UI Optimization Architecture

1. **Server-Side Rendering & Static Generation:** 
   * Utilizing Next.js for pre-rendering core corporate pages (About Us, Why Choose Us, Homepage skeleton) ensuring near-instant First Contentful Paint (FCP).
2. **Edge Caching & CDN:** 
   * Cloudflare edge nodes cache static payloads globally, bringing latency down to milliseconds for regional industrial clients.
3. **Optimized Asset Delivery & Lazy Loading:** 
   * Admin-uploaded media streams through Cloud Storage with automatic compression into next-gen formats (`WebP`/`AVIF`). 
   * Gallery and hero carousels implement **Lazy Loading** and hardware-accelerated CSS transforms (`transform: translate3d`) for smooth, lag-free sliding.
4. **Perceived Performance & Micro-Interactions:** 
   * Skeleton loaders replace traditional spinners during data fetches. Form validations happen instantly on the client side using schema verification (Zod/Formik).

---

## 6. Security Architecture & Threat Mitigation

1. **Transport Layer Security & Edge Defense:** 
   * Strict HTTPS (TLS 1.3) enforcement backed by Cloudflare WAF and DDoS mitigation layers.
2. **Secure Authentication & Token Storage:** 
   * JWT tokens issued upon admin login are strictly stored in encrypted, **HttpOnly, SameSite=Strict cookies** (completely mitigating XSS token-theft risks).
3. **Advanced Rate Limiting & Bot Protection:** 
   * Redis-backed sliding-window rate limiters restrict brute-force attacks on login routes and spam submissions on enquiry endpoints. Google reCAPTCHA v3 / Turnstile guards public forms.
4. **Input Sanitization & Secure Database Queries:** 
   * Comprehensive validation middleware on all API requests paired with secure ORMs (Prisma/Sequelize) to entirely eliminate SQL Injection and XSS vectors.
5. **Strict File Upload Validation:** 
   * Uploaded media files undergo rigorous MIME-type and extension validation, assigned random UUID filenames, and direct-streamed to cloud buckets to block arbitrary script execution.
6. **Security Headers & Environment Secrecy:** 
   * Strict Content Security Policy (CSP) and HTTP Strict Transport Security (HSTS) headers deployed. All credentials and API secrets reside exclusively in encrypted environment variables (`.env`).

---

## 7. Deployment & CI/CD Pipeline
* **Version Control:** Git repository hosted on GitHub / GitLab.
* **CI/CD Automation:** GitHub Actions workflow triggered on main branch push:
  * Runs linters, type checks, and automated tests.
  * Builds frontend static/SSR assets and deploys to Vercel/CDN.
  * Deploys backend container (Docker) to cloud infrastructure (AWS ECS / DigitalOcean).
* **Database Migrations:** Managed via automated ORM migration scripts to ensure schema synchronization across environments.

``` file mein replace kar sakte hain:

```markdown
# System Architecture Document
## Swift Instruments Website & Admin Control System

---

## 1. High-Level Architecture Overview
The system follows a **Modern 3-Tier Architecture** decoupled into a responsive Client Frontend, a secure RESTful API Backend, and a Cloud-backed Relational Database & Media Storage.


```

+-----------------------------------------------------------------+
|                        CLIENT TIER                              |
|   [ Mobile Browser ]        [ Desktop Browser ]                 |
+--------------------------------+--------------------------------+
| HTTPS / SSL (TLS 1.3)
v
+-----------------------------------------------------------------+
|                     CDN & EDGE SECURITY                         |
|           Cloudflare (DDoS Protection, WAF, Edge Caching)       |
+--------------------------------+--------------------------------+
|
+-----------------------+-----------------------+
|                                               |
v                                               v
+------------------------+                     +------------------------+
|   FRONTEND (Client)    |                     |    ADMIN PANEL (SPA)   |
| Next.js / Tailwind CSS |                     |   React.js / Vite      |
+------------------------+                     +------------------------+
|                                               |
+-----------------------+-----------------------+
| REST API (HttpOnly Cookie JWT)
v
+-----------------------------------------------------------------+
|                      BACKEND API SERVER                         |
|            Node.js / Express.js (or Python / FastAPI)           |
|  - Redis Rate Limiting  - Input Sanitization  - RBAC Middleware |
+--------------------------------+--------------------------------+
|
+-----------------------+-----------------------+
|                                               |
v                                               v
+------------------------+                     +------------------------+
|    DATABASE STORAGE    |                     |     MEDIA STORAGE      |
|    PostgreSQL / MySQL  |                     |   AWS S3 / Cloudinary  |
| (Indexed & Connection  |                     | (Auto WebP / AVIF &    |
|        Pooled)         |                     |    Lazy Loading)       |
+------------------------+                     +------------------------+

```

---

## 2. Technology Stack & Performance Selection

| Layer | Technology Choice | Purpose |
| :--- | :--- | :--- |
| **Frontend (Website)** | Next.js (SSR / SSG) + Tailwind CSS | Lightning-fast page loads, superior SEO optimization, and pre-rendered static content. |
| **Admin Panel** | React.js / Vite (SPA) | Dynamic, component-driven dashboard for content management. |
| **Backend API** | Node.js with Express.js (or Python FastAPI) | Asynchronous request handling, robust routing, and security middleware. |
| **Database** | PostgreSQL or MySQL | ACID compliance, secure storage for products, enquiries, and credentials with indexed queries. |
| **Media Storage** | AWS S3 / Cloudinary | Scalable cloud storage with automated image/video compression (WebP/AVIF) and CDN delivery. |
| **Caching & Rate Limiting** | Redis | Session management, sliding-window rate limiting, and response caching for ultra-low latency. |
| **Hosting & Infra** | Vercel (Frontend) + AWS ECS / DigitalOcean (Backend) + NGINX | Scalable cloud deployment with SSL termination. |

---

## 3. Database Schema Design (Core Tables)

### 3.1. `admins` (Admin Users & RBAC)
* `id` (PK, UUID / INT)
* `username` (VARCHAR)
* `email` (VARCHAR, UNIQUE)
* `password_hash` (VARCHAR - Bcrypt)
* `role` (ENUM: `super_admin`, `content_editor`)
* `created_at`, `updated_at`

### 3.2. `navigation_links` (Header & Footer)
* `id` (PK)
* `title` (VARCHAR)
* `url` (VARCHAR)
* `position` (INT - for ordering)
* `location` (ENUM: `header`, `footer`)
* `is_active` (BOOLEAN)

### 3.3. `hero_banners` (Display Section Carousel)
* `id` (PK)
* `media_url` (VARCHAR)
* `media_type` (ENUM: `image`, `video`)
* `display_order` (INT)
* `interval_seconds` (INT)
* `is_active` (BOOLEAN)

### 3.4. `products_services`
* `id` (PK)
* `title` (VARCHAR)
* `category` (VARCHAR - Indexed for fast filtering)
* `description` (TEXT)
* `image_url` (VARCHAR)
* `is_featured` (BOOLEAN - shows on homepage)
* `created_at`

### 3.5. `company_info` (About Us, Address & Settings)
* `id` (PK)
* `key_name` (VARCHAR - e.g., `founder_bio`, `address`, `phone`, `fax`, `mobile`, `map_iframe`)
* `key_value` (TEXT)
* `updated_at`

### 3.6. `upcoming_products`
* `id` (PK)
* `title` (VARCHAR)
* `teaser_desc` (TEXT)
* `expected_launch` (VARCHAR)
* `image_url` (VARCHAR)

### 3.7. `gallery_media`
* `id` (PK)
* `media_url` (VARCHAR)
* `category_tag` (VARCHAR - e.g., `Lab`, `Office`, `Team`)
* `media_type` (ENUM: `image`, `video`)
* `uploaded_at`

### 3.8. `enquiries` (Lead Generation CRM)
* `id` (PK)
* `name` (VARCHAR)
* `email` (VARCHAR)
* `phone` (VARCHAR)
* `company_name` (VARCHAR)
* `message` (TEXT)
* `status` (ENUM: `new`, `contacted`, `closed` - Indexed)
* `created_at`

---

## 4. API Endpoints Architecture (RESTful)

### Public Endpoints (Frontend Consumption)
* `GET /api/v1/nav` - Fetch navigation links.
* `GET /api/v1/banners` - Fetch active hero display images/videos.
* `GET /api/v1/products` - Fetch products and services (supports search & category filters).
* `GET /api/v1/company-info` - Fetch address, contact numbers, map iframe, and about us info.
* `GET /api/v1/upcoming` - Fetch upcoming R&D products.
* `GET /api/v1/gallery` - Fetch internal environment media gallery.
* `POST /api/v1/enquiries` - Submit new customer enquiry form (Rate-limited & Captcha protected).

### Protected Endpoints (Admin Panel Management - Requires JWT)
* `POST /api/v1/admin/login` - Admin authentication (Rate-limited).
* `POST /api/v1/admin/logout` - Clear HttpOnly auth cookie.
* `CRUD /api/v1/admin/banners` - Manage hero slides.
* `CRUD /api/v1/admin/products` - Manage products and services.
* `CRUD /api/v1/admin/company-info` - Update company details, address, and founder info.
* `CRUD /api/v1/admin/gallery` - Upload/Delete internal gallery items.
* `GET /api/v1/admin/enquiries` - View, filter, and export customer leads (CSV).
* `GET /api/v1/admin/reviews-sync` - Trigger Google Places API review sync.

---

## 5. Performance, Smoothness & UI Optimization Architecture

1. **Server-Side Rendering & Static Generation:** 
   * Utilizing Next.js for pre-rendering core corporate pages (About Us, Why Choose Us, Homepage skeleton) ensuring near-instant First Contentful Paint (FCP).
2. **Edge Caching & CDN:** 
   * Cloudflare edge nodes cache static payloads globally, bringing latency down to milliseconds for regional industrial clients.
3. **Optimized Asset Delivery & Lazy Loading:** 
   * Admin-uploaded media streams through Cloud Storage with automatic compression into next-gen formats (`WebP`/`AVIF`). 
   * Gallery and hero carousels implement **Lazy Loading** and hardware-accelerated CSS transforms (`transform: translate3d`) for smooth, lag-free sliding.
4. **Perceived Performance & Micro-Interactions:** 
   * Skeleton loaders replace traditional spinners during data fetches. Form validations happen instantly on the client side using schema verification (Zod/Formik).

---

## 6. Security Architecture & Threat Mitigation

1. **Transport Layer Security & Edge Defense:** 
   * Strict HTTPS (TLS 1.3) enforcement backed by Cloudflare WAF and DDoS mitigation layers.
2. **Secure Authentication & Token Storage:** 
   * JWT tokens issued upon admin login are strictly stored in encrypted, **HttpOnly, SameSite=Strict cookies** (completely mitigating XSS token-theft risks).
3. **Advanced Rate Limiting & Bot Protection:** 
   * Redis-backed sliding-window rate limiters restrict brute-force attacks on login routes and spam submissions on enquiry endpoints. Google reCAPTCHA v3 / Turnstile guards public forms.
4. **Input Sanitization & Secure Database Queries:** 
   * Comprehensive validation middleware on all API requests paired with secure ORMs (Prisma/Sequelize) to entirely eliminate SQL Injection and XSS vectors.
5. **Strict File Upload Validation:** 
   * Uploaded media files undergo rigorous MIME-type and extension validation, assigned random UUID filenames, and direct-streamed to cloud buckets to block arbitrary script execution.
6. **Security Headers & Environment Secrecy:** 
   * Strict Content Security Policy (CSP) and HTTP Strict Transport Security (HSTS) headers deployed. All credentials and API secrets reside exclusively in encrypted environment variables (`.env`).

---

## 7. Deployment & CI/CD Pipeline
* **Version Control:** Git repository hosted on GitHub / GitLab.
* **CI/CD Automation:** GitHub Actions workflow triggered on main branch push:
  * Runs linters, type checks, and automated tests.
  * Builds frontend static/SSR assets and deploys to Vercel/CDN.
  * Deploys backend container (Docker) to cloud infrastructure (AWS ECS / DigitalOcean).
* **Database Migrations:** Managed via automated ORM migration scripts to ensure schema synchronization across environments.

```