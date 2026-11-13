/**
 * Step 2 of the MySQL rehearsal: load the JSON snapshot from export-sqlite.mjs
 * into MySQL through the generated MySQL Prisma client.
 *
 * Safety rails:
 *   - refuses a non-MySQL DATABASE_URL (never touches SQLite)
 *   - refuses a non-loopback host unless --allow-remote is passed
 *   - refuses to write into a non-empty database unless --truncate is passed
 *   - validates every row against the MySQL column limits before writing
 *   - runs the whole import in one transaction
 *
 * Usage (the password never appears on the command line):
 *   node --env-file=apps/backend/.env.mysql.local scripts/mysql/import-mysql.mjs --truncate
 *   node --env-file=apps/backend/.env.mysql.local scripts/mysql/import-mysql.mjs --truncate --normalize-category
 *   node --env-file=apps/backend/.env.mysql.local scripts/mysql/import-mysql.mjs --dry-run
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLES, canonicalJson, validateRow } from './schema-meta.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const flag = (name) => process.argv.includes(`--${name}`);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const dataPath = path.resolve(arg('data', path.join(repoRoot, 'migration-audit', 'mysql-export', 'data.json')));
const reportPath = path.resolve(arg('report', path.join(repoRoot, 'migration-audit', 'mysql-export', 'import-report.json')));
const truncate = flag('truncate');
const dryRun = flag('dry-run');
const normalizeCategory = flag('normalize-category');
const allowRemote = flag('allow-remote');
const CHUNK = 200;

// ── 1. Guard the target ────────────────────────────────────────
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run with --env-file=apps/backend/.env.mysql.local');
  process.exit(1);
}
if (!url.startsWith('mysql://')) {
  console.error('Refusing to import: DATABASE_URL is not a mysql:// URL.');
  process.exit(1);
}
let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error('Refusing to import: DATABASE_URL cannot be parsed.');
  process.exit(1);
}
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !allowRemote) {
  console.error(`Refusing to import into non-local host "${host}" without --allow-remote.`);
  process.exit(1);
}

// ── 2. Load + transform + validate ────────────────────────────
const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const transforms = { normalizeCategory };
const expected = {};
let totalRows = 0;

for (const table of TABLES) {
  const rows = data[table];
  if (!Array.isArray(rows)) {
    console.error(`data.json is missing table "${table}"`);
    process.exit(1);
  }
  const problems = [];
  for (const row of rows) {
    if (table === 'Product' && normalizeCategory) {
      const before = row.category;
      row.category = String(before).replace(/\s+/g, ' ').trim();
    }
    for (const p of validateRow(table, row)) problems.push(`${row.id}: ${p}`);
  }
  if (problems.length) {
    console.error(`Validation failed for ${table}:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(2);
  }
  expected[table] = {
    count: rows.length,
    checksum: createHash('sha256').update(canonicalJson(rows)).digest('hex'),
  };
  totalRows += rows.length;
}

if (dryRun) {
  console.log(`Dry run OK: ${totalRows} rows across ${TABLES.length} tables validated. Nothing written.`);
  process.exit(0);
}

// ── 3. Connect ────────────────────────────────────────────────
const clientPath = path.join(repoRoot, 'node_modules', '.prisma', 'client-mysql', 'index.js');
const { PrismaClient } = await import(new URL(`file:///${clientPath.replace(/\\/g, '/')}`).href);
const prisma = new PrismaClient();

const toInsert = (table, row) => {
  const out = { ...row };
  // Prisma accepts ISO strings, but explicit Date objects make the intent clear
  // and fail loudly if a timestamp slipped through unnormalised.
  for (const key of ['createdAt', 'updatedAt', 'lastLoginAt', 'expiresAt', 'uploadedAt', 'reviewTime']) {
    if (typeof out[key] === 'string') out[key] = new Date(out[key]);
  }
  return out;
};

try {
  // ── 4. Empty target check ──────────────────────────────────
  const nonEmpty = [];
  for (const table of TABLES) {
    const count = await prisma[modelKey(table)].count();
    if (count > 0) nonEmpty.push(`${table}=${count}`);
  }
  if (nonEmpty.length && !truncate) {
    console.error(`Target database is not empty (${nonEmpty.join(', ')}).`);
    console.error('Pass --truncate to clear it first (test database only).');
    process.exit(3);
  }

  // ── 5. One transaction: clear (optional) + insert ──────────
  await prisma.$transaction(
    async (tx) => {
      if (truncate) {
        for (const table of [...TABLES].reverse()) {
          await tx[modelKey(table)].deleteMany();
        }
      }
      for (const table of TABLES) {
        const rows = data[table];
        const key = modelKey(table);
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK).map((row) => toInsert(table, row));
          if (chunk.length) await tx[key].createMany({ data: chunk });
        }
        console.log(`  ${table.padEnd(16)} inserted ${String(rows.length).padStart(4)}`);
      }
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  // ── 6. Expected-state report for verify-mysql.mjs ──────────
  const report = {
    generatedAt: new Date().toISOString(),
    target: { host, database: new URL(url).pathname.replace(/^\//, '') },
    transforms,
    tables: expected,
    totalRows,
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('');
  console.log(`imported ${totalRows} rows into ${report.target.database} @ ${host}`);
  if (normalizeCategory) console.log('applied transform: Product.category trim + whitespace collapse');
  console.log(`report: ${path.relative(repoRoot, reportPath).replace(/\\/g, '/')}`);
} finally {
  await prisma.$disconnect();
}

function modelKey(table) {
  return table.charAt(0).toLowerCase() + table.slice(1);
}
