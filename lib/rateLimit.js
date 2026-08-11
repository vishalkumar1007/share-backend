import RateLimitModel from '../models/rateLimitModel.js';
import { env } from '../config/env.js';

export const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || req.ip;
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1';
  }
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  return ip || 'unknown';
};

const checkAndIncrement = async (key, now, windowMs) => {
  try {
    return await RateLimitModel.findOneAndUpdate(
      { key, windowStart: { $gt: now - windowMs } },
      {
        $inc: { count: 1 },
        $setOnInsert: {
          key,
          windowStart: now,
          expireAt: new Date(now + windowMs),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    // Unique-key collision means a stale doc exists with the same key but an
    // expired window. Reset it atomically instead of failing the request.
    if (error?.code === 11000) {
      return await RateLimitModel.findOneAndUpdate(
        { key },
        { $set: { count: 1, windowStart: now, expireAt: new Date(now + windowMs) } },
        { new: true }
      );
    }
    throw error;
  }
};

export const rateLimitMiddleware = (options = {}) => {
  const max = options.max ?? env.RATE_LIMIT_MAX;
  const windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW_MS;

  return async (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    try {
      const now = Date.now();
      const ip = getClientIp(req);
      const routeScope = req.route?.path || req.path;
      // Include method so GET poll and POST send do not share one bucket.
      const key = `${ip}:${req.method}:${routeScope}`;

      const result = await checkAndIncrement(key, now, windowMs);

      if (result && result.count > max) {
        return res.status(429).json({
          responseStatus: 'failed',
          msg: 'Too many requests, please try again later',
          code: 'rate_limited',
        });
      }
      return next();
    } catch (error) {
      // Never block traffic because the limiter itself failed.
      console.error('[rateLimit] error:', error?.message);
      return next();
    }
  };
};
