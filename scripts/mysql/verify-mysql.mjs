/**
 * Step 3 of the MySQL rehearsal: prove the MySQL copy matches the SQLite source.
 *
 * Compares against import-report.json (written by import-mysql.mjs, i.e. the
 * exact rows that were inserted) and checks MySQL-specific integrity:
 *   - per-table row counts and SHA-256 checksums
 *   - numeric sums (Media.size, Review.rating)
 *   - JSON_VALID() on Product.specs and AuditLog.details
 *   - foreign keys (AuditLog.adminId -> Admin.id)
 *   - unique keys that MySQL treats differently from SQLite
 *
 * Usage:
 *   node --env-file=apps/backend/.env.mysql.local scripts/mysql/verify-mysql.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLES, canonicalJson, normalizeRow } from './schema-meta.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const reportPath = path.resolve(
  repoRoot,
  'migration-audit',
  'mysql-export',
  'import-report.json',
);

const url = process.env.DATABASE_URL;
if (!url || !url.startsWith('mysql://')) {
  console.error('DATABASE_URL must be a mysql:// URL. Run with --env-file=apps/backend/.env.mysql.local');
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const source = JSON.parse(
  readFileSync(path.resolve(repoRoot, 'migration-audit', 'mysql-export', 'data.json'), 'utf8'),
);
const clientPath = path.join(repoRoot, 'node_modules', '.prisma', 'client-mysql', 'index.js');
const { PrismaClient } = await import(new URL(`file:///${clientPath.replace(/\\/g, '/')}`).href);
const prisma = new PrismaClient();

const failures = [];
const warnings = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`  FAIL  ${msg}`);
};
const warn = (msg) => {
  warnings.push(msg);
  console.log(`  WARN  ${msg}`);
};
const pass = (msg) => console.log(`  ok    ${msg}`);

try {
  console.log(`target : ${report.target.database} @ ${report.target.host}`);
  console.log(`report : ${path.relative(repoRoot, reportPath).replace(/\\/g, '/')}`);
  const applied = Object.entries(report.transforms ?? {})
    .filter(([, on]) => on)
    .map(([name]) => name);
  if (applied.length) console.log(`transform: ${applied.join(', ')} (expected state = source + transform)`);
  console.log('');

  // ── 1. Counts + checksums ──────────────────────────────────
  console.log('counts + checksums');
  for (const table of TABLES) {
    const key = table.charAt(0).toLowerCase() + table.slice(1);
    const rows = (await prisma[key].findMany({ orderBy: { id: 'asc' } })).map((row) =>
      normalizeRow(table, row),
    );
    const checksum = createHash('sha256').update(canonicalJson(rows)).digest('hex');
    const want = report.tables[table];
    if (!want) {
      fail(`${table}: no expected entry in report`);
      continue;
    }
    const countOk = rows.length === want.count;
    const hashOk = checksum === want.checksum;
    const label = `${table.padEnd(16)} rows ${String(rows.length).padStart(4)}/${String(want.count).padStart(4)}  sha ${checksum.slice(0, 12)}/${want.checksum.slice(0, 12)}`;
    if (countOk && hashOk) pass(label);
    else fail(label);
  }

  // ── 2. Numeric sums ────────────────────────────────────────
  console.log('');
  console.log('numeric sums');
  const mediaSum = await prisma.media.aggregate({ _sum: { size: true } });
  const expectedMediaSum = source.Media.reduce((acc, m) => acc + (m.size ?? 0), 0);
  if ((mediaSum._sum.size ?? 0) === expectedMediaSum) pass(`Media.size sum = ${expectedMediaSum}`);
  else fail(`Media.size sum ${mediaSum._sum.size} != ${expectedMediaSum}`);

  const reviewSum = await prisma.review.aggregate({ _sum: { rating: true } });
  const expectedReviewSum = source.Review.reduce((acc, r) => acc + (r.rating ?? 0), 0);
  if ((reviewSum._sum.rating ?? 0) === expectedReviewSum) pass(`Review.rating sum = ${expectedReviewSum}`);
  else fail(`Review.rating sum ${reviewSum._sum.rating} != ${expectedReviewSum}`);

  // ── 3. MySQL JSON validity ─────────────────────────────────
  console.log('');
  console.log('json validity (MySQL JSON_VALID)');
  const [{ bad: badSpecs }] = await prisma.$queryRaw`
    SELECT COUNT(*) AS bad FROM Product WHERE specs IS NOT NULL AND JSON_VALID(specs) = 0`;
  if (Number(badSpecs) === 0) pass(`Product.specs: all ${await prisma.product.count()} rows valid JSON`);
  else fail(`Product.specs: ${badSpecs} row(s) are not valid JSON`);

  const [{ bad: badDetails }] = await prisma.$queryRaw`
    SELECT COUNT(*) AS bad FROM AuditLog WHERE details IS NOT NULL AND JSON_VALID(details) = 0`;
  if (Number(badDetails) === 0) pass('AuditLog.details: all rows valid JSON (or NULL)');
  else fail(`AuditLog.details: ${badDetails} row(s) are not valid JSON`);

  // ── 4. Foreign keys ────────────────────────────────────────
  console.log('');
  console.log('foreign keys');
  const [{ orphans }] = await prisma.$queryRaw`
    SELECT COUNT(*) AS orphans FROM AuditLog a
    LEFT JOIN Admin b ON a.adminId = b.id
    WHERE a.adminId IS NOT NULL AND b.id IS NULL`;
  if (Number(orphans) === 0) pass('AuditLog.adminId -> Admin.id: no orphans');
  else fail(`AuditLog: ${orphans} orphan adminId value(s)`);

  const [{ bad: nullAdmin }] = await prisma.$queryRaw`
    SELECT COUNT(*) AS bad FROM AuditLog WHERE adminId IS NOT NULL AND adminId = ''`;
  if (Number(nullAdmin) === 0) pass('AuditLog.adminId: no empty-string ids');
  else fail(`AuditLog: ${nullAdmin} empty-string adminId value(s)`);

  // ── 5. Uniqueness under MySQL collation ────────────────────
  console.log('');
  console.log('unique keys (MySQL collation)');
  const [{ dupes }] = await prisma.$queryRaw`
    SELECT COUNT(*) AS dupes FROM (
      SELECT slug FROM Product GROUP BY slug HAVING COUNT(*) > 1
    ) t`;
  if (Number(dupes) === 0) pass('Product.slug: unique');
  else fail(`Product.slug: ${dupes} duplicate group(s)`);

  const [{ dupes: reviewDupes }] = await prisma.$queryRaw`
    SELECT COUNT(*) AS dupes FROM (
      SELECT googleReviewId FROM Review WHERE googleReviewId IS NOT NULL
      GROUP BY googleReviewId HAVING COUNT(*) > 1
    ) t`;
  if (Number(reviewDupes) === 0) pass('Review.googleReviewId: unique');
  else fail(`Review.googleReviewId: ${reviewDupes} duplicate group(s)`);

  // ── 6. Spot checks ────────────────────────────────────────
  console.log('');
  console.log('spot checks');
  const categories = (
    await prisma.$queryRaw`SELECT DISTINCT category FROM Product ORDER BY category`
  ).map((r) => r.category);
  const untrimmed = categories.filter((c) => c !== c.trim() || /\s{2,}/.test(c));
  if (untrimmed.length === 0) pass(`Product.category: ${categories.length} clean values (${categories.join(' | ')})`);
  else warn(`Product.category: untrimmed value(s) ${JSON.stringify(untrimmed)} - known source defect, preserved verbatim (run import with --normalize-category to fix)`);

  const products = await prisma.product.findMany({
    select: { slug: true, title: true, category: true, isActive: true },
    orderBy: { slug: 'asc' },
  });
  pass(`Product: ${products.length} rows, ${products.filter((p) => p.isActive).length} active`);
  for (const p of products) {
    console.log(`          ${p.slug.padEnd(28)} ${p.category.padEnd(24)} active=${p.isActive}`);
  }

  const mediaKinds = await prisma.media.groupBy({ by: ['mimeType'], _count: { _all: true } });
  pass(`Media: ${mediaKinds.map((m) => `${m.mimeType}=${m._count._all}`).join(', ')}`);

  const [firstAudit] = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' }, take: 1 });
  const [lastAudit] = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 1 });
  if (firstAudit && lastAudit) {
    pass(`AuditLog time range: ${firstAudit.createdAt.toISOString()} .. ${lastAudit.createdAt.toISOString()}`);
  }
} finally {
  await prisma.$disconnect();
}

console.log('');
if (failures.length) {
  console.log(`VERIFY FAILED: ${failures.length} fidelity problem(s)`);
  if (warnings.length) console.log(`          ${warnings.length} data-quality warning(s)`);
  process.exit(1);
}
console.log('VERIFY PASSED: MySQL copy matches the SQLite source.');
if (warnings.length) {
  console.log(`          ${warnings.length} data-quality warning(s) - source data, not migration loss.`);
}
