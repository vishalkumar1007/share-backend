import chatRouter from '../../routers/chatRouter.js';
import { createDualMountedFunctionApp } from '../../lib/app.js';

export default createDualMountedFunctionApp('/api/chat', chatRouter);
