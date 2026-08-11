import shareModel from '../models/shareModel.js';
import userModel from '../models/userModel.js';
import { env } from '../config/env.js';
import { withUniqueCode, generateShareId } from '../lib/codes.js';
import { deleteObject, mimeMatchesShareType } from '../lib/storage.js';
import { AppError, success } from '../lib/responses.js';

const HISTORY_CAP = 50;

const BOT_UA_PATTERN =
  /bot|crawler|spider|slurp|baiduspider|yandex|facebookexternalhit|twitterbot|whatsapp|telegrambot|discordbot|pinterest|linkedinbot|bingbot|googlebot/i;

const buildShareUrl = (req, shareId) => {
  if (env.PUBLIC_BASE_URL) {
    return `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/s/${shareId}`;
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}/s/${shareId}`;
};

const computeExpiresAt = (expiresInMs) => {
  const ttl = Math.min(expiresInMs || env.DEFAULT_SHARE_TTL_MS, env.MAX_SHARE_TTL_MS);
  return new Date(Date.now() + ttl);
};

const historyEntryFor = (type, share) => {
  const common = { shareId: share.shareId, createdAt: new Date() };
  switch (type) {
    case 'text':
      return { codeMappedText: share.content, multiverseCode: share.shareId, ...common };
    case 'image':
      return { imageData: share.blob.url, imageMultiverseCode: share.shareId, ...common };
    case 'file':
      return { fileData: share.blob.url, fileMultiverseCode: share.shareId, ...common };
    case 'audio':
      return { audioData: share.blob.url, audioMultiverseCode: share.shareId, ...common };
    default:
      return { shareId: share.shareId, ...common };
  }
};

const historyFieldFor = (type) => {
  switch (type) {
    case 'text':
      return 'textMultiverseData';
    case 'image':
      return 'imageMultiverseData';
    case 'file':
      return 'fileMultiverseData';
    case 'audio':
      return 'audioMultiverseData';
    default:
      return null;
  }
};

const serializeShare = (share, consumed = false) => {
  const data = {
    shareId: share.shareId,
    type: share.type,
    title: share.title || '',
    privacy: share.privacy,
    readCount: consumed ? 1 : share.readCount,
    lastReadAt: share.lastReadAt,
    expiresAt: share.expiresAt,
    createdAt: share.createdAt,
  };

  if (share.type === 'text') {
    data.content = share.content;
  }

  if (share.blob) {
    data.blob = {
      url: share.blob.url,
      mimeType: share.blob.mimeType,
      size: share.blob.size,
      filename: share.blob.filename,
      width: share.blob.width,
      height: share.blob.height,
      duration: share.blob.duration,
    };
  }

  return data;
};

const createShare = async (req, res, next) => {
  try {
    const { type, title, text, blob, privacy, expiresInMs } = req.validated;

    if (type !== 'text') {
      if (!blob?.url || !blob?.mimeType) {
        throw new AppError('blob is required for media shares', 422, 'blob_required');
      }
      if (!mimeMatchesShareType(type, blob.mimeType, blob.filename || '')) {
        throw new AppError(
          `MIME type ${blob.mimeType} does not match share type ${type}`,
          422,
          'mime_type_mismatch'
        );
      }
    }

    let owner = null;
    if (req.userData?.email) {
      owner = await userModel.findOne({ email: req.userData.email }).select({ _id: 1 }).lean();
    }

    const payload = {
      type,
      title: title || '',
      privacy,
      expiresAt: computeExpiresAt(expiresInMs),
      content: type === 'text' ? text : null,
      blob: type === 'text' ? null : blob || null,
      ownerId: owner?._id || null,
    };

    const share = await withUniqueCode(generateShareId, (shareId) =>
      shareModel.create({ shareId, ...payload })
    );

    if (owner) {
      const field = historyFieldFor(type);
      if (field) {
        await userModel.updateOne(
          { _id: owner._id },
          { $push: { [`activityHistory.${field}`]: { $each: [historyEntryFor(type, share)], $slice: -HISTORY_CAP } } }
        );
      }
    }

    return success(res, {
      msg: 'share created',
      shareId: share.shareId,
      url: buildShareUrl(req, share.shareId),
      privacy: share.privacy,
      expiresAt: share.expiresAt,
    }, 201);
  } catch (error) {
    return next(error);
  }
};

const getShare = async (req, res, next) => {
  try {
    const { shareId } = req.params;
    if (!shareId || !/^[A-Za-z0-9]{4,16}$/.test(shareId)) {
      throw new AppError('Invalid share code', 400, 'invalid_code');
    }

    const existing = await shareModel.findOne({ shareId })
      .select({ shareId: 1, type: 1, title: 1, content: 1, blob: 1, privacy: 1, readCount: 1, lastReadAt: 1, consumedAt: 1, expiresAt: 1, createdAt: 1 })
      .lean();

    if (!existing) {
      throw new AppError('Share not found', 404, 'share_not_found');
    }

    if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) {
      await shareModel.deleteOne({ shareId });
      if (existing.blob?.url) {
        await deleteObject(existing.blob.url, existing.blob.key);
      }
      throw new AppError('Share expired', 410, 'share_expired');
    }

    if (existing.privacy === 'incognito') {
      if (existing.consumedAt) {
        throw new AppError('Share already consumed', 410, 'share_consumed');
      }

      const isBot = BOT_UA_PATTERN.test(req.headers['user-agent'] || '');
      if (isBot) {
        throw new AppError('Forbidden', 403, 'forbidden');
      }

      // Atomic claim: only one recipient ever gets the data. The payload is
      // stripped immediately, but the row is kept as a tombstone (until TTL)
      // so repeat access returns 410 Gone instead of 404.
      const claimed = await shareModel.findOneAndUpdate(
        { shareId, consumedAt: null },
        { $set: { consumedAt: new Date(), readCount: 1, lastReadAt: new Date(), content: null, blob: null } },
        { new: true }
      ).lean();

      if (!claimed) {
        throw new AppError('Share already consumed', 410, 'share_consumed');
      }

      if (existing.blob?.url) {
        await deleteObject(existing.blob.url, existing.blob.key);
      }

      return success(res, { msg: 'share fetched', data: serializeShare(existing, true) });
    }

    const share = await shareModel.findOneAndUpdate(
      { shareId },
      { $inc: { readCount: 1 }, $set: { lastReadAt: new Date() } },
      { new: true }
    ).lean();

    return success(res, { msg: 'share fetched', data: serializeShare(share, false) });
  } catch (error) {
    return next(error);
  }
};

const deleteShare = async (req, res, next) => {
  try {
    const { shareId } = req.params;
    if (!req.user?._id) {
      throw new AppError('auth required', 401, 'auth_required');
    }

    const share = await shareModel.findOne({ shareId });
    if (!share) {
      throw new AppError('Share not found', 404, 'share_not_found');
    }

    if (String(share.ownerId) !== String(req.user._id)) {
      throw new AppError('Not authorized to delete this share', 403, 'forbidden');
    }

    await shareModel.deleteOne({ shareId });
    if (share.blob?.url) {
      await deleteObject(share.blob.url, share.blob.key);
    }

    return success(res, { msg: 'share deleted', shareId });
  } catch (error) {
    return next(error);
  }
};

const listMyShares = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const [shares, total] = await Promise.all([
      shareModel
        .find({ ownerId: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select({ _id: 0, shareId: 1, type: 1, title: 1, privacy: 1, readCount: 1, lastReadAt: 1, expiresAt: 1, createdAt: 1 })
        .lean(),
      shareModel.countDocuments({ ownerId: req.user._id }),
    ]);

    return success(res, { shares, pagination: { page, limit, total } });
  } catch (error) {
    return next(error);
  }
};

const getShareStatus = async (req, res, next) => {
  try {
    const { shareId } = req.params;
    if (!shareId || !/^[A-Za-z0-9]{4,16}$/.test(shareId)) {
      throw new AppError('Invalid share code', 400, 'invalid_code');
    }

    const share = await shareModel.findOne({ shareId })
      .select({ _id: 0, shareId: 1, type: 1, privacy: 1, readCount: 1, lastReadAt: 1, consumedAt: 1, expiresAt: 1, ownerId: 1 })
      .lean();

    if (!share) {
      return success(res, { data: { exists: false } });
    }

    const expired = Boolean(share.expiresAt && new Date(share.expiresAt) < new Date());

    return success(res, {
      data: {
        exists: true,
        expired,
        consumed: Boolean(share.consumedAt),
        shareId: share.shareId,
        type: share.type,
        privacy: share.privacy,
        readCount: share.readCount,
        lastReadAt: share.lastReadAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export { createShare, getShare, deleteShare, listMyShares, getShareStatus, buildShareUrl };
