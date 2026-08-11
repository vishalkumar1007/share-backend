import authRouter from '../../routers/authRouter.js';
import { createDualMountedFunctionApp } from '../../lib/app.js';

export default createDualMountedFunctionApp('/api/auth', authRouter);
