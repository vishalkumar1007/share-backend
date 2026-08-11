import { handleUpload } from '@vercel/blob/client';
import multer from 'multer';
import {
  ALLOWED_MIME_TYPES,
  hasBlobConfigured,
  isAllowedContentType,
} from '../lib/blob.js';
import { putObject, normalizeMime } from '../lib/storage.js';
import { env } from '../config/env.js';
import { AppError, success } from '../lib/responses.js';

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES },
});

export const localUploadMiddleware = memoryUpload.single('file');

const uploadToken = async (req, res, next) => {
  try {
    if (!hasBlobConfigured()) {
      throw new AppError(
        'Blob storage is not configured — use /api/uploads/local or /direct',
        503,
        'blob_not_configured'
      );
    }

    const response = await handleUpload({
      body: req.body,
      request: {
        headers: {
          get: (name) => req.headers[name.toLowerCase()] ?? req.headers[name] ?? null,
        },
      },
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_MIME_TYPES,
        maximumSizeInBytes: env.MAX_UPLOAD_BYTES,
        validUntil: Date.now() + 10 * 60 * 1000,
        tokenPayload: JSON.stringify({ createdAt: Date.now() }),
      }),
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(response);
  } catch (error) {
    console.error('[upload] token failed:', error?.message);
    return next(
      new AppError(
        error?.message || 'upload token generation failed',
        error?.statusCode || 400,
        error?.code || 'upload_token_failed'
      )
    );
  }
};

const directUpload = async (req, res, next) => {
  try {
    const { filename, contentType, data } = req.validated;
    const mime = normalizeMime(contentType, filename);

    if (!isAllowedContentType(mime)) {
      throw new AppError('Content type not allowed', 415, 'content_type_not_allowed');
    }

    const buffer = Buffer.from(data, 'base64');
    const blob = await putObject(filename, buffer, mime);

    return success(res, {
      msg: 'file uploaded',
      blob,
    });
  } catch (error) {
    return next(error);
  }
};

const localUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('file is required', 422, 'file_required');
    }

    const contentType = normalizeMime(req.file.mimetype, req.file.originalname);
    if (!isAllowedContentType(contentType)) {
      throw new AppError('Content type not allowed', 415, 'content_type_not_allowed');
    }

    const blob = await putObject(req.file.originalname, req.file.buffer, contentType);
    return success(res, {
      msg: 'file uploaded',
      blob,
    });
  } catch (error) {
    return next(error);
  }
};

export { uploadToken, directUpload, localUpload };
