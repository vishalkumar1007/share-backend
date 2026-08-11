import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../config/env.js';
import { errorHandler, notFoundHandler } from './responses.js';

const BUILTIN_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://vishalkumar1007.github.io',
];

const allowedOrigins = new Set(
  [...BUILTIN_ORIGINS, ...env.CORS_ORIGINS, env.FRONTEND_URL].filter(Boolean)
);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  if (/\.instasafe\.io$/i.test(origin)) return true;
  if (/\.vercel\.app$/i.test(origin)) return true;
  if (/\.github\.io$/i.test(origin)) return true;
  return false;
};

export const corsOptions = {
  origin(origin, callback) {
    // Never throw here — cors errors become HTTP 500 on OPTIONS preflight.
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    console.warn(`[cors] blocked origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

export const applyBaseMiddleware = (app, options = {}) => {
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
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
