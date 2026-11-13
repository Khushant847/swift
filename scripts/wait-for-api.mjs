#!/usr/bin/env node
/**
 * Wait until the backend is *ready* (HTTP 200 from /health/ready), not merely
 * started. Used by the root `npm run dev` script so Next.js and the admin SPA
 * do not render/fetch before the API can answer.
 *
 * Resolution order for the API origin (never invents a port):
 *   1. process.env.API_URL
 *   2. API_URL from apps/web/.env.local or apps/web/.env
 *   3. PORT from apps/backend/.env  →  http://127.0.0.1:<PORT>
 *   4. http://127.0.0.1:4000 (the documented default in the env examples)
 *
 * Uses node:http(s) rather than fetch: a pooled fetch keep-alive socket can
 * make an immediate `process.exit()` crash on Windows (libuv assertion), and
 * the child process must exit cleanly for `concurrently` to start the apps.
 *
 * Exit codes: 0 = ready, 1 = timed out / invalid config.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import http from 'node:http';
import https from 'node:https';

const root = resolve(import.meta.dirname, '..');
const timeoutMs = Number(process.env.API_READY_TIMEOUT_MS || 90_000);
const pollMs = 500;

function readEnvFile(relPath) {
  const out = {};
  try {
    const text = readFileSync(resolve(root, relPath), 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
    // Missing file is expected for optional env files.
  }
  return out;
}

function resolveOrigin() {
  if (process.env.API_URL) return process.env.API_URL;

  const webEnv = { ...readEnvFile('apps/web/.env'), ...readEnvFile('apps/web/.env.local') };
  if (webEnv.API_URL) return webEnv.API_URL;

  const backendEnv = readEnvFile('apps/backend/.env');
  const port = backendEnv.PORT || '4000';
  return `http://127.0.0.1:${port}`;
}

const origin = resolveOrigin().replace(/\/+$/, '');

// `localhost` can resolve to ::1 while the API binds IPv4 only in some
// environments. Normalise for the probe; the app's own URL is unchanged.
const probeOrigin = origin.replace(/\/\/(localhost|\[::1\])(?=[:/]|$)/i, '//127.0.0.1');
const readyUrl = `${probeOrigin}/health/ready`;

/** One readiness probe. Resolves true only for a 200 with `{ status: 'ok' }`. */
function probe() {
  return new Promise((resolvePromise) => {
    const lib = readyUrl.startsWith('https:') ? https : http;
    const req = lib.get(
      readyUrl,
      { headers: { Accept: 'application/json', Connection: 'close' }, timeout: 2_000 },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (body.length < 4_096) body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) return resolvePromise(false);
          try {
            resolvePromise(JSON.parse(body)?.status === 'ok');
          } catch {
            resolvePromise(false);
          }
        });
        res.on('error', () => resolvePromise(false));
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolvePromise(false));
  });
}

const started = Date.now();
let lastLog = 0;
let attempts = 0;
let ready = false;

process.stdout.write(
  `[wait-for-api] waiting for ${readyUrl} (up to ${Math.round(timeoutMs / 1000)}s)…\n`,
);

while (Date.now() - started < timeoutMs) {
  attempts += 1;
  if (await probe()) {
    process.stdout.write(
      `[wait-for-api] API ready after ${attempts} probe(s), ${((Date.now() - started) / 1000).toFixed(1)}s → ${origin}\n`,
    );
    ready = true;
    break;
  }
  const elapsed = Date.now() - started;
  if (elapsed - lastLog >= 5_000) {
    lastLog = elapsed;
    process.stdout.write(
      `[wait-for-api] still starting… ${Math.round(elapsed / 1000)}s elapsed (${attempts} probes)\n`,
    );
  }
  await new Promise((r) => setTimeout(r, pollMs));
}

if (!ready) {
  process.stderr.write(
    [
      '',
      `[wait-for-api] ✖ Backend did not become ready within ${Math.round(timeoutMs / 1000)}s.`,
      `  Probe URL: ${readyUrl}`,
      '  Check:',
      '    • is another process using the API port?  (the backend log prints "Port … is already in use")',
      '    • does apps/backend/.env exist and is DATABASE_URL valid?',
      '    • run `npm run dev -w @swift/backend` on its own to see the startup error',
      '',
    ].join('\n'),
  );
  process.exitCode = 1;
}
