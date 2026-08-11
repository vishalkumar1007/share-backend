export const success = (res, data, status = 200) =>
  res.status(status).json({ responseStatus: 'success', ...data });

export const fail = (res, msg, status = 400, extra = {}) =>
  res.status(status).json({ responseStatus: 'failed', msg, ...extra });

export class AppError extends Error {
  constructor(msg, status = 500, code = 'internal_error', extra = {}) {
    super(msg);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = err?.status || err?.statusCode || 500;
  const code = err?.code || 'internal_error';
  const msg = err?.message || 'Internal server error';

  if (status >= 500) {
    console.error(`[error] ${req?.method} ${req?.originalUrl} -> ${msg}`, err);
  }

  return res.status(status).json({
    responseStatus: 'failed',
    msg,
    ...(err?.extra || {}),
    code,
  });
};

export const notFoundHandler = (req, res) =>
  res.status(404).json({ responseStatus: 'failed', msg: `Route not found: ${req.originalUrl}`, code: 'not_found' });
