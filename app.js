import express from 'express';
import path from 'path';
import fs from 'fs';
import { applyBaseMiddleware } from './lib/app.js';
import { errorHandler, notFoundHandler } from './lib/responses.js';
import authRouter from './routers/authRouter.js';
import shareRouter from './routers/shareRouter.js';
import uploadRouter from './routers/uploadRouter.js';
import ipRouter from './routers/ipRouter.js';
import chatRouter from './routers/chatRouter.js';
import adminRouter from './routers/adminRouter.js';
import { legacyUserRouter, legacyTextRouter } from './routers/legacyRouter.js';
import { LOCAL_UPLOAD_DIR, inferMimeFromFilename } from './lib/storage.js';
import { env } from './config/env.js';

const serveUpload = (req, res, next) => {
  try {
    const name = path.basename(decodeURIComponent(req.params.name || ''));
    if (!name || name.includes('..')) {
      return res.status(400).json({ responseStatus: 'failed', msg: 'invalid file' });
    }
    const filePath = path.join(LOCAL_UPLOAD_DIR, name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ responseStatus: 'failed', msg: 'file not found' });
    }

    const mime = inferMimeFromFilename(name);
    const wantDownload = String(req.query.download || '') === '1';
    const origin = req.headers.origin;
    if (origin && (env.CORS_ORIGINS.includes(origin) || /\.instasafe\.io$/.test(origin) || /\.vercel\.app$/.test(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (!origin) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else {
      // Allow browser fetch/download from any frontend origin for public media
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    const displayName = name.includes('-') ? name.slice(name.indexOf('-') + 1) : name;
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `${wantDownload ? 'attachment' : 'inline'}; filename="${displayName}"`
    );
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    return next(error);
  }
};

export const buildApp = () => {
  const app = express();
  applyBaseMiddleware(app, { jsonLimit: '12mb' });

  app.get('/', (req, res) => {
    res.json({
      note: 'welcome to vishal server',
      serverStatus: 'Server is live',
      apiRoutes: '/api',
      status: 'running',
      version: '2.0',
    });
  });

  app.get('/api', (req, res) => {
    res.json({
      note: 'welcome to vishal server',
      serverStatus: 'Server is live',
      apiRoutes: '/api',
      status: 'running',
      version: '2.0',
    });
  });

  app.options('/uploads/:name', (req, res) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.sendStatus(204);
  });
  app.get('/uploads/:name', serveUpload);

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/shares', shareRouter);
  app.use('/api/uploads', uploadRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/ip', ipRouter);
  app.use('/api/user', legacyUserRouter);
  app.use('/api/TextMultiverse', legacyTextRouter);

  app.get('/s/:shareId', (req, res) => {
    res.redirect(`/api/shares/${req.params.shareId}`);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
