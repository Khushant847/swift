/**
 * Shared metadata for the SQLite -> MySQL migration rehearsal.
 *
 * Kept in one place so the export, import and verify scripts cannot disagree
 * about which columns are dates, which are booleans, or how long a VARCHAR is.
 *
 * The limits mirror apps/backend/prisma/schema.mysql.prisma exactly. If that
 * schema changes, change this file too and re-run the export (it validates
 * every string against these limits before anything is written to MySQL).
 */

/** Insert order. Parents before children so foreign keys always resolve. */
export const TABLES = [
  'Admin',
  'EmailOtp',
  'NavigationLink',
  'HeroBanner',
  'WhyChooseUs',
  'Product',
  'CompanyInfo',
  'UpcomingProduct',
  'GalleryMedia',
  'Review',
  'Enquiry',
  'Media',
  'Setting',
  'AuditLog',
];

/**
 * Per-model column metadata.
 *   dates    - stored as INTEGER (unix ms) in SQLite, DATETIME(3) in MySQL
 *   booleans - stored as 0/1 in SQLite, TINYINT(1) in MySQL
 *   varchars - max character length in the MySQL schema (used for validation)
 */
export const MODELS = {
  Admin: {
    dates: ['lastLoginAt', 'createdAt', 'updatedAt'],
    booleans: ['isActive', 'mfaEnabled'],
    varchars: { username: 60, email: 191, passwordHash: 100, role: 32, mfaSecret: 64 },
  },
  EmailOtp: {
    dates: ['expiresAt', 'createdAt'],
    booleans: ['consumed'],
    varchars: { adminId: 191, codeHash: 100 },
  },
  NavigationLink: {
    dates: [],
    booleans: ['isActive'],
    varchars: { title: 80, url: 300, location: 16 },
  },
  HeroBanner: {
    dates: ['createdAt'],
    booleans: ['isActive'],
    varchars: { title: 160, subtitle: 300, ctaLabel: 60, ctaUrl: 300, mediaUrl: 512, mediaType: 16 },
  },
  WhyChooseUs: {
    dates: [],
    booleans: ['isActive'],
    varchars: { title: 160, description: 600, icon: 60 },
  },
  Product: {
    dates: ['createdAt', 'updatedAt'],
    booleans: ['isFeatured', 'isActive'],
    varchars: { title: 200, slug: 120, category: 80, shortDesc: 300, imageUrl: 512 },
  },
  CompanyInfo: {
    dates: ['updatedAt'],
    booleans: [],
    varchars: { keyName: 60 },
  },
  UpcomingProduct: {
    dates: ['createdAt'],
    booleans: ['isActive'],
    varchars: { title: 200, teaserDesc: 1000, expectedLaunch: 80, imageUrl: 512 },
  },
  GalleryMedia: {
    dates: ['uploadedAt'],
    booleans: [],
    varchars: { mediaUrl: 512, mediaType: 16, categoryTag: 60, caption: 200 },
  },
  Review: {
    dates: ['reviewTime'],
    booleans: ['isFeatured', 'isHidden'],
    varchars: { authorName: 120, text: 2000, profilePhotoUrl: 512, source: 16, googleReviewId: 191 },
  },
  Enquiry: {
    dates: ['createdAt', 'updatedAt'],
    booleans: [],
    varchars: {
      name: 120,
      email: 191,
      phone: 32,
      companyName: 160,
      subject: 200,
      status: 16,
      ipAddress: 45,
    },
  },
  Media: {
    dates: ['uploadedAt'],
    booleans: [],
    varchars: { url: 512, filename: 255, originalName: 255, mimeType: 100, folder: 60, tags: 300 },
  },
  Setting: {
    dates: ['updatedAt'],
    booleans: [],
    varchars: { keyName: 60 },
  },
  AuditLog: {
    dates: ['createdAt'],
    booleans: [],
    varchars: {
      adminId: 191,
      adminEmail: 191,
      action: 40,
      entity: 40,
      entityId: 191,
      ipAddress: 45,
      userAgent: 512,
    },
  },
};

function toIso(value, table, column) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`${table}.${column}: invalid Date`);
    return value.toISOString();
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error(`${table}.${column}: invalid epoch ${value}`);
    return d.toISOString();
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error(`${table}.${column}: unparseable date ${value}`);
    return d.toISOString();
  }
  throw new Error(`${table}.${column}: unsupported date value ${typeof value}`);
}

/** SQLite integer/MySQL tinyint -> boolean, so both sides hash identically. */
function toBool(value) {
  if (value === null || value === undefined) return null;
  return value === true || value === 1 || value === '1';
}

/**
 * Normalises a row read from either database into the same plain-JSON shape:
 * dates -> ISO-8601 UTC strings, booleans -> true/false, undefined -> null.
 * Column order is taken from the row object's own keys, so the checksum is
 * stable as long as both databases expose the same columns.
 */
export function normalizeRow(table, row) {
  const meta = MODELS[table];
  if (!meta) throw new Error(`normalizeRow: unknown model ${table}`);
  const out = {};
  for (const key of Object.keys(row)) {
    const value = row[key];
    if (meta.dates.includes(key)) out[key] = toIso(value, table, key);
    else if (meta.booleans.includes(key)) out[key] = toBool(value);
    else out[key] = value === undefined ? null : value;
  }
  return out;
}

/** Order-independent-by-key, deterministic JSON (keys sorted). */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

/**
 * Validates a normalised row against the MySQL column limits.
 * Returns a list of human-readable problems (empty = safe to insert).
 */
export function validateRow(table, row) {
  const meta = MODELS[table];
  const problems = [];
  for (const [column, max] of Object.entries(meta.varchars)) {
    const value = row[column];
    if (typeof value === 'string' && value.length > max) {
      problems.push(`${table}.${column}: ${value.length} chars > VARCHAR(${max})`);
    }
  }
  if (table === 'Product' && row.specs != null) {
    try {
      const parsed = JSON.parse(row.specs);
      if (!Array.isArray(parsed)) problems.push('Product.specs: not a JSON array');
      else if (parsed.some((it) => !it || typeof it.label !== 'string' || typeof it.value !== 'string')) {
        problems.push('Product.specs: item without string label/value');
      }
    } catch {
      problems.push('Product.specs: invalid JSON');
    }
  }
  if (table === 'Enquiry' && row.ipAddress != null && !/^[0-9a-fA-F:.]{3,45}$/.test(row.ipAddress)) {
    problems.push(`Enquiry.ipAddress: unexpected format ${JSON.stringify(row.ipAddress)}`);
  }
  return problems;
}

/** MySQL foreign keys we want to prove are intact after import. */
export const RELATIONS = [
  {
    name: 'AuditLog.adminId -> Admin.id',
    child: 'AuditLog',
    column: 'adminId',
    parent: 'Admin',
  },
];
