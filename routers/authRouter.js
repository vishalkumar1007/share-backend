import express from 'express';
import { signup, login, verifyAuthToken, getMe } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, signupSchema, loginSchema } from '../lib/validate.js';
import { rateLimitMiddleware } from '../lib/rateLimit.js';

const authRouter = express.Router();

authRouter.post('/signup', rateLimitMiddleware({ max: 10 }), validate(signupSchema), signup);
authRouter.post('/login', rateLimitMiddleware({ max: 10 }), validate(loginSchema), login);
authRouter.get('/verify', verifyAuthToken);
authRouter.get('/me', requireAuth, getMe);

export default authRouter;
