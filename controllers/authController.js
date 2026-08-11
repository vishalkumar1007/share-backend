import bcrypt from 'bcryptjs';
import userModel from '../models/userModel.js';
import shareModel from '../models/shareModel.js';
import { signToken, verifyToken, extractToken } from '../lib/jwt.js';
import { AppError, success } from '../lib/responses.js';

const BCRYPT_ROUNDS = 10;

const isHashed = (password) => typeof password === 'string' && password.startsWith('$2');

const hashPassword = async (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

const publicUser = (user) => ({
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  avatar: user.avatar || '',
});

const signup = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.validated;

    const existing = await userModel.findOne({ email }).select({ _id: 1 }).lean();
    if (existing) {
      throw new AppError('User already exist', 409, 'user_exists');
    }

    const hashed = await hashPassword(password);
    const user = await userModel.create({ firstName, lastName, email, password: hashed });

    const token = signToken(publicUser(user));
    return success(res, { msg: 'new user registration successful', accessToken: token }, 201);
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.validated;

    const user = await userModel.findOne({ email });
    if (!user) {
      throw new AppError('User Not Found', 404, 'user_not_found');
    }

    let passwordOk = false;
    if (isHashed(user.password)) {
      passwordOk = await bcrypt.compare(password, user.password);
    } else if (user.password === password) {
      // Legacy plaintext password -> upgrade to a hash so old accounts keep working.
      passwordOk = true;
      user.password = await hashPassword(password);
      await user.save();
    }

    if (!passwordOk) {
      throw new AppError('password incorrect', 401, 'invalid_credentials');
    }

    const payload = publicUser(user);
    const token = signToken(payload);

    return success(res, { msg: 'User login successfully', accessToken: token, payloadData: payload });
  } catch (error) {
    return next(error);
  }
};

const verifyAuthToken = (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('auth token required', 401, 'auth_required');
    }
    const decoded = verifyToken(token);
    return success(res, { msg: 'token verification successful', decode: decoded });
  } catch (error) {
    return next(new AppError('Token verification failed', 401, 'token_invalid'));
  }
};

const getMe = async (req, res, next) => {
  try {
    const { email } = req.userData;
    const user = await userModel.findOne({ email });
    if (!user) {
      throw new AppError('User Not Found', 404, 'user_not_found');
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const [shares, totalShares] = await Promise.all([
      shareModel
        .find({ ownerId: user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select({ _id: 0, shareId: 1, type: 1, title: 1, privacy: 1, readCount: 1, expiresAt: 1, createdAt: 1 })
        .lean(),
      shareModel.countDocuments({ ownerId: user._id }),
    ]);

    return success(res, {
      msg: 'user profile data',
      data: {
        ...publicUser(user),
        activityHistory: user.activityHistory,
        shares,
        pagination: { page, limit, total: totalShares },
      },
    });
  } catch (error) {
    return next(error);
  }
};

export { signup, login, verifyAuthToken, getMe };
