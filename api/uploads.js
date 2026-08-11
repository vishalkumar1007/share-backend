import uploadRouter from '../routers/uploadRouter.js';
import { createDualMountedFunctionApp } from '../lib/app.js';

export default createDualMountedFunctionApp('/api/uploads', uploadRouter, { jsonLimit: '5mb' });
