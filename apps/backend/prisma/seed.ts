import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const img = (seed: string, w = 1600, h = 900) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
// Stable CC0 sample video (GitHub Pages-hosted; the previous Google
// gtv-videos-bucket URL now returns 403 AccessDenied).
const SAMPLE_VIDEO = 'https://mdn.github.io/shared-assets/videos/flower.mp4';

async function main() {
  console.log('🌱 Seeding Swift Instruments database...');

  // ── Clean (dependency-safe order) ──────────────────────────
  await prisma.emailOtp.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.enquiry.deleteMany();
  await prisma.review.deleteMany();
  await prisma.galleryMedia.deleteMany();
  await prisma.upcomingProduct.deleteMany();
  await prisma.product.deleteMany();
  await prisma.whyChooseUs.deleteMany();
  await prisma.heroBanner.deleteMany();
  await prisma.navigationLink.deleteMany();
  await prisma.companyInfo.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.media.deleteMany();
  await prisma.admin.deleteMany();

  // ── Admin users ────────────────────────────────────────────
  await prisma.admin.create({
    data: {
      username: 'Super Admin',
      email: 'admin@swiftinstruments.in',
      passwordHash: await bcrypt.hash('Admin@12345', 12),
      role: 'super_admin',
    },
  });
  await prisma.admin.create({
    data: {
      username: 'Content Editor',
      email: 'editor@swiftinstruments.in',
      passwordHash: await bcrypt.hash('Editor@12345', 12),
      role: 'content_editor',
    },
  });

  // ── Navigation ─────────────────────────────────────────────
  const nav = [
    { title: 'Home', url: '/' },
    { title: 'Products & Services', url: '/products' },
    { title: 'About Us', url: '/about' },
    { title: 'Upcoming Products', url: '/upcoming' },
    { title: 'Gallery', url: '/gallery' },
    { title: 'Contact Us', url: '/contact' },
  ];
  await prisma.navigationLink.createMany({
    data: nav.map((n, i) => ({ ...n, position: i, location: 'header', isActive: true })),
  });
  const footer = [
    { title: 'Privacy Policy', url: '/privacy' },
    { title: 'Terms of Service', url: '/terms' },
    { title: 'Sitemap', url: '/sitemap' },
  ];
  await prisma.navigationLink.createMany({
    data: footer.map((n, i) => ({ ...n, position: i, location: 'footer', isActive: true })),
  });

  // ── Hero banners ───────────────────────────────────────────
  await prisma.heroBanner.createMany({
    data: [
      {
        title: 'Precision Weighing Instruments',
        subtitle: 'Trusted measurement solutions engineered for laboratories and industry since 1994.',
        ctaLabel: 'Explore Products',
        ctaUrl: '/products',
        mediaUrl: img('swift-hero-1'),
        mediaType: 'image',
        displayOrder: 0,
        intervalSeconds: 5000,
        isActive: true,
      },
      {
        title: 'Engineering Accuracy You Can Trust',
        subtitle: 'ISO-certified calibration, robust build quality and nationwide service support.',
        ctaLabel: 'About Swift Instruments',
        ctaUrl: '/about',
        mediaUrl: img('swift-hero-2'),
        mediaType: 'image',
        displayOrder: 1,
        intervalSeconds: 5000,
        isActive: true,
      },
      {
        title: 'Inside Our Manufacturing Facility',
        subtitle: 'Watch how precision components come together on our production line.',
        ctaLabel: 'View Gallery',
        ctaUrl: '/gallery',
        mediaUrl: SAMPLE_VIDEO,
        mediaType: 'video',
        displayOrder: 2,
        intervalSeconds: 8000,
        isActive: true,
      },
    ],
  });

  // ── Why Choose Us ──────────────────────────────────────────
  await prisma.whyChooseUs.createMany({
    data: [
      { title: 'ISO 9001 Certified', description: 'Every instrument is built and verified under a certified quality management system.', icon: 'ShieldCheck', displayOrder: 0 },
      { title: 'In-house Calibration', description: 'NABL-traceable calibration laboratory ensures accuracy you can prove.', icon: 'Gauge', displayOrder: 1 },
      { title: '25+ Years Experience', description: 'Serving pharma, food, education and heavy industry since 1994.', icon: 'Award', displayOrder: 2 },
      { title: 'Nationwide Service', description: 'On-site installation, training and AMC support across India.', icon: 'Truck', displayOrder: 3 },
      { title: 'Custom Engineering', description: 'Bespoke weighing and measurement systems tailored to your process.', icon: 'Wrench', displayOrder: 4 },
      { title: 'Rapid Support', description: 'Dedicated helpline and WhatsApp support with 24-hour response.', icon: 'Headset', displayOrder: 5 },
    ],
  });

  // ── Products & Services ────────────────────────────────────
  const products = [
    { title: 'Analytical Balance AB-220', category: 'Laboratory Instruments', shortDesc: '0.1 mg readability, internal calibration analytical balance.', isFeatured: true, image: 'analytical-balance' },
    { title: 'Precision Top-Loading Balance TB-5000', category: 'Laboratory Instruments', shortDesc: '5000 g capacity with 0.01 g readability for busy labs.', isFeatured: true, image: 'topload-balance' },
    { title: 'Industrial Platform Scale IPS-600', category: 'Industrial Weighing', shortDesc: 'Heavy-duty 600 kg platform with stainless steel deck.', isFeatured: true, image: 'platform-scale' },
    { title: 'Digital Bench Scale DBS-30', category: 'Commercial Weighing', shortDesc: 'Compact retail bench scale with bright LED display.', isFeatured: false, image: 'bench-scale' },
    { title: 'Moisture Analyzer MA-50', category: 'Laboratory Instruments', shortDesc: 'Halogen moisture analysis for food and pharma QC.', isFeatured: true, image: 'moisture-analyzer' },
    { title: 'Load Cell Indicator LCI-8', category: 'Components & Accessories', shortDesc: 'IP67 industrial indicator with RS-232 and relay outputs.', isFeatured: false, image: 'loadcell-indicator' },
    { title: 'NABL Calibration Service', category: 'Calibration Services', shortDesc: 'Traceable calibration with certificate for all weighing devices.', isFeatured: true, image: 'calibration-service' },
    { title: 'Jewellery Carat Balance JB-200', category: 'Commercial Weighing', shortDesc: 'High-resolution 0.001 g scale designed for jewellers.', isFeatured: false, image: 'carat-balance' },
    { title: 'Animal Weighing Scale AWS-150', category: 'Industrial Weighing', shortDesc: 'Low-profile veterinary scale with hold function.', isFeatured: false, image: 'animal-scale' },
    { title: 'Teaching Balance ED-300', category: 'Education', shortDesc: 'Rugged classroom balance for schools and colleges.', isFeatured: false, image: 'teaching-balance' },
    { title: 'Bulk Weighing AMC Package', category: 'Calibration Services', shortDesc: 'Annual maintenance contract with quarterly on-site visits.', isFeatured: false, image: 'amc-package' },
    { title: 'pH & Conductivity Meter PCM-7', category: 'Laboratory Instruments', shortDesc: 'Multi-parameter benchtop meter for water analysis.', isFeatured: false, image: 'ph-meter' },
  ];
  await prisma.product.createMany({
    data: products.map((p, i) => ({
      title: p.title,
      slug: p.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-'),
      category: p.category,
      shortDesc: p.shortDesc,
      description: `<p><strong>${p.title}</strong> is engineered for dependable, repeatable measurement in demanding environments. ${p.shortDesc}</p><p>Every unit ships factory-tested with a calibration certificate and is backed by our nationwide service network.</p>`,
      imageUrl: img(p.image, 800, 600),
      specs: JSON.stringify([
        { label: 'Readability', value: '0.001 g' },
        { label: 'Capacity', value: '220 g' },
        { label: 'Warranty', value: '2 Years' },
        { label: 'Display', value: 'Backlit LCD' },
      ]),
      isFeatured: p.isFeatured,
      isActive: true,
      createdAt: new Date(Date.now() - i * 86400000),
    })),
  });

  // ── Company info ───────────────────────────────────────────
  await prisma.companyInfo.createMany({
    data: [
      { keyName: 'company_name', keyValue: 'Swift Instruments' },
      { keyName: 'tagline', keyValue: 'Precision Weighing & Measurement Solutions Since 1994' },
      { keyName: 'logo_url', keyValue: '' },
      { keyName: 'certifications', keyValue: JSON.stringify(['ISO 9001', 'NABL', 'CE', 'Make in India']) },
      { keyName: 'address', keyValue: 'M/S. Swift Instruments, A-1524, 2nd floor, Greenfield, Faridabad (Haryana) 121010 (NCR-Delhi)' },
      { keyName: 'phone', keyValue: '+91 129-2511671' },
      { keyName: 'fax', keyValue: '+91-129-2510936' },
      { keyName: 'mobile', keyValue: '+91 9810325260' },
      { keyName: 'email', keyValue: 'sales@swiftinstruments.in' },
      { keyName: 'whatsapp', keyValue: '919810325260' },
      { keyName: 'founder_name', keyValue: 'Mr. S. K. Sharma' },
      { keyName: 'founder_title', keyValue: 'Founder & Managing Director' },
      { keyName: 'founder_photo', keyValue: img('founder-portrait', 600, 700) },
      {
        keyName: 'founder_bio',
        keyValue:
          '<p>Mr. S. K. Sharma founded Swift Instruments in 1994 with a singular mission: to bring laboratory-grade accuracy within reach of Indian industry without compromising on build quality.</p><p>With an engineering background and over three decades of metrology experience, he has led the company from a small workshop in Faridabad to a nationally recognised manufacturer of weighing and measurement instruments.</p>',
      },
      {
        keyName: 'history',
        keyValue:
          '<p>Since 1994, Swift Instruments has supplied precision weighing equipment to pharmaceutical, food-processing, educational and heavy-engineering customers across India.</p><p>Our ISO 9001-certified manufacturing unit and NABL-traceable calibration laboratory in Faridabad form the backbone of our quality promise. Today we support thousands of installations nationwide through a dedicated service network.</p>',
      },
      {
        keyName: 'map_embed',
        keyValue:
          'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3507.0392095368383!2d77.29831107577516!3d28.464721175756417!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390ce748b9baf007%3A0xb5aa7b031a74731b!2sSwift%20Instruments!5e0!3m2!1sen!2sin!4v1730000000000!5m2!1sen!2sin',
      },
      { keyName: 'map_url', keyValue: 'https://maps.app.goo.gl/QUJr22r9AgJa585Y9' },
      { keyName: 'established_year', keyValue: '1994' },
      { keyName: 'employees', keyValue: '120+' },
      { keyName: 'installations', keyValue: '15,000+' },
    ],
  });

  // ── Upcoming products ──────────────────────────────────────
  await prisma.upcomingProduct.createMany({
    data: [
      { title: 'SwiftScan X1 — Smart Weighing Terminal', teaserDesc: 'IoT-enabled terminal streaming weight data to your ERP via MQTT. Currently in field trials.', expectedLaunch: 'Q2 2026', imageUrl: img('swiftscan', 800, 600), displayOrder: 0 },
      { title: 'MicroBalance MX — 0.01 mg Research Balance', teaserDesc: 'Next-generation magnetic force compensation cell for high-end research laboratories.', expectedLaunch: 'Q4 2026', imageUrl: img('microbalance', 800, 600), displayOrder: 1 },
      { title: 'AutoCheck Pro — Automated Calibration Rig', teaserDesc: 'Robotic calibration station capable of certifying 120 balances per shift without operator error.', expectedLaunch: '2027', imageUrl: img('autocheck', 800, 600), displayOrder: 2 },
    ],
  });

  // ── Gallery ────────────────────────────────────────────────
  await prisma.galleryMedia.createMany({
    data: [
      { mediaUrl: img('lab-1', 1200, 800), mediaType: 'image', categoryTag: 'Lab', caption: 'Calibration laboratory' },
      { mediaUrl: img('lab-2', 1200, 800), mediaType: 'image', categoryTag: 'Lab', caption: 'Precision testing bench' },
      { mediaUrl: img('office-1', 1200, 800), mediaType: 'image', categoryTag: 'Office', caption: 'Head office, Faridabad' },
      { mediaUrl: img('office-2', 1200, 800), mediaType: 'image', categoryTag: 'Office', caption: 'Sales & support team' },
      { mediaUrl: SAMPLE_VIDEO, mediaType: 'video', categoryTag: 'Lab', caption: 'Inside the manufacturing line' },
      { mediaUrl: img('team-1', 1200, 800), mediaType: 'image', categoryTag: 'Team', caption: 'Annual quality review' },
      { mediaUrl: img('factory-1', 1200, 800), mediaType: 'image', categoryTag: 'Office', caption: 'Assembly floor' },
      { mediaUrl: img('events-1', 1200, 800), mediaType: 'image', categoryTag: 'Events', caption: 'Pharma Expo stall' },
    ],
  });

  // ── Reviews ────────────────────────────────────────────────
  await prisma.review.createMany({
    data: [
      { authorName: 'Dr. Ananya Rao', rating: 5, text: 'Their analytical balances have been running reliably in our QC lab for five years. Calibration support is prompt and professional.', source: 'manual', isFeatured: true },
      { authorName: 'Vikram Mehta', rating: 5, text: 'Excellent build quality and the after-sales team is genuinely responsive. Highly recommended for industrial weighing.', source: 'manual', isFeatured: true },
      { authorName: 'Priya Nair', rating: 4, text: 'Good product range and fair pricing. Installation was quick and the training was thorough.', source: 'manual', isFeatured: false },
      { authorName: 'Rakesh Gupta', rating: 5, text: 'Weighing accuracy is spot on and the NABL certificate has simplified our audits enormously.', source: 'manual', isFeatured: true },
    ],
  });

  // ── Settings ───────────────────────────────────────────────
  await prisma.setting.createMany({
    data: [
      { keyName: 'enquiry_recipients', keyValue: 'sales@swiftinstruments.in,admin@swiftinstruments.in' },
      { keyName: 'footer_text', keyValue: 'Swift Instruments is an ISO 9001 certified manufacturer of precision weighing and measurement instruments, serving Indian industry since 1994.' },
      { keyName: 'copyright', keyValue: '© 2026 Swift Instruments. All rights reserved.' },
      { keyName: 'legal_disclaimer', keyValue: 'Specifications are subject to change without notice. All trademarks acknowledged.' },
      {
        keyName: 'social_links',
        keyValue: JSON.stringify([
          { label: 'LinkedIn', url: 'https://linkedin.com', icon: 'Linkedin' },
          { label: 'Facebook', url: 'https://facebook.com', icon: 'Facebook' },
          { label: 'Instagram', url: 'https://instagram.com', icon: 'Instagram' },
          { label: 'YouTube', url: 'https://youtube.com', icon: 'Youtube' },
        ]),
      },
    ],
  });

  // ── Sample enquiries ───────────────────────────────────────
  await prisma.enquiry.createMany({
    data: [
      { name: 'Sunil Verma', email: 'sunil@pharmalabs.in', phone: '+91 9876543210', companyName: 'PharmaLabs Pvt Ltd', subject: 'Analytical balance quote', message: 'Please share a quotation for 4 units of AB-220 with installation.', status: 'new' },
      { name: 'Neha Kapoor', email: 'neha@foodtech.co.in', phone: '+91 9988776655', companyName: 'FoodTech Industries', subject: 'AMC enquiry', message: 'We need an annual maintenance contract for 12 platform scales.', status: 'contacted', notes: 'Called on 10th, proposal sent.' },
      { name: 'Arjun Singh', email: 'arjun@metalsworks.com', phone: '+91 9012345678', companyName: 'Metals Works', subject: 'Bulk pricing', message: 'Looking for bulk pricing on industrial platform scales for a new plant.', status: 'closed', notes: 'Order placed. Closed.' },
    ],
  });

  console.log('✅ Seed complete.');
  // Never print working credentials in production logs.
  if (process.env.NODE_ENV !== 'production') {
    console.log('   super_admin → admin@swiftinstruments.in / Admin@12345');
    console.log('   content_editor → editor@swiftinstruments.in / Editor@12345');
  } else {
    console.log('   (credentials not shown in production — see your provisioning records)');
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
