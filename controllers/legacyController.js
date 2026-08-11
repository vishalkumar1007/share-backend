import userModel from '../models/userModel.js';
import shareModel from '../models/shareModel.js';
import { env } from '../config/env.js';
import { withUniqueCode, generateNumericCode } from '../lib/codes.js';
import { extractToken, verifyToken } from '../lib/jwt.js';
import { AppError } from '../lib/responses.js';
import { signup, login } from './authController.js';
import { signupSchema, loginSchema } from '../lib/validate.js';

const HISTORY_CAP = 50;

const legacySignup = async (req, res, next) => {
  try {
    req.validated = signupSchema.parse(req.body);
    return signup(req, res, next);
  } catch (error) {
    return next(error);
  }
};

const legacyLogin = async (req, res, next) => {
  try {
    const body = { email: req.query.email, password: req.query.password };
    req.body = body;
    req.validated = loginSchema.parse(body);
    return login(req, res, next);
  } catch (error) {
    return next(error);
  }
};

const legacyVerifyAuthToken = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('auth token required', 401, 'auth_required');
    }
    const decoded = verifyToken(token);
    return res.status(200).json({
      msg: 'token verification successful',
      responseStatus: 'success',
      decode: decoded,
    });
  } catch (error) {
    return next(new AppError('Token verification failed', 401, 'token_invalid'));
  }
};

const legacyGetUserProfileData = async (req, res, next) => {
  try {
    const { email } = req.userData;
    const user = await userModel.findOne({ email });
    if (!user) {
      throw new AppError('User Not Found', 404, 'user_not_found');
    }
    return res.status(200).json({
      msg: 'user filtered profile data',
      responseStatus: 'success',
      data: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userData: user.activityHistory,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const legacyUniversalTextSave = async (req, res, next) => {
  try {
    const { textData } = req.body || {};
    if (!textData || typeof textData !== 'string') {
      return res.status(401).json({ msg: 'text data required', responseStatus: 'failed' });
    }

    let tokenVerification = 'unavailable';
    let textShareHistorySaveStatus = 'unavailable';
    let owner = null;

    const token = extractToken(req);
    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = await userModel.findOne({ email: decoded.email }).select({ _id: 1 }).lean();
        if (user) {
          owner = user;
          tokenVerification = 'success';
        } else {
          tokenVerification = 'failed';
        }
      } catch (error) {
        tokenVerification = 'failed';
        textShareHistorySaveStatus = 'failed';
      }
    }

    const share = await withUniqueCode(generateNumericCode, (shareId) =>
      shareModel.create({
        shareId,
        type: 'text',
        content: textData,
        privacy: 'public',
        expiresAt: new Date(Date.now() + env.DEFAULT_SHARE_TTL_MS),
        ownerId: owner?._id || null,
      })
    );

    if (owner) {
      const saveResult = await userModel.updateOne(
        { _id: owner._id },
        {
          $push: {
            'activityHistory.textMultiverseData': {
              $each: [
                {
                  codeMappedText: textData,
                  multiverseCode: share.shareId,
                  shareId: share.shareId,
                  createdAt: new Date(),
                },
              ],
              $slice: -HISTORY_CAP,
            },
          },
        }
      );
      textShareHistorySaveStatus = saveResult.modifiedCount > 0 ? 'success' : 'failed';
    }

    return res.status(200).json({
      code: share.shareId,
      yourTextData: textData,
      responseStatus: 'success',
      tokenVerification,
      textShareHistorySaveStatus,
    });
  } catch (error) {
    return next(error);
  }
};

const legacyUniversalTextData = async (req, res, next) => {
  try {
    const { multiverseCode } = req.query;
    if (!multiverseCode) {
      return res.status(401).json({ msg: 'multiverse code require', responseStatus: 'failed' });
    }
    if (String(multiverseCode).length !== 6) {
      return res.status(401).json({ msg: 'Invalid multiverse code', responseStatus: 'failed' });
    }

    const share = await shareModel.findOne({ shareId: String(multiverseCode), type: 'text' }).lean();
    if (!share) {
      return res.status(404).json({ msg: `Invalid multiverse Code ${multiverseCode}`, responseStatus: 'failed' });
    }

    return res.status(200).json({ code: multiverseCode, responseStatus: 'success', codeMappedText: share.content });
  } catch (error) {
    return next(error);
  }
};

export {
  legacySignup,
  legacyLogin,
  legacyVerifyAuthToken,
  legacyGetUserProfileData,
  legacyUniversalTextSave,
  legacyUniversalTextData,
};
