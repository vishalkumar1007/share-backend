import express from 'express';
import {
  adminLogin,
  getMailSettings,
  updateMailSettings,
  testMailSettings,
} from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../lib/rateLimit.js';

const adminRouter = express.Router();

adminRouter.post('/login', rateLimitMiddleware({ max: 15 }), adminLogin);
adminRouter.get('/mail-settings', requireAdmin, getMailSettings);
adminRouter.put('/mail-settings', requireAdmin, updateMailSettings);
adminRouter.post(
  '/mail-settings/test',
  requireAdmin,
  rateLimitMiddleware({ max: 10 }),
  testMailSettings
);

export default adminRouter;
