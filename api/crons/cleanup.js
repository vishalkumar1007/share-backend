import express from 'express';
import { createDualMountedFunctionApp } from '../../lib/app.js';
import { runCleanup } from '../../lib/cleanup.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/responses.js';

const cleanupRouter = express.Router();

cleanupRouter.get('/', async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const secret = header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
      throw new AppError('Unauthorized', 401, 'unauthorized');
    }

    const result = await runCleanup();
    return res.json({ responseStatus: 'success', ...result });
  } catch (error) {
    return next(error);
  }
});

export default createDualMountedFunctionApp('/api/crons/cleanup', cleanupRouter);
