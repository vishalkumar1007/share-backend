import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import { env } from '../config/env.js';
import {
  hasBlobConfigured,
  serverPut,
  deleteBlob as deleteRemoteBlob,
  BLOB_PREFIX,
  isAllowedContentType,
} from './blob.js';
import { AppError } from './responses.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const EXT_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
};

const sanitizeFilename = (name) =>
  String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);

export const ensureLocalUploadDir = async () => {
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
};

export const inferMimeFromFilename = (filename, fallback = 'application/octet-stream') => {
  const ext = path.extname(String(filename || '')).toLowerCase();
  return EXT_MIME[ext] || fallback;
};

export const normalizeMime = (mimeType, filename) => {
  const raw = String(mimeType || '').trim().toLowerCase();
  if (raw && raw !== 'application/octet-stream') {
    return raw;
  }
  return inferMimeFromFilename(filename, raw || 'application/octet-stream');
};

export const putObject = async (filename, buffer, contentType) => {
  const mime = normalizeMime(contentType, filename);
  if (!isAllowedContentType(mime)) {
    throw new AppError('Content type not allowed', 415, 'content_type_not_allowed');
  }
  if (!buffer?.length) {
    throw new AppError('Empty file', 422, 'empty_file');
  }
  if (buffer.length > env.MAX_UPLOAD_BYTES) {
    throw new AppError('File too large', 413, 'file_too_large');
  }

  const safeName = sanitizeFilename(filename);
  const key = `${BLOB_PREFIX}${nanoid(12)}-${safeName}`;

  if (hasBlobConfigured()) {
    const blob = await serverPut(key, buffer, mime);
    return {
      url: blob.url,
      key: blob.pathname || key,
      mimeType: mime,
      size: buffer.length,
      filename: safeName,
      storage: 'blob',
    };
  }

  await ensureLocalUploadDir();
  const diskName = key.replace(/\//g, '_');
  const diskPath = path.join(LOCAL_UPLOAD_DIR, diskName);
  await fs.writeFile(diskPath, buffer);

  const base =
    env.PUBLIC_BASE_URL ||
    `http://localhost:${env.PORT}`;
  const url = `${base.replace(/\/$/, '')}/uploads/${encodeURIComponent(diskName)}`;

  return {
    url,
    key: diskName,
    mimeType: mime,
    size: buffer.length,
    filename: safeName,
    storage: 'local',
  };
};

export const deleteObject = async (url, key = '') => {
  if (!url && !key) return false;

  if (hasBlobConfigured() && url && !url.includes('/uploads/')) {
    return deleteRemoteBlob(url);
  }

  const diskName = key || (url ? decodeURIComponent(url.split('/uploads/').pop() || '') : '');
  if (!diskName) return false;

  try {
    await fs.unlink(path.join(LOCAL_UPLOAD_DIR, diskName));
    return true;
  } catch {
    return false;
  }
};

export const mimeMatchesShareType = (type, mimeType, filename = '') => {
  const mime = normalizeMime(mimeType, filename);
  if (type === 'image') return mime.startsWith('image/');
  if (type === 'audio') return mime.startsWith('audio/');
  if (type === 'file') return true;
  return false;
};
