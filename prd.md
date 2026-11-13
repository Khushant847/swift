# Product Requirements Document (PRD)
لل# Swift Instruments Website Architecture, Admin Control System & Technical Enhancements

---

## 1. Document Overview
* **Project Name:** Swift Instruments Official Website
* **Objective:** To build a high-performance, responsive, secure, and dynamic corporate website for Swift Instruments showcasing their products, services, company background, and interactive elements, backed by a 100% dynamic and secure Admin Panel.

---

## 2. Global Admin Panel Requirements & Security Hardening
* **Authentication & Access:** 
  * Secure login with multi-level Role-Based Access Control (RBAC) e.g., Super Admin vs. Content Editor.
  * Password hashing (bcrypt) and session management with secure tokens.
* **Dashboard Overview:** Real-time stats of total enquiries, active products, recent reviews, and storage usage.
* **Security Measures:**
  * Protection against CSRF, XSS, and SQL Injection across all forms and API endpoints.
  * Strict MIME-type validation on file uploads to prevent malicious script executions.
  * Google Maps API Key domain/IP restrictions on Google Cloud Console.
  * Mandatory SSL Certificate (HTTPS) enforcement.

---

## 3. Detailed Website Architecture & Section-wise Features

### Part 1: Header
* **Frontend Requirements:**
  * Displays Company Logo and Company Name ("Swift Instruments").
  * Displays Certification/Accreditation logos.
  * Responsive Navigation Bar (Home, Products & Services, About Us, Upcoming Products, Gallery, Contact Us).
* **Admin Panel Requirements:**
  * Upload/change company logo and certification logos.
  * Add, rename, reorder, or delete navigation links and URLs.

### Part 2: Display / Hero Banner
* **Frontend Requirements:**
  * Dynamic slideshow supporting both high-res images and videos with auto-transitions.
* **Admin Panel Requirements:**
  * Media uploader (supporting MP4/WebM/Images) with auto-compression / CDN integration.
  * Customize slide transition intervals (e.g., 3s, 5s) and reorder/toggle slides.

### Part 3: Why Choose Us
* **Frontend Requirements:**
  * Clean grid/card layout highlighting USPs over competitors.
* **Admin Panel Requirements:**
  * CRUD interface to add, edit, or remove USP points, icons, and descriptions.

### Part 4: Products and Services
* **Frontend Requirements:**
  * Curated list of featured items on the homepage with search bar, category filters, and a "View All" redirection catalog page.
* **Admin Panel Requirements:**
  * Product/Service manager to add items, titles, descriptions, categories, and feature toggles.

### Part 5: Info About the Company (About Us)
* **Frontend Requirements:**
  * Detailed company background and founder’s bio with a professional portrait.
* **Admin Panel Requirements:**
  * WYSIWYG text editor for history/bio and image uploader for founder photograph.

### Part 6: Address & Interactive Map
* **Frontend Requirements:**
  * Official details:
    * **Address:** M/S. Swift Instruments, A-1524, 2nd floor, Greenfield Faridabad (Haryana)-121010 (NCR- Delhi)
    * **Contacts:** +91 129-2511671, Fax: +91 -129- 2510936
    * **Mobile Number:** +91 9810325260
  * Embedded Google Maps view.
* **Admin Panel Requirements:**
  * Editable text fields for contact details and Google Maps iframe/coordinates input.

### Part 7: Upcoming Products
* **Frontend Requirements:**
  * R&D teaser layout showing products currently under development.
* **Admin Panel Requirements:**
  * Interface to manage upcoming product teasers, launch timelines, and concept visuals.

### Part 8: Gallery (Internal Environment)
* **Frontend Requirements:**
  * Multimedia grid highlighting company workspace, labs, and internal infrastructure with lazy loading.
* **Admin Panel Requirements:**
  * Bulk media uploader with categorization tags (e.g., Lab, Office, Team) and delete options.

### Part 9: Reviews & Ratings
* **Frontend Requirements:**
  * Customer feedback display synced with live data.
* **Admin Panel Requirements:**
  * Google Places API sync settings with manual filtering to feature positive reviews or hide spam.

### Part 10: Enquiry Form & CTA
* **Frontend Requirements:**
  * Lead capture form (Name, Email, Phone, Company, Message) with validation and thank-you popups.
  * Floating **"Call Now"** and **"WhatsApp Inquiry"** quick buttons for mobile users.
* **Admin Panel Requirements:**
  * Enquiries CRM tab with search, filters, CSV/Excel export, and automated email notifications (via SendGrid/Nodemailer) to admins and auto-responders to users.

### Part 11: Footer
* **Frontend Requirements:**
  * Quick links, copyright, social icons, and disclaimers.
* **Admin Panel Requirements:**
  * Dynamic manager for footer text, social links, and copyright info.

---

## 4. Technical & Architectural Stack Recommendations
* **Frontend:** Responsive layout optimized for mobile and desktop with lazy loading for media assets.
* **Backend:** RESTful API architecture (Node.js/Express or Python/Django) with Redis caching for ultra-fast performance.
* **Database & Storage:** Relational Database (PostgreSQL / MySQL) for structured data and Cloud Storage (AWS S3 / Cloudinary) for heavy media files.