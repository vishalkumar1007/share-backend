import express from 'express';
import {
  createShare,
  getShare,
  deleteShare,
  listMyShares,
  getShareStatus,
} from '../controllers/shareController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate, createShareSchema } from '../lib/validate.js';
import { rateLimitMiddleware } from '../lib/rateLimit.js';

const shareRouter = express.Router();

shareRouter.post('/', rateLimitMiddleware(), optionalAuth, validate(createShareSchema), createShare);
shareRouter.get('/me', requireAuth, listMyShares);
shareRouter.get('/:shareId/status', getShareStatus);
shareRouter.get('/:shareId', getShare);
shareRouter.delete('/:shareId', requireAuth, deleteShare);

export default shareRouter;
