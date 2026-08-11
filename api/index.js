import express from 'express';
import connectDb from '../lib/db.js';
import { createDualMountedFunctionApp } from '../lib/app.js';

const healthRouter = express.Router();

healthRouter.get('/', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await connectDb();
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'disconnected';
  }

  return res.json({
    note: 'welcome to vishal server',
    serverStatus: 'Server is live',
    apiRoutes: '/api',
    status: 'running',
    db: dbStatus,
    version: '2.0',
    time: new Date().toISOString(),
  });
});

export default createDualMountedFunctionApp('/api', healthRouter);
