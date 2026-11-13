#!/usr/bin/env node
/**
 * Copy every row from the local SQLite dev database into PostgreSQL.
 *
 * Reads with Node's built-in `node:sqlite` (no extra dependency) and writes with
 * the Prisma client generated for the target schema, so ids, enums, booleans and
 * DateTimes are converted exactly the way the app writes them.
 *
 * Prereqs:
 *   1. `node apps/backend/scripts/prisma-generate.mjs postgres`
 *   2. DATABASE_URL (PostgreSQL) in the env file or process env
 *
 * Safe by default:
 *   - dry run unless --apply is passed
 *   - refuses to touch a target that already has rows unless --truncate is passed
 *   - never writes to or deletes the SQLite source
 *
 * Usage:
 *   node scripts/db/copy-sqlite-to-postgres.mjs                    # plan only
 *   node scripts/db/copy-sqlite-to-postgres.mjs --apply            # copy rows
 *   node scripts/db/copy-sqlite-to-postgres.mjs --apply --truncate # wipe target first
 *   node scripts/db/copy-sqlite-to-postgres.mjs --source apps/backend/prisma/dev.db.bak-x
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const requireFromRoot = createRequire(path.join(repoRoot, 'package.json'));

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const truncate = args.includes('--truncate');
const sourceArg = args.indexOf('--source');
const envArg = args.indexOf('--env');

const source = path.resolve(
  repoRoot,
  sourceArg >= 0 && args[sourceArg + 1] ? args[sourceArg + 1] : 'apps/backend/prisma/dev.db',
);
const envFiles = ['.env.local', path.join('apps', 'backend', '.env')];
const envFile = path.resolve(
  repoRoot,
  envArg >= 0 && args[envArg + 1]
    ? args[envArg + 1]
    : (envFiles.find((candidate) => fs.existsSync(path.resolve(repoRoot, candidate))) ?? envFiles[0]),
);

if (!fs.existsSync(source)) {
  console.error(`[db-copy] Source database not found: ${source}`);
  process.exit(1);
}
if (fs.existsSync(envFile)) {
  requireFromRoot('dotenv').config({ path: envFile, override: false });
  console.log(`[db-copy] env: ${path.relative(repoRoot, envFile)}`);
}

const url = process.env.DATABASE_URL || '';
// Prisma Postgres (Vercel Marketplace) injects a `prisma+postgres://` URL; plain
// Neon/Supabase/self-hosted targets use `postgresql://`. Both are accepted here
// because the copy goes through Prisma Client, which understands both.
if (!/^(prisma\+)?postgres(ql)?:\/\//.test(url)) {
  console.error(
    '[db-copy] DATABASE_URL is not a PostgreSQL URL. Generate the Postgres client and point ' +
      'DATABASE_URL at the target database (or pass --env <file>). Value is never printed.',
  );
  process.exit(1);
}

const { PrismaClient, Prisma } = await import('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });
const sqlite = new DatabaseSync(source);

const models = Prisma.dmmf.datamodel.models.map((model) => {
  const scalarFields = model.fields.filter(
    (field) => field.kind === 'scalar' || field.kind === 'enum',
  );
  return {
    name: model.name,
    table: model.dbName ?? model.name,
    fields: scalarFields.map((field) => ({
      name: field.name,
      column: field.dbName ?? field.name,
      type: field.type,
      kind: field.kind,
    })),
  };
});

function tableExists(table) {
  const row = sqlite
    .prepare("select name from sqlite_master where type='table' and name = ?")
    .get(table);
  return Boolean(row);
}

function convert(value, field) {
  if (value === null || value === undefined) return null;
  if (field.type === 'Boolean') return Boolean(value);
  if (field.type === 'DateTime') return value instanceof Date ? value : new Date(Number(value));
  if (field.type === 'Int' || field.type === 'BigInt') return Number(value);
  return value;
}

const plan = [];
for (const model of models) {
  if (!tableExists(model.table)) {
    plan.push({ ...model, rows: [], missing: true });
    continue;
  }
  const rows = sqlite.prepare(`select * from "${model.table}"`).all();
  plan.push({ ...model, rows, missing: false });
}

const totalRows = plan.reduce((sum, item) => sum + item.rows.length, 0);
console.log(`[db-copy] source: ${path.relative(repoRoot, source)} (${totalRows} rows)`);
for (const item of plan) {
  console.log(`  ${item.name.padEnd(18)} ${item.missing ? 'table missing in source' : `${item.rows.length} rows`}`);
}

if (!apply) {
  console.log('[db-copy] Dry run only. Re-run with --apply to write to PostgreSQL.');
  sqlite.close();
  await prisma.$disconnect();
  process.exit(0);
}

const existing = [];
for (const item of plan) {
  const count = await prisma[item.name].count();
  if (count > 0) existing.push(`${item.name}=${count}`);
}
if (existing.length > 0) {
  if (!truncate) {
    console.error(
      `[db-copy] Target tables already contain rows (${existing.join(', ')}). ` +
        'Nothing was written. Re-run with --truncate only if wiping them is intended.',
    );
    sqlite.close();
    await prisma.$disconnect();
    process.exit(1);
  }
  // Children before parents keeps FK constraints satisfied.
  for (const item of [...plan].reverse()) {
    await prisma[item.name].deleteMany();
  }
  console.log('[db-copy] Target tables cleared (--truncate).');
}

// Insert in declaration order, deferring tables that hit a foreign-key mismatch
// so the script does not depend on a hand-maintained dependency list.
let pending = plan.filter((item) => item.rows.length > 0);
let inserted = 0;
const failures = [];

while (pending.length > 0) {
  const deferred = [];
  let progressed = false;

  for (const item of pending) {
    const data = item.rows.map((row) => {
      const mapped = {};
      for (const field of item.fields) {
        if (!(field.column in row)) continue;
        mapped[field.name] = convert(row[field.column], field);
      }
      return mapped;
    });

    try {
      const result = await prisma[item.name].createMany({ data, skipDuplicates: true });
      inserted += result.count;
      progressed = true;
      console.log(`  copied ${item.name}: ${result.count}/${data.length}`);
    } catch (err) {
      if (err?.code === 'P2003') {
        deferred.push(item);
        continue;
      }
      failures.push(`${item.name}: ${err?.message ?? err}`);
    }
  }

  if (!progressed && deferred.length > 0) {
    failures.push(
      `Foreign-key dependency loop or missing parent rows for: ${deferred.map((d) => d.name).join(', ')}`,
    );
    break;
  }
  pending = deferred;
}

sqlite.close();
await prisma.$disconnect();

if (failures.length > 0) {
  console.error('[db-copy] Failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`[db-copy] Done — ${inserted} rows inserted.`);
