import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../config/env.js';
import { errorHandler, notFoundHandler } from './responses.js';

const allowedOrigins = env.CORS_ORIGINS;

export const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed =
      allowedOrigins.includes(origin) ||
      /\.instasafe\.io$/.test(origin) ||
      /\.vercel\.app$/.test(origin);
    if (isAllowed) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

export const applyBaseMiddleware = (app, options = {}) => {
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors(corsOptions));
  app.use(express.json({ limit: options.jsonLimit || '1mb' }));
  return app;
};

/**
 * Builds the exported app for a Vercel function.
 *
 * The router is mounted at BOTH `prefix` and `/`. Vercel forwards the request
 * to a function with either the full original path or the path relative to the
 * function's mapped route, depending on internal routing. Dual mounting keeps
 * the handler correct regardless of which behavior applies.
 */
export const createDualMountedFunctionApp = (prefix, router, options = {}) => {
  const app = applyBaseMiddleware(express(), options);
  app.use(prefix, router);
  app.use(router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
