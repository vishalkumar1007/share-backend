import express from 'express';
import {
  createGuestSession,
  createRoom,
  getRoom,
  endRoomHttp,
  inviteToRoom,
  joinRoomHttp,
  listMessagesHttp,
  postMessageHttp,
  leaveRoomHttp,
} from '../controllers/chatController.js';
import { optionalAuth, requireChatIdentity } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../lib/rateLimit.js';

const chatRouter = express.Router();

chatRouter.post(
  '/session',
  optionalAuth,
  rateLimitMiddleware({ max: 30 }),
  createGuestSession
);
chatRouter.post(
  '/rooms',
  requireChatIdentity,
  rateLimitMiddleware({ max: 20 }),
  createRoom
);
chatRouter.get('/rooms/:code', rateLimitMiddleware({ max: 60 }), getRoom);
chatRouter.post(
  '/rooms/:code/join',
  requireChatIdentity,
  rateLimitMiddleware({ max: 40 }),
  joinRoomHttp
);
chatRouter.get(
  '/rooms/:code/messages',
  requireChatIdentity,
  // Poll-friendly: ~1 req / 3s ≈ 100 / 5min; keep headroom for multi-tab.
  rateLimitMiddleware({ max: 250, windowMs: 5 * 60 * 1000 }),
  listMessagesHttp
);
chatRouter.post(
  '/rooms/:code/messages',
  requireChatIdentity,
  rateLimitMiddleware({ max: 90, windowMs: 5 * 60 * 1000 }),
  postMessageHttp
);
chatRouter.post(
  '/rooms/:code/leave',
  requireChatIdentity,
  rateLimitMiddleware({ max: 40 }),
  leaveRoomHttp
);
chatRouter.delete(
  '/rooms/:code',
  requireChatIdentity,
  rateLimitMiddleware({ max: 20 }),
  endRoomHttp
);
chatRouter.post(
  '/invite',
  requireChatIdentity,
  rateLimitMiddleware({ max: 10 }),
  inviteToRoom
);

export default chatRouter;
