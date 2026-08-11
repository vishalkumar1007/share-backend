process.env.RATE_LIMIT_MAX = '100000';
process.env.RATE_LIMIT_WINDOW_MS = '600000';
process.env.DEFAULT_SHARE_TTL_MS = String(24 * 60 * 60 * 1000);
process.env.MAX_SHARE_TTL_MS = String(30 * 24 * 60 * 60 * 1000);
process.env.NODE_ENV = 'test';
