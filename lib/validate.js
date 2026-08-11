import { z } from 'zod';
import { AppError } from './responses.js';

const emailSchema = z.string().trim().toLowerCase().email().max(200);
const passwordSchema = z.string().min(6).max(100);

export const signupSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(100),
});

export const SHARE_TYPES = ['text', 'image', 'file', 'audio'];

const blobSchema = z.object({
  url: z.string().url().max(1000),
  key: z.string().max(1000).optional().default(''),
  mimeType: z.string().max(200),
  size: z.number().int().nonnegative(),
  filename: z.string().max(255),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().nonnegative().optional(),
});

export const createShareSchema = z
  .object({
    type: z.enum(SHARE_TYPES),
    title: z.string().trim().max(200).optional().default(''),
    text: z.string().max(100000).optional(),
    blob: blobSchema.optional(),
    privacy: z.enum(['public', 'incognito']).optional().default('public'),
    expiresInMs: z.number().int().positive().optional(),
  })
  .refine(
    (data) => (data.type === 'text' ? Boolean(data.text?.trim()) : Boolean(data.blob?.url)),
    { message: 'text is required for text shares; a blob is required for media shares' }
  );

export const directUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().max(200),
  data: z.string().min(1).max(8_000_000),
});

export const validate = (schema) => (req, res, next) => {
  try {
    req.validated = schema.parse(req.body);
    next();
  } catch (error) {
    const message = error?.issues?.[0]?.message || 'validation failed';
    next(new AppError(message, 422, 'validation_error'));
  }
};
