import express from 'express';
import {
  uploadToken,
  directUpload,
  localUpload,
  localUploadMiddleware,
} from '../controllers/uploadController.js';
import { validate, directUploadSchema } from '../lib/validate.js';
import { rateLimitMiddleware } from '../lib/rateLimit.js';

const uploadRouter = express.Router();

uploadRouter.post('/', rateLimitMiddleware(), uploadToken);
uploadRouter.post('/direct', rateLimitMiddleware({ max: 20 }), validate(directUploadSchema), directUpload);
uploadRouter.post(
  '/local',
  rateLimitMiddleware({ max: 30 }),
  localUploadMiddleware,
  localUpload
);

export default uploadRouter;
