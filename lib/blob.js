import { put, del, list } from '@vercel/blob';
import { env } from '../config/env.js';
import { AppError } from './responses.js';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/svg+xml',
  'application/pdf',
  'application/zip',
  'application/json',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/aac',
  'audio/x-m4a',
  'audio/flac',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/octet-stream',
];

export const BLOB_PREFIX = 'shares/';

export const hasBlobConfigured = () => Boolean(env.BLOB_READ_WRITE_TOKEN);

const tokenOption = () => ({ token: env.BLOB_READ_WRITE_TOKEN });

export const isAllowedContentType = (mimeType) => ALLOWED_MIME_TYPES.includes(mimeType);

export const serverPut = async (pathname, data, contentType) => {
  if (!hasBlobConfigured()) {
    throw new AppError('Blob storage is not configured', 503, 'blob_not_configured');
  }
  const blob = await put(pathname, data, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
    ...tokenOption(),
  });
  return blob;
};

export const deleteBlob = async (url) => {
  if (!url || !hasBlobConfigured()) {
    return false;
  }
  try {
    await del(url, tokenOption());
    return true;
  } catch (error) {
    console.error('[blob] delete failed:', error?.message);
    return false;
  }
};

/**
 * Scans the blob store and removes objects whose share row no longer exists
 * and which were uploaded more than `graceMs` ago (protects in-flight uploads).
 * Returns the number of blobs deleted.
 */
export const sweepOrphanBlobs = async (graceMs = 60 * 60 * 1000) => {
  if (!hasBlobConfigured()) {
    return 0;
  }

  let cursor;
  let deleted = 0;
  let scanned = 0;

  do {
    const result = await list({ prefix: BLOB_PREFIX, limit: 1000, cursor }, tokenOption());
    for (const blob of result.blobs || []) {
      scanned++;
      const stillReferenced = await isBlobReferenced(blob.pathname, blob.url);
      if (!stillReferenced) {
        const uploadedAt = new Date(blob.uploadedAt).getTime();
        if (Date.now() - uploadedAt > graceMs) {
          try {
            await del(blob.url, tokenOption());
            deleted++;
          } catch (error) {
            console.error('[blob] sweep delete failed:', error?.message);
          }
        }
      }
    }
    cursor = result.cursor;
  } while (cursor);

  return { scanned, deleted };
};

const isBlobReferenced = async (pathname, url) => {
  const ShareModel = (await import('../models/shareModel.js')).default;
  const found = await ShareModel.findOne({
    $or: [{ 'blob.key': pathname }, { 'blob.url': url }],
  }).select({ _id: 1 }).lean();
  return Boolean(found);
};
