import express from 'express';
import {
  legacySignup,
  legacyLogin,
  legacyVerifyAuthToken,
  legacyGetUserProfileData,
  legacyUniversalTextSave,
  legacyUniversalTextData,
} from '../controllers/legacyController.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../lib/rateLimit.js';

const legacyUserRouter = express.Router();
legacyUserRouter.post('/signup', rateLimitMiddleware({ max: 10 }), legacySignup);
legacyUserRouter.get('/login', rateLimitMiddleware({ max: 10 }), legacyLogin);
legacyUserRouter.get('/verifyUserAuthToken', legacyVerifyAuthToken);
legacyUserRouter.get('/getUserProfileData', requireAuth, legacyGetUserProfileData);

const legacyTextRouter = express.Router();
legacyTextRouter.post('/universalTextSave', rateLimitMiddleware(), legacyUniversalTextSave);
legacyTextRouter.get('/universalTextData', legacyUniversalTextData);

export { legacyUserRouter, legacyTextRouter };
