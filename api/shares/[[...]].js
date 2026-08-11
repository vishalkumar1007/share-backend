import shareRouter from '../../routers/shareRouter.js';
import { createDualMountedFunctionApp } from '../../lib/app.js';

export default createDualMountedFunctionApp('/api/shares', shareRouter);
