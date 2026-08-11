import adminRouter from '../../routers/adminRouter.js';
import { createDualMountedFunctionApp } from '../../lib/app.js';

export default createDualMountedFunctionApp('/api/admin', adminRouter);
