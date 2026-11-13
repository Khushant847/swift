/**
 * Step 1 of the MySQL rehearsal: read the SQLite database (read-only) and write
 * a normalised JSON snapshot plus a manifest of per-table counts and checksums.
 *
 * The SQLite file is opened with { readOnly: true } - this script cannot write
 * to it, cannot create journals and cannot change data.
 *
 * Output (gitignored - it contains PII and password hashes):
 *   migration-audit/mysql-export/data.json
 *   migration-audit/mysql-export/manifest.json
 *   migration-audit/mysql-export/defects.json
 *
 * Usage:
 *   node scripts/mysql/export-sqlite.mjs [--db path/to/dev.db] [--out dir]
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TABLES,
  MODELS,
  canonicalJson,
  normalizeRow,
  validateRow,
} from './schema-meta.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const dbPath = path.resolve(arg('db', path.join(repoRoot, 'apps', 'backend', 'prisma', 'dev.db')));
const outDir = path.resolve(arg('out', path.join(repoRoot, 'migration-audit', 'mysql-export')));

if (!statSync(dbPath, { throwIfNoEntry: false })) {
  console.error(`SQLite file not found: ${dbPath}`);
  process.exit(1);
}

const dbBytes = readFileSync(dbPath);
const dbSha256 = createHash('sha256').update(dbBytes).digest('hex');
const db = new DatabaseSync(dbPath, { readOnly: true });

const data = {};
const manifest = {
  generatedAt: new Date().toISOString(),
  source: {
    engine: 'sqlite',
    file: path.relative(repoRoot, dbPath).replace(/\\/g, '/'),
    bytes: dbBytes.length,
    sha256: dbSha256,
  },
  tables: {},
};
const defects = [];
let totalRows = 0;
let totalProblems = 0;

const quote = (id) => `"${id.replace(/"/g, '""')}"`;

for (const table of TABLES) {
  const meta = MODELS[table];
  const columns = db
    .prepare(`PRAGMA table_info(${quote(table)})`)
    .all()
    .map((c) => c.name);
  const expected = new Set([...meta.dates, ...meta.booleans, ...Object.keys(meta.varchars)]);
  const missing = [...expected].filter((c) => !columns.includes(c));

  const rows = db
    .prepare(`SELECT * FROM ${quote(table)} ORDER BY "id"`)
    .all()
    .map((row) => normalizeRow(table, row));

  const problems = [];
  for (const column of missing) problems.push(`${table}.${column}: column missing in source`);
  for (const row of rows) {
    for (const p of validateRow(table, row)) problems.push(`${row.id}: ${p}`);
  }

  const checksum = createHash('sha256').update(canonicalJson(rows)).digest('hex');
  data[table] = rows;
  manifest.tables[table] = { count: rows.length, checksum, columns: columns.length };
  totalRows += rows.length;

  if (problems.length) {
    totalProblems += problems.length;
    defects.push({ table, problems });
    console.log(`  ${table.padEnd(16)} ${String(rows.length).padStart(4)} rows  PROBLEMS: ${problems.length}`);
    for (const p of problems.slice(0, 5)) console.log(`      - ${p}`);
    if (problems.length > 5) console.log(`      ... ${problems.length - 5} more`);
  } else {
    console.log(`  ${table.padEnd(16)} ${String(rows.length).padStart(4)} rows  ok`);
  }
}

manifest.totalRows = totalRows;

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'data.json'), JSON.stringify(data), 'utf8');
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
writeFileSync(
  path.join(outDir, 'defects.json'),
  JSON.stringify({ generatedAt: manifest.generatedAt, totalProblems, tables: defects }, null, 2),
  'utf8',
);

console.log('');
console.log(`source : ${manifest.source.file}`);
console.log(`sha256 : ${dbSha256}`);
console.log(`tables : ${TABLES.length}`);
console.log(`rows   : ${totalRows}`);
console.log(`defects: ${totalProblems}${totalProblems ? ' (see defects.json - import will refuse to truncate data)' : ''}`);
console.log(`written: ${path.relative(repoRoot, outDir).replace(/\\/g, '/')}/data.json`);

db.close();

if (totalProblems) {
  // A column-limit or JSON problem means MySQL would silently truncate or reject
  // the value. Stop before any write so the owner can decide (fix data vs widen).
  process.exit(2);
}
