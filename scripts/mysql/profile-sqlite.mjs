/**
 * Read-only profile of the SQLite database.
 *
 * Purpose: size the MySQL columns and detect data that would break the import
 * (invalid JSON, case-duplicate slugs, over-long strings). Never writes.
 *
 * Usage: node scripts/mysql/profile-sqlite.mjs [path-to-db]
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.argv[2] || path.join(here, '..', '..', 'apps', 'backend', 'prisma', 'dev.db');
const db = new DatabaseSync(dbPath, { readOnly: true });

const q = (sql) => db.prepare(sql).all();
const one = (sql) => db.prepare(sql).get();

const tables = q("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name");

console.log(`DB: ${dbPath}`);
console.log('\n== row counts ==');
for (const { name } of tables) {
  const { c } = one(`SELECT COUNT(*) AS c FROM "${name}"`);
  console.log(`${name.padEnd(18)} ${c}`);
}

console.log('\n== products ==');
console.log('total:', one('SELECT COUNT(*) AS c FROM Product').c);
console.log('slugs that are not already lowercase/dash-only:');
for (const r of q("SELECT id, slug FROM Product WHERE slug <> lower(slug) OR slug LIKE '% %' ORDER BY slug")) {
  console.log(`  ${JSON.stringify(r.slug)}  (${r.id})`);
}
console.log('case-insensitive duplicate slugs:');
for (const r of q('SELECT lower(slug) AS s, COUNT(*) AS c FROM Product GROUP BY lower(slug) HAVING c > 1')) {
  console.log(`  ${r.s} x${r.c}`);
}
console.log('categories (JSON-escaped):');
for (const r of q('SELECT DISTINCT category FROM Product ORDER BY category')) {
  console.log(`  ${JSON.stringify(r.category)}`);
}

console.log('\n== product specs ==');
const specRows = q('SELECT id, slug, specs FROM Product WHERE specs IS NOT NULL');
let invalid = 0;
let notArray = 0;
let badItems = 0;
for (const r of specRows) {
  let parsed;
  try {
    parsed = JSON.parse(r.specs);
  } catch {
    invalid += 1;
    console.log(`  INVALID JSON  ${r.slug}`);
    continue;
  }
  if (!Array.isArray(parsed)) {
    notArray += 1;
    console.log(`  NOT AN ARRAY   ${r.slug}`);
    continue;
  }
  const bad = parsed.filter((it) => !it || typeof it !== 'object' || typeof it.label !== 'string' || typeof it.value !== 'string');
  if (bad.length) {
    badItems += 1;
    console.log(`  BAD ITEMS(${bad.length}) ${r.slug}`);
  }
}
console.log(`specs rows: ${specRows.length}, invalid JSON: ${invalid}, not array: ${notArray}, bad items: ${badItems}`);

console.log('\n== reviews ==');
console.log('googleReviewId set:', one('SELECT COUNT(*) AS c FROM Review WHERE googleReviewId IS NOT NULL').c);
console.log('sources:', q('SELECT source, COUNT(*) AS c FROM Review GROUP BY source').map((r) => `${r.source}=${r.c}`).join(', '));

console.log('\n== audit actions/entities ==');
console.log('actions: ', q('SELECT DISTINCT action FROM AuditLog ORDER BY action').map((r) => r.action).join(', '));
console.log('entities:', q('SELECT DISTINCT entity FROM AuditLog ORDER BY entity').map((r) => r.entity).join(', '));

console.log('\n== longest strings (MySQL column sizing) ==');
const maxes = [
  ['Product.title', 'Product', 'title'],
  ['Product.slug', 'Product', 'slug'],
  ['Product.category', 'Product', 'category'],
  ['Product.shortDesc', 'Product', 'shortDesc'],
  ['Product.description', 'Product', 'description'],
  ['Product.specs', 'Product', 'specs'],
  ['Product.imageUrl', 'Product', 'imageUrl'],
  ['CompanyInfo.keyName', 'CompanyInfo', 'keyName'],
  ['CompanyInfo.keyValue', 'CompanyInfo', 'keyValue'],
  ['Setting.keyName', 'Setting', 'keyName'],
  ['Setting.keyValue', 'Setting', 'keyValue'],
  ['Enquiry.name', 'Enquiry', 'name'],
  ['Enquiry.email', 'Enquiry', 'email'],
  ['Enquiry.phone', 'Enquiry', 'phone'],
  ['Enquiry.companyName', 'Enquiry', 'companyName'],
  ['Enquiry.subject', 'Enquiry', 'subject'],
  ['Enquiry.message', 'Enquiry', 'message'],
  ['Enquiry.notes', 'Enquiry', 'notes'],
  ['Enquiry.ipAddress', 'Enquiry', 'ipAddress'],
  ['Media.url', 'Media', 'url'],
  ['Media.filename', 'Media', 'filename'],
  ['Media.originalName', 'Media', 'originalName'],
  ['Media.mimeType', 'Media', 'mimeType'],
  ['Media.folder', 'Media', 'folder'],
  ['Media.tags', 'Media', 'tags'],
  ['AuditLog.adminEmail', 'AuditLog', 'adminEmail'],
  ['AuditLog.action', 'AuditLog', 'action'],
  ['AuditLog.entity', 'AuditLog', 'entity'],
  ['AuditLog.details', 'AuditLog', 'details'],
  ['AuditLog.ipAddress', 'AuditLog', 'ipAddress'],
  ['AuditLog.userAgent', 'AuditLog', 'userAgent'],
  ['Review.authorName', 'Review', 'authorName'],
  ['Review.text', 'Review', 'text'],
  ['Review.profilePhotoUrl', 'Review', 'profilePhotoUrl'],
  ['GalleryMedia.mediaUrl', 'GalleryMedia', 'mediaUrl'],
  ['GalleryMedia.categoryTag', 'GalleryMedia', 'categoryTag'],
  ['GalleryMedia.caption', 'GalleryMedia', 'caption'],
  ['NavigationLink.title', 'NavigationLink', 'title'],
  ['NavigationLink.url', 'NavigationLink', 'url'],
  ['HeroBanner.title', 'HeroBanner', 'title'],
  ['HeroBanner.subtitle', 'HeroBanner', 'subtitle'],
  ['HeroBanner.ctaLabel', 'HeroBanner', 'ctaLabel'],
  ['HeroBanner.ctaUrl', 'HeroBanner', 'ctaUrl'],
  ['HeroBanner.mediaUrl', 'HeroBanner', 'mediaUrl'],
  ['UpcomingProduct.title', 'UpcomingProduct', 'title'],
  ['UpcomingProduct.teaserDesc', 'UpcomingProduct', 'teaserDesc'],
  ['UpcomingProduct.expectedLaunch', 'UpcomingProduct', 'expectedLaunch'],
  ['UpcomingProduct.imageUrl', 'UpcomingProduct', 'imageUrl'],
  ['WhyChooseUs.title', 'WhyChooseUs', 'title'],
  ['WhyChooseUs.description', 'WhyChooseUs', 'description'],
  ['WhyChooseUs.icon', 'WhyChooseUs', 'icon'],
];
for (const [label, table, col] of maxes) {
  const r = one(`SELECT MAX(LENGTH("${col}")) AS m FROM "${table}"`);
  console.log(`${label.padEnd(30)} ${r?.m ?? 0}`);
}

db.close();
