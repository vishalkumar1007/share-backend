import shareModel from '../models/shareModel.js';
import RateLimitModel from '../models/rateLimitModel.js';
import { sweepOrphanBlobs } from './blob.js';

export const runCleanup = async () => {
  const now = new Date();

  const expiredShares = await shareModel.deleteMany({ expiresAt: { $lt: now } });
  const cleanedRateLimits = await RateLimitModel.deleteMany({
    $or: [{ expireAt: { $lt: now } }, { windowStart: { $lt: now.getTime() - 60 * 60 * 1000 } }],
  });
  const blobResult = await sweepOrphanBlobs();

  return {
    expiredShares: expiredShares.deletedCount,
    cleanedRateLimits: cleanedRateLimits.deletedCount,
    ...blobResult,
    ranAt: new Date().toISOString(),
  };
};
