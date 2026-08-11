import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signToken = (payload) =>
  jwt.sign(payload, env.TOKEN_SECRET_KEY, { expiresIn: env.JWT_EXPIRES });

export const signGuestToken = (payload) =>
  jwt.sign(
    { ...payload, kind: 'guest' },
    env.TOKEN_SECRET_KEY,
    { expiresIn: '24h' }
  );

export const verifyToken = (token) => jwt.verify(token, env.TOKEN_SECRET_KEY);

export const extractToken = (req) => {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.split(' ')[1];
};
