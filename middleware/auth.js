import userModel from '../models/userModel.js';
import { extractToken, verifyToken } from '../lib/jwt.js';
import { AppError } from '../lib/responses.js';

const resolveUser = async (req, token) => {
  const decoded = verifyToken(token);
  if (decoded?.kind === 'guest') {
    throw new AppError('Guest token not valid for this route', 401, 'guest_not_allowed');
  }
  const user = await userModel.findOne({ email: decoded.email }).select({
    _id: 1,
    email: 1,
    firstName: 1,
    lastName: 1,
    role: 1,
  }).lean();
  if (!user) {
    throw new AppError('User not found', 401, 'user_not_found');
  }
  req.userData = decoded;
  req.user = user;
  return user;
};

const resolveGuest = (req, token) => {
  const decoded = verifyToken(token);
  if (decoded?.kind !== 'guest' || !decoded.guestId) {
    throw new AppError('Invalid guest token', 401, 'guest_invalid');
  }
  req.guest = {
    guestId: String(decoded.guestId),
    displayName: String(decoded.displayName || 'Traveler'),
  };
  return req.guest;
};

export const requireAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('auth token required', 401, 'auth_required');
    }
    await resolveUser(req, token);
    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError('Token verification failed', 401, 'token_invalid'));
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('admin auth required', 401, 'auth_required');
    }
    const decoded = verifyToken(token);
    if (decoded?.kind === 'guest') {
      throw new AppError('Admin access required', 403, 'admin_required');
    }
    const user = await resolveUser(req, token);
    if (user.role !== 'admin' && decoded?.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'admin_required');
    }
    req.admin = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: 'admin',
    };
    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError('Token verification failed', 401, 'token_invalid'));
  }
};

/** Accepts logged-in user JWT or guest chat JWT. */
export const requireChatIdentity = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('chat session required', 401, 'auth_required');
    }
    const decoded = verifyToken(token);
    if (decoded?.kind === 'guest') {
      resolveGuest(req, token);
      return next();
    }
    await resolveUser(req, token);
    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    return next(new AppError('Token verification failed', 401, 'token_invalid'));
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = verifyToken(token);
      if (decoded?.kind === 'guest') {
        resolveGuest(req, token);
      } else {
        await resolveUser(req, token);
      }
    }
  } catch {
    // ignore invalid tokens on optional routes
  }
  return next();
};
