import { config } from 'dotenv';

config();

const REQUIRED = ['MONGO_URL', 'TOKEN_SECRET_KEY'];

const DEFAULTS = {
  PORT: '8080',
  JWT_EXPIRES: '31d',
  BLOB_READ_WRITE_TOKEN: '',
  CRON_SECRET: '',
  PUBLIC_BASE_URL: `http://localhost:${process.env.PORT || '8080'}`,
  FRONTEND_URL: 'http://localhost:5173',
  FRONTEND_BASE_PATH: '/share',
  DEFAULT_SHARE_TTL_MS: String(24 * 60 * 60 * 1000),
  MAX_SHARE_TTL_MS: String(30 * 24 * 60 * 60 * 1000),
  MAX_UPLOAD_BYTES: String(25 * 1024 * 1024),
  RATE_LIMIT_MAX: '50',
  RATE_LIMIT_WINDOW_MS: String(5 * 60 * 1000),
  CORS_ORIGINS: 'http://localhost:5173,https://vishalkumar1007.github.io',
};

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[env] Missing required env vars: ${missing.join(', ')}`);
  if (process.env.VERCEL === '1') {
    process.exit(1);
  }
}

const get = (key) => process.env[key] ?? DEFAULTS[key];

export const env = {
  PORT: get('PORT'),
  MONGO_URL: process.env.MONGO_URL,
  TOKEN_SECRET_KEY: process.env.TOKEN_SECRET_KEY,
  JWT_EXPIRES: get('JWT_EXPIRES'),
  BLOB_READ_WRITE_TOKEN: get('BLOB_READ_WRITE_TOKEN'),
  CRON_SECRET: get('CRON_SECRET'),
  PUBLIC_BASE_URL: get('PUBLIC_BASE_URL'),
  FRONTEND_URL: get('FRONTEND_URL').replace(/\/$/, ''),
  FRONTEND_BASE_PATH: (() => {
    const raw = get('FRONTEND_BASE_PATH').trim();
    if (!raw || raw === '/') return '';
    return raw.startsWith('/') ? raw.replace(/\/$/, '') : `/${raw.replace(/\/$/, '')}`;
  })(),
  DEFAULT_SHARE_TTL_MS: Number(get('DEFAULT_SHARE_TTL_MS')),
  MAX_SHARE_TTL_MS: Number(get('MAX_SHARE_TTL_MS')),
  MAX_UPLOAD_BYTES: Number(get('MAX_UPLOAD_BYTES')),
  RATE_LIMIT_MAX: Number(get('RATE_LIMIT_MAX')),
  RATE_LIMIT_WINDOW_MS: Number(get('RATE_LIMIT_WINDOW_MS')),
  CORS_ORIGINS: get('CORS_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean),
  isProd: process.env.VERCEL === '1' || process.env.NODE_ENV === 'production',
};

/** Absolute frontend path helper, e.g. /chat or /share/chat */
export const frontendPath = (path = '/') => {
  const clean = String(path || '/').startsWith('/') ? String(path) : `/${path}`;
  return `${env.FRONTEND_URL}${env.FRONTEND_BASE_PATH}${clean === '/' ? '' : clean}`;
};
