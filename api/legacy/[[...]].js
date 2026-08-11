import express from 'express';
import { legacyUserRouter, legacyTextRouter } from '../../routers/legacyRouter.js';
import { createDualMountedFunctionApp } from '../../lib/app.js';

const legacyRouter = express.Router();
legacyRouter.use('/user', legacyUserRouter);
legacyRouter.use('/TextMultiverse', legacyTextRouter);

export default createDualMountedFunctionApp('/api/legacy', legacyRouter);
