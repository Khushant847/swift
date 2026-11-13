/**
 * API smoke test + contract snapshot.
 *
 * Runs the same request set against any backend and writes a normalised
 * snapshot. Two snapshots captured against SQLite and MySQL with identical
 * data must match, which proves the Prisma model port did not change any
 * response shape or value.
 *
 * Usage:
 *   node scripts/mysql/smoke-api.mjs --base http://127.0.0.1:4100 --out sqlite.json
 *   node scripts/mysql/smoke-api.mjs --base http://127.0.0.1:4200 --out mysql.json --writes
 *   node scripts/mysql/smoke-api.mjs --compare sqlite.json mysql.json
 *
 * The admin password is read from SMOKE_ADMIN_PASSWORD, or from the demo
 * password in apps/backend/prisma/seed.ts. It is never printed.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const flag = (name) => process.argv.includes(`--${name}`);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

// ─────────────────────────────────────────────────────────────
// Compare mode
// ─────────────────────────────────────────────────────────────
if (flag('compare')) {
  const i = process.argv.indexOf('--compare');
  const left = JSON.parse(readFileSync(path.resolve(process.argv[i + 1]), 'utf8'));
  const right = JSON.parse(readFileSync(path.resolve(process.argv[i + 2]), 'utf8'));
  const ignoreBody = new Set([
    'admin.dashboard',
    'admin.audit',
    'admin.backupInfo',
    'health.live',
  ]);
  let diffs = 0;
  const keys = new Set([...left.entries.map((e) => e.name), ...right.entries.map((e) => e.name)]);
  for (const key of keys) {
    const a = left.entries.find((e) => e.name === key);
    const b = right.entries.find((e) => e.name === key);
    if (!a || !b) {
      diffs += 1;
      console.log(`MISSING  ${key} (${a ? 'only in left' : 'only in right'})`);
      continue;
    }
    if (a.status !== b.status) {
      diffs += 1;
      console.log(`STATUS   ${key}: ${a.status} vs ${b.status}`);
      continue;
    }
    if (ignoreBody.has(key) || key.startsWith('write.')) {
      console.log(`ok*      ${key} (${a.status}, body excluded: volatile)`);
      continue;
    }
    if (a.hash !== b.hash) {
      diffs += 1;
      console.log(`BODY     ${key}: hash ${a.hash.slice(0, 12)} vs ${b.hash.slice(0, 12)}`);
      if (a.body !== undefined && b.body !== undefined) {
        console.log('  left :', JSON.stringify(a.body).slice(0, 400));
        console.log('  right:', JSON.stringify(b.body).slice(0, 400));
      }
    } else {
      console.log(`ok       ${key} (${a.status})`);
    }
  }
  console.log('');
  if (diffs) {
    console.log(`CONTRACT DIFF: ${diffs} difference(s)`);
    process.exit(1);
  }
  console.log(`CONTRACT MATCH: ${keys.size} endpoints identical`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────
// Snapshot mode
// ─────────────────────────────────────────────────────────────
const base = arg('base', 'http://127.0.0.1:4000').replace(/\/$/, '');
const outPath = path.resolve(arg('out', path.join(repoRoot, 'migration-audit', 'mysql-smoke', 'snapshot.json')));
const withWrites = flag('writes');
const origin = arg('origin', 'http://localhost:5173');
const label = arg('label', base);

const seedSrc = readFileSync(path.join(repoRoot, 'apps', 'backend', 'prisma', 'seed.ts'), 'utf8');
const seedPassword = seedSrc.match(/bcrypt\.hash\('([^']+)'/)?.[1];
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || 'admin@swiftinstruments.in';
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || seedPassword;
if (!adminPassword) {
  console.error('No admin password: set SMOKE_ADMIN_PASSWORD or check seed.ts');
  process.exit(1);
}

const VOLATILE = new Set(['uptime', 'ts', 'tsIso', 'lastLoginAt', 'serverTime', 'now', 'expiresAt', 'challengeId', 'latencyMs']);
const normalize = (value) => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = VOLATILE.has(k) ? '<volatile>' : normalize(v);
    return out;
  }
  return value;
};

const cookieJar = new Map();
const cookieHeader = () => [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

const entries = [];
const problems = [];

async function hit(name, method, urlPath, { body, expect = [200], contentType, raw, skipBody = false } = {}) {
  const headers = { Origin: origin, Referer: `${origin}/` };
  if (cookieJar.size) headers.Cookie = cookieHeader();
  let payload;
  if (raw) payload = raw;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + urlPath, { method, headers, body: payload, redirect: 'manual' });
  for (const cookie of res.headers.getSetCookie?.() ?? []) {
    const [pair] = cookie.split(';');
    const [k, ...rest] = pair.split('=');
    cookieJar.set(k, rest.join('='));
  }
  const ctype = res.headers.get('content-type') ?? '';
  let parsed;
  let text;
  if (!skipBody) {
    if (ctype.includes('application/json')) {
      text = await res.text();
      try {
        parsed = normalize(JSON.parse(text));
      } catch {
        parsed = { unparsable: text.slice(0, 200) };
      }
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      text = `<binary ${buf.length} bytes>`;
      parsed = undefined;
      if (ctype.includes('csv') || ctype.includes('text/')) {
        text = buf.toString('utf8');
        parsed = { textSha256: createHash('sha256').update(text).digest('hex'), bytes: buf.length };
      }
    }
  } else {
    await res.arrayBuffer();
  }

  const okStatus = expect.includes(res.status);
  const record = {
    name,
    method,
    path: urlPath,
    status: res.status,
    contentType: ctype.split(';')[0],
    body: skipBody ? undefined : parsed,
    hash: createHash('sha256')
      .update(skipBody ? `${res.status}` : JSON.stringify(parsed ?? text ?? ''))
      .digest('hex'),
  };
  entries.push(record);
  if (!okStatus) {
    problems.push(`${name}: expected ${expect.join('/')} got ${res.status} ${JSON.stringify(parsed).slice(0, 300)}`);
    console.log(`  FAIL  ${name.padEnd(38)} ${method.padEnd(6)} ${urlPath} -> ${res.status}`);
  } else {
    console.log(`  ok    ${name.padEnd(38)} ${method.padEnd(6)} ${urlPath} -> ${res.status}`);
  }
  return { status: res.status, body: parsed, text };
}

const json = (name, urlPath, opts) => hit(name, 'GET', urlPath, opts);

try {
  // ── health ─────────────────────────────────────────────────
  await json('health.live', '/health');
  await json('health.ready', '/health/ready');
  await json('health.api', '/api/health');

  // ── public reads ───────────────────────────────────────────
  await json('public.nav', '/api/v1/nav');
  await json('public.banners', '/api/v1/banners');
  await json('public.whyChooseUs', '/api/v1/why-choose-us');
  await json('public.categories', '/api/v1/products/categories');
  const products = await json('public.products', '/api/v1/products?limit=100');
  await json('public.products.search', '/api/v1/products?search=laminar');
  await json('public.products.filter', '/api/v1/products?category=Air%20Purifier');
  await json('public.products.featured', '/api/v1/products?featured=true');
  await json('public.products.page2', '/api/v1/products?page=2&limit=5');
  await json('public.companyInfo', '/api/v1/company-info');
  await json('public.upcoming', '/api/v1/upcoming');
  await json('public.gallery', '/api/v1/gallery');
  await json('public.gallery.all', '/api/v1/gallery?category=all');
  await json('public.gallery.tags', '/api/v1/gallery/tags');
  await json('public.reviews', '/api/v1/reviews');
  await json('public.settings', '/api/v1/settings');
  await json('public.product.404', '/api/v1/products/does-not-exist', { expect: [404] });

  const items = products.body?.data?.items ?? [];
  for (const item of items) {
    await json(`public.product.${item.slug}`, `/api/v1/products/${item.slug}`);
  }

  // ── auth ───────────────────────────────────────────────────
  const login = await hit('admin.login', 'POST', '/api/v1/admin/auth/login', {
    body: { email: adminEmail, password: adminPassword },
  });
  const loggedIn = login.body?.data?.admin != null || login.body?.data?.mfaRequired === false;
  if (!loggedIn) problems.push(`login did not create a session: ${JSON.stringify(login.body).slice(0, 300)}`);

  await json('admin.me', '/api/v1/admin/auth/me');
  await json('admin.dashboard', '/api/v1/admin/dashboard', { skipBody: true });

  // ── admin reads ────────────────────────────────────────────
  const adminProducts = await json('admin.products', '/api/v1/admin/products');
  const adminBanners = await json('admin.banners', '/api/v1/admin/banners');
  const adminWhy = await json('admin.whyChooseUs', '/api/v1/admin/why-choose-us');
  const adminUpcoming = await json('admin.upcoming', '/api/v1/admin/upcoming');
  const adminGallery = await json('admin.gallery', '/api/v1/admin/gallery');
  const adminNav = await json('admin.nav', '/api/v1/admin/nav');
  const adminReviews = await json('admin.reviews', '/api/v1/admin/reviews');
  const adminMedia = await json('admin.media', '/api/v1/admin/media');
  const adminEnquiries = await json('admin.enquiries', '/api/v1/admin/enquiries');
  await json('admin.enquiries.stats', '/api/v1/admin/enquiries/stats');
  await json('admin.enquiries.export', '/api/v1/admin/enquiries/export');
  await json('admin.companyInfo', '/api/v1/admin/company-info');
  await json('admin.settings', '/api/v1/admin/settings');
  await json('admin.users', '/api/v1/admin/users');
  await json('admin.audit', '/api/v1/admin/audit?limit=10', { skipBody: true });
  await json('admin.backupInfo', '/api/v1/admin/backup/info', { skipBody: true });

  const firstOf = (res) => {
    const data = res.body?.data;
    if (Array.isArray(data)) return data[0];
    if (Array.isArray(data?.items)) return data.items[0];
    return undefined;
  };
  for (const [name, res, singular] of [
    ['admin.product', adminProducts, 'product'],
    ['admin.banner', adminBanners, 'banner'],
    ['admin.whyChooseUs', adminWhy, 'why'],
    ['admin.upcoming', adminUpcoming, 'upcoming'],
    ['admin.gallery', adminGallery, 'gallery'],
    ['admin.nav', adminNav, 'nav'],
    ['admin.review', adminReviews, 'review'],
    ['admin.enquiry', adminEnquiries, 'enquiry'],
  ]) {
    const row = firstOf(res);
    if (!row) {
      problems.push(`${name}: no row to fetch`);
      continue;
    }
    const prefix = {
      product: '/api/v1/admin/products',
      banner: '/api/v1/admin/banners',
      why: '/api/v1/admin/why-choose-us',
      upcoming: '/api/v1/admin/upcoming',
      gallery: '/api/v1/admin/gallery',
      nav: '/api/v1/admin/nav',
      review: '/api/v1/admin/reviews',
      enquiry: '/api/v1/admin/enquiries',
    }[singular];
    await json(`${name}.byId`, `${prefix}/${row.id}`);
  }

  // Media has list/upload/patch/delete but no GET /:id (the admin UI never
  // asks for a single media row). Record the 404 so the contract is explicit.
  const firstMedia = firstOf(adminMedia);
  if (firstMedia) {
    await json('admin.media.byId.absent', `/api/v1/admin/media/${firstMedia.id}`, { expect: [404] });
  }

  // ── writes (disposable records, deleted immediately) ───────
  if (withWrites) {
    const created = [];
    const tracker = {
      async create(name, pathName, body, prefix) {
        const res = await hit(`write.${name}.create`, 'POST', pathName, { body, expect: [200, 201] });
        const id = res.body?.data?.id;
        if (!id) {
          problems.push(`write.${name}.create: no id in response`);
          return null;
        }
        created.push({ path: `${prefix}/${id}`, name });
        return id;
      },
      async update(name, id, prefix, body, method = 'PUT') {
        return hit(`write.${name}.update`, method, `${prefix}/${id}`, { body });
      },
      async del(name, id, prefix) {
        return hit(`write.${name}.delete`, 'DELETE', `${prefix}/${id}`, { body: undefined });
      },
    };

    const productId = await tracker.create(
      'product',
      '/api/v1/admin/products',
      {
        title: 'Migration Smoke Product',
        slug: 'migration-smoke-product',
        category: 'Laboratory Instruments',
        shortDesc: 'Temporary record created by the migration smoke test.',
        description: '<p>Temporary record. Deleted at the end of the run.</p>',
        specs: JSON.stringify([{ label: 'Temp', value: 'Yes' }]),
      },
      '/api/v1/admin/products',
    );
    if (productId) {
      await tracker.update('product', productId, '/api/v1/admin/products', { title: 'Migration Smoke Product v2' });
      await tracker.del('product', productId, '/api/v1/admin/products');
    }

    const bannerId = await tracker.create(
      'banner',
      '/api/v1/admin/banners',
      { title: 'Smoke banner', mediaUrl: '/uploads/smoke.png', mediaType: 'image' },
      '/api/v1/admin/banners',
    );
    if (bannerId) {
      await tracker.update('banner', bannerId, '/api/v1/admin/banners', { title: 'Smoke banner v2' });
      await tracker.del('banner', bannerId, '/api/v1/admin/banners');
    }

    const whyId = await tracker.create(
      'whyChooseUs',
      '/api/v1/admin/why-choose-us',
      { title: 'Smoke USP', description: 'Temporary USP for the smoke test.', icon: 'BadgeCheck' },
      '/api/v1/admin/why-choose-us',
    );
    if (whyId) {
      await tracker.update('whyChooseUs', whyId, '/api/v1/admin/why-choose-us', { title: 'Smoke USP v2' });
      await tracker.del('whyChooseUs', whyId, '/api/v1/admin/why-choose-us');
    }

    const upcomingId = await tracker.create(
      'upcoming',
      '/api/v1/admin/upcoming',
      { title: 'Smoke upcoming', teaserDesc: 'Temporary teaser.', expectedLaunch: '2027' },
      '/api/v1/admin/upcoming',
    );
    if (upcomingId) {
      await tracker.update('upcoming', upcomingId, '/api/v1/admin/upcoming', { title: 'Smoke upcoming v2' });
      await tracker.del('upcoming', upcomingId, '/api/v1/admin/upcoming');
    }

    const galleryId = await tracker.create(
      'gallery',
      '/api/v1/admin/gallery',
      { mediaUrl: '/uploads/smoke-gallery.png', mediaType: 'image', categoryTag: 'Office' },
      '/api/v1/admin/gallery',
    );
    if (galleryId) await tracker.del('gallery', galleryId, '/api/v1/admin/gallery');

    const navId = await tracker.create(
      'nav',
      '/api/v1/admin/nav',
      { title: 'Smoke Nav', url: '/smoke-nav', location: 'footer' },
      '/api/v1/admin/nav',
    );
    if (navId) {
      await tracker.update('nav', navId, '/api/v1/admin/nav', { title: 'Smoke Nav v2' });
      await tracker.del('nav', navId, '/api/v1/admin/nav');
    }

    const reviewId = await tracker.create(
      'review',
      '/api/v1/admin/reviews',
      { authorName: 'Smoke Reviewer', rating: 5, text: 'Temporary review for the smoke test.' },
      '/api/v1/admin/reviews',
    );
    if (reviewId) {
      await tracker.update('review', reviewId, '/api/v1/admin/reviews', { text: 'Temporary review v2.' });
      await tracker.del('review', reviewId, '/api/v1/admin/reviews');
    }

    const userId = await tracker.create(
      'user',
      '/api/v1/admin/users',
      {
        username: 'Smoke Admin',
        email: 'smoke-temp@example.invalid',
        password: 'SmokeTemp!12345',
        role: 'content_editor',
      },
      '/api/v1/admin/users',
    );
    if (userId) {
      await tracker.update('user', userId, '/api/v1/admin/users', { username: 'Smoke Admin v2' });
      await tracker.del('user', userId, '/api/v1/admin/users');
    }

    // Public enquiry -> admin update -> delete.
    const enquiry = await hit('write.enquiry.create', 'POST', '/api/v1/enquiries', {
      body: {
        name: 'Smoke Test',
        email: 'smoke@example.invalid',
        phone: '+91 99999 00000',
        subject: 'Migration smoke test',
        message: 'Temporary enquiry created by the migration smoke test. Safe to delete.',
      },
      expect: [200, 201],
    });
    const enquiryId = enquiry.body?.data?.id;
    if (enquiryId) {
      await hit('write.enquiry.update', 'PATCH', `/api/v1/admin/enquiries/${enquiryId}`, {
        body: { status: 'closed', notes: 'smoke' },
      });
      await hit('write.enquiry.delete', 'DELETE', `/api/v1/admin/enquiries/${enquiryId}`);
    } else {
      problems.push('write.enquiry.create: no id in response');
    }

    // Media upload -> patch -> delete.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'smoke.png');
    form.append('folder', 'general');
    form.append('tags', 'smoke');
    const upload = await hit('write.media.upload', 'POST', '/api/v1/admin/media/upload', {
      raw: form,
      expect: [200, 201],
    });
    const mediaId = upload.body?.data?.id;
    if (mediaId) {
      await hit('write.media.update', 'PATCH', `/api/v1/admin/media/${mediaId}`, { body: { tags: 'smoke,updated' } });
      await hit('write.media.delete', 'DELETE', `/api/v1/admin/media/${mediaId}`);
    } else {
      problems.push('write.media.upload: no id in response');
    }

    // Idempotent bulk upserts: write back the exact value already stored.
    // company-info applies sanitizeText() to non-HTML keys, so only probe a
    // plain-text key (writing back HTML such as map_embed would strip it).
    const companyInfo = await json('admin.companyInfo.values', '/api/v1/admin/company-info');
    const companyMap = companyInfo.body?.data ?? {};
    const probeKey = ['phone', 'email', 'address'].find((k) => typeof companyMap[k] === 'string');
    if (probeKey) {
      await hit('write.companyInfo.upsert', 'PUT', '/api/v1/admin/company-info', {
        body: { items: [{ keyName: probeKey, keyValue: companyMap[probeKey] }] },
      });
    }
    const settings = await json('admin.settings.values', '/api/v1/admin/settings');
    const settingsMap = settings.body?.data ?? {};
    const settingKey = Object.keys(settingsMap)[0];
    if (settingKey) {
      await hit('write.settings.upsert', 'PUT', '/api/v1/admin/settings', {
        body: { items: [{ keyName: settingKey, keyValue: String(settingsMap[settingKey]) }] },
      });
    }

    // Reorder with the current order (a no-op that still exercises the route).
    if (Array.isArray(adminBanners.body?.data) && adminBanners.body.data.length) {
      await hit('write.banners.reorder', 'POST', '/api/v1/admin/banners/reorder', {
        body: {
          items: adminBanners.body.data.map((b, index) => ({ id: b.id, position: index })),
        },
      });
    }
    if (Array.isArray(adminNav.body?.data) && adminNav.body.data.length) {
      await hit('write.nav.reorder', 'POST', '/api/v1/admin/nav/reorder', {
        body: {
          items: adminNav.body.data.map((n, index) => ({ id: n.id, position: index })),
        },
      });
    }
    if (Array.isArray(adminUpcoming.body?.data) && adminUpcoming.body.data.length) {
      await hit('write.upcoming.reorder', 'POST', '/api/v1/admin/upcoming/reorder', {
        body: {
          items: adminUpcoming.body.data.map((u, index) => ({ id: u.id, position: index })),
        },
      });
    }

    await hit('admin.logout', 'POST', '/api/v1/admin/auth/logout');
  }

  // ── output ─────────────────────────────────────────────────
  const snapshot = {
    label,
    base,
    capturedAt: new Date().toISOString(),
    writes: withWrites,
    entries,
  };
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log('');
  console.log(`label   : ${label}`);
  console.log(`requests: ${entries.length}`);
  console.log(`problems: ${problems.length}`);
  console.log(`snapshot: ${path.relative(repoRoot, outPath).replace(/\\/g, '/')}`);
  if (problems.length) {
    console.log('');
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
} catch (err) {
  console.error('Smoke run crashed:', err);
  process.exit(1);
}
