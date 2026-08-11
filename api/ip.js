import ipRouter from '../routers/ipRouter.js';
import { createDualMountedFunctionApp } from '../lib/app.js';

export default createDualMountedFunctionApp('/api/ip', ipRouter);
