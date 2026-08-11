import { nanoid } from 'nanoid';
import chatRoomModel from '../models/chatRoomModel.js';
import chatMessageModel from '../models/chatMessageModel.js';
import { withUniqueCode, generateRoomCode } from '../lib/codes.js';
import { signGuestToken } from '../lib/jwt.js';
import { sendMail } from '../lib/mailer.js';
import { env, frontendPath } from '../config/env.js';
import { AppError, success } from '../lib/responses.js';

const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MEMBERS = 10;

const sanitizeDisplayName = (raw, fallback = 'Traveler') => {
  const cleaned = String(raw || '')
    .replace(/[^\p{L}\p{N}\s._-]/gu, '')
    .trim()
    .slice(0, 28);
  return cleaned || fallback;
};

const displayNameFor = (user) =>
  sanitizeDisplayName(
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email,
    'Traveler'
  );

const guestFallbackName = () => `Traveler-${nanoid(4).toUpperCase()}`;

const resolveHttpParticipant = (req) => {
  if (req.user?._id) {
    return {
      id: String(req.user._id),
      kind: 'user',
      displayName: displayNameFor(req.user),
    };
  }
  if (req.guest?.guestId) {
    return {
      id: req.guest.guestId,
      kind: 'guest',
      displayName: sanitizeDisplayName(req.guest.displayName, guestFallbackName()),
    };
  }
  return null;
};

const createGuestSession = async (req, res, next) => {
  try {
    if (req.user?._id) {
      return success(res, {
        msg: 'authenticated session',
        kind: 'user',
        participantId: String(req.user._id),
        displayName: displayNameFor(req.user),
        token: null,
      });
    }

    const displayName = sanitizeDisplayName(req.body?.displayName, guestFallbackName());
    const guestId = `guest_${nanoid(16)}`;
    const token = signGuestToken({ guestId, displayName });

    return success(res, {
      msg: 'guest session created',
      kind: 'guest',
      participantId: guestId,
      displayName,
      token,
      expiresIn: '24h',
    });
  } catch (error) {
    return next(error);
  }
};

const createRoom = async (req, res, next) => {
  try {
    const participant = resolveHttpParticipant(req);
    if (!participant) {
      throw new AppError('chat session required', 401, 'auth_required');
    }

    const title = String(req.body?.title || '').trim().slice(0, 80);
    const mode = req.body?.mode === 'saved' ? 'saved' : 'incognito';
    if (mode === 'saved' && participant.kind !== 'user') {
      throw new AppError('Login required to save chat history', 401, 'login_required_for_saved');
    }

    const room = await withUniqueCode(generateRoomCode, (roomCode) =>
      chatRoomModel.create({
        roomCode,
        title,
        mode,
        createdBy: participant.id,
        createdByKind: participant.kind,
        members: [
          {
            userId: participant.id,
            kind: participant.kind,
            displayName: participant.displayName,
            joinedAt: new Date(),
          },
        ],
        expiresAt: new Date(Date.now() + ROOM_TTL_MS),
      })
    );

    return success(
      res,
      {
        msg: 'chat room created',
        roomCode: room.roomCode,
        title: room.title,
        mode: room.mode,
        expiresAt: room.expiresAt,
        members: room.members,
        maxMembers: MAX_MEMBERS,
      },
      201
    );
  } catch (error) {
    return next(error);
  }
};

const getRoom = async (req, res, next) => {
  try {
    const { code } = req.params;
    const room = await chatRoomModel.findOne({ roomCode: String(code || '').toUpperCase() }).lean();
    if (!room) {
      throw new AppError('Chat room not found', 404, 'room_not_found');
    }
    if (room.expiresAt && new Date(room.expiresAt) < new Date()) {
      throw new AppError('Chat room expired', 410, 'room_expired');
    }

    return success(res, {
      roomCode: room.roomCode,
      title: room.title || '',
      mode: room.mode || 'incognito',
      expiresAt: room.expiresAt,
      memberCount: room.members.length,
      full: room.members.length >= MAX_MEMBERS,
      seatsLeft: Math.max(0, MAX_MEMBERS - room.members.length),
      maxMembers: MAX_MEMBERS,
    });
  } catch (error) {
    return next(error);
  }
};

const wipeRoom = async (roomCode) => {
  await chatMessageModel.deleteMany({ roomCode });
  await chatRoomModel.deleteOne({ roomCode });
};

const endRoomHttp = async (req, res, next) => {
  try {
    const participant = resolveHttpParticipant(req);
    if (!participant) {
      throw new AppError('chat session required', 401, 'auth_required');
    }
    const roomCode = String(req.params.code || '').toUpperCase();
    const room = await chatRoomModel.findOne({ roomCode });
    if (!room) {
      throw new AppError('Chat room not found', 404, 'room_not_found');
    }
    if (String(room.createdBy) !== String(participant.id)) {
      throw new AppError('Only the creator can end this room', 403, 'not_creator');
    }
    await wipeRoom(roomCode);
    return success(res, { msg: 'room ended and data wiped', roomCode });
  } catch (error) {
    return next(error);
  }
};

const inviteToRoom = async (req, res, next) => {
  try {
    const participant = resolveHttpParticipant(req);
    if (!participant) {
      throw new AppError('chat session required', 401, 'auth_required');
    }

    const roomCode = String(req.body?.roomCode || '').toUpperCase().trim();
    const emails = Array.isArray(req.body?.emails)
      ? req.body.emails.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean)
      : [];

    if (!roomCode) {
      throw new AppError('room code required', 422, 'validation_error');
    }
    if (!emails.length) {
      throw new AppError('at least one email required', 422, 'validation_error');
    }
    if (emails.length > 10) {
      throw new AppError('max 10 emails per invite', 422, 'too_many_emails');
    }

    const room = await chatRoomModel.findOne({ roomCode }).lean();
    if (!room) {
      throw new AppError('Chat room not found', 404, 'room_not_found');
    }
    const isMember = room.members.some((m) => String(m.userId) === String(participant.id));
    if (!isMember) {
      throw new AppError('Only room members can invite', 403, 'not_member');
    }

    const joinUrl = frontendPath(`/chat?room=${encodeURIComponent(roomCode)}`);
    const title = room.title || 'Multiverse live chat';

    const results = [];
    for (const to of emails) {
      try {
        await sendMail({
          to,
          subject: `You're invited to ${title}`,
          text: `Join the Multiverse chat room ${roomCode}:\n${joinUrl}\n\nOr open Live Chat and enter code ${roomCode}.`,
          html: `<p>You're invited to <strong>${title}</strong>.</p>
            <p>Room code: <code>${roomCode}</code></p>
            <p><a href="${joinUrl}">Join the room</a></p>
            <p>Or open Live Chat and enter code <strong>${roomCode}</strong>.</p>`,
        });
        results.push({ email: to, ok: true });
      } catch (error) {
        results.push({ email: to, ok: false, error: error?.message || 'send failed' });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    return success(res, {
      msg: sent ? `Invites sent (${sent}/${emails.length})` : 'No invites sent',
      joinUrl,
      roomCode,
      results,
    });
  } catch (error) {
    return next(error);
  }
};

const recentSend = new Map();
const sendRateOk = (key) => {
  const now = Date.now();
  const list = (recentSend.get(key) || []).filter((t) => now - t < 2000);
  // Allow a normal chat pace; block only obvious spam bursts.
  if (list.length >= 12) {
    recentSend.set(key, list);
    return false;
  }
  list.push(now);
  recentSend.set(key, list);
  return true;
};

const joinRoomHttp = async (req, res, next) => {
  try {
    const participant = resolveHttpParticipant(req);
    if (!participant) {
      throw new AppError('chat session required', 401, 'auth_required');
    }
    const roomCode = String(req.params.code || '').toUpperCase().trim();
    const room = await chatRoomModel.findOne({ roomCode });
    if (!room) {
      throw new AppError('Chat room not found', 404, 'room_not_found');
    }
    if (room.expiresAt && new Date(room.expiresAt) < new Date()) {
      throw new AppError('Chat room expired', 410, 'room_expired');
    }

    const already = room.members.some((m) => String(m.userId) === String(participant.id));
    if (!already) {
      if (room.members.length >= MAX_MEMBERS) {
        throw new AppError('room is full', 409, 'room_full');
      }
      room.members.push({
        userId: participant.id,
        kind: participant.kind,
        displayName: participant.displayName,
        joinedAt: new Date(),
      });
      await room.save();
    }

    const messages = await chatMessageModel
      .find({ roomCode })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    return success(res, {
      msg: 'joined room',
      roomCode,
      title: room.title || '',
      mode: room.mode || 'incognito',
      expiresAt: room.expiresAt,
      members: room.members,
      maxMembers: MAX_MEMBERS,
      isCreator: String(room.createdBy) === String(participant.id),
      participantId: participant.id,
      messages: messages.map((m) => ({
        id: String(m._id),
        text: m.text,
        displayName: m.displayName,
        userId: String(m.userId),
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const listMessagesHttp = async (req, res, next) => {
  try {
    const participant = resolveHttpParticipant(req);
    if (!participant) {
      throw new AppError('chat session required', 401, 'auth_required');
    }
    const roomCode = String(req.params.code || '').toUpperCase().trim();
    const room = await chatRoomModel.findOne({ roomCode }).lean();
    if (!room) {
      throw new AppError('Chat room not found', 404, 'room_not_found');
    }
    const isMember = room.members.some((m) => String(m.userId) === String(participant.id));
    if (!isMember) {
      throw new AppError('not a member', 403, 'not_member');
    }

    const since = req.query.since ? new Date(String(req.query.since)) : null;
    const filter = { roomCode };
    if (since && !Number.isNaN(since.getTime())) {
      filter.createdAt = { $gt: since };
    }

    const messages = await chatMessageModel
      .find(filter)
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    return success(res, {
      roomCode,
      title: room.title || '',
      mode: room.mode || 'incognito',
      members: room.members,
      maxMembers: MAX_MEMBERS,
      isCreator: String(room.createdBy) === String(participant.id),
      messages: messages.map((m) => ({
        id: String(m._id),
        text: m.text,
        displayName: m.displayName,
        userId: String(m.userId),
        createdAt: m.createdAt,
      })),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
};

const postMessageHttp = async (req, res, next) => {
  try {
    const participant = resolveHttpParticipant(req);
    if (!participant) {
      throw new AppError('chat session required', 401, 'auth_required');
    }
    if (!sendRateOk(participant.id)) {
      throw new AppError('slow down', 429, 'rate_limited');
    }

    const roomCode = String(req.params.code || '').toUpperCase().trim();
    const text = String(req.body?.text || '').trim().slice(0, 2000);
    if (!text) {
      throw new AppError('message required', 422, 'validation_error');
    }

    const room = await chatRoomModel.findOne({ roomCode }).lean();
    if (!room) {
      throw new AppError('Chat room not found', 404, 'room_not_found');
    }
    const isMember = room.members.some((m) => String(m.userId) === String(participant.id));
    if (!isMember) {
      throw new AppError('not a member', 403, 'not_member');
    }

    const saved = await chatMessageModel.create({
      roomCode,
      userId: participant.id,
      kind: participant.kind,
      displayName: participant.displayName,
      text,
    });

    return success(res, {
      msg: 'message sent',
      message: {
        id: String(saved._id),
        text: saved.text,
        displayName: saved.displayName,
        userId: String(saved.userId),
        createdAt: saved.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const leaveRoomHttp = async (req, res, next) => {
  try {
    const participant = resolveHttpParticipant(req);
    if (!participant) {
      throw new AppError('chat session required', 401, 'auth_required');
    }
    const roomCode = String(req.params.code || '').toUpperCase().trim();
    const room = await chatRoomModel.findOne({ roomCode });
    if (!room) {
      return success(res, { msg: 'left room', roomCode });
    }
    room.members = room.members.filter((m) => String(m.userId) !== String(participant.id));
    await room.save();
    return success(res, { msg: 'left room', roomCode, members: room.members });
  } catch (error) {
    return next(error);
  }
};

export {
  createGuestSession,
  createRoom,
  getRoom,
  endRoomHttp,
  inviteToRoom,
  joinRoomHttp,
  listMessagesHttp,
  postMessageHttp,
  leaveRoomHttp,
  wipeRoom,
  MAX_MEMBERS,
  displayNameFor,
  sanitizeDisplayName,
  guestFallbackName,
  ROOM_TTL_MS,
};
