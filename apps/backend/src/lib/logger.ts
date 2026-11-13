/* Tiny dependency-free structured logger. */

type Level = 'debug' | 'info' | 'warn' | 'error';

const colors: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const reset = '\x1b[0m';

function log(level: Level, message: string, meta?: unknown) {
  const ts = new Date().toISOString();
  const prefix = `${colors[level]}[${level.toUpperCase()}]${reset} ${ts} ${message}`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined) fn(prefix, meta);
  else fn(prefix);
}

export const logger = {
  debug: (m: string, meta?: unknown) => process.env.NODE_ENV !== 'production' && log('debug', m, meta),
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta),
};
