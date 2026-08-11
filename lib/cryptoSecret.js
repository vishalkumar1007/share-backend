import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGO = 'aes-256-gcm';

const keyFromSecret = () => {
  const secret = String(env.TOKEN_SECRET_KEY || 'multiverse-fallback-secret');
  return crypto.createHash('sha256').update(secret).digest();
};

export const encryptSecret = (plain) => {
  const text = String(plain || '');
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, keyFromSecret(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
};

export const decryptSecret = (payload) => {
  const raw = String(payload || '');
  if (!raw) return '';
  const [ivHex, tagHex, dataHex] = raw.split(':');
  if (!ivHex || !tagHex || !dataHex) return '';
  const decipher = crypto.createDecipheriv(ALGO, keyFromSecret(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
};

export const maskSecret = (value) => {
  const v = String(value || '');
  if (!v) return '';
  if (v.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(12, v.length - 4))}${v.slice(-4)}`;
};
