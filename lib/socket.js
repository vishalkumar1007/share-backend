import { Server } from 'socket.io';
import { verifyToken } from './jwt.js';
import userModel from '../models/userModel.js';
import chatRoomModel from '../models/chatRoomModel.js';
import chatMessageModel from '../models/chatMessageModel.js';
import { withUniqueCode, generateRoomCode } from './codes.js';
import { env } from '../config/env.js';
import {
  MAX_MEMBERS,
  displayNameFor,
  sanitizeDisplayName,
  guestFallbackName,
  ROOM_TTL_MS,
  wipeRoom,
} from '../controllers/chatController.js';

const recentMessages = new Map();

const rateOk = (socketId) => {
  const now = Date.now();
  const list = (recentMessages.get(socketId) || []).filter((t) => now - t < 3000);
  if (list.length >= 8) {
    recentMessages.set(socketId, list);
    return false;
  }
  list.push(now);
  recentMessages.set(socketId, list);
  return true;
};

const attachIdentity = async (socket) => {
  const token =
    socket.handshake.auth?.token ||
    String(socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    throw new Error('auth required');
  }

  const decoded = verifyToken(token);
  if (decoded?.kind === 'guest') {
    if (!decoded.guestId) throw new Error('invalid guest');
    socket.participantId = String(decoded.guestId);
    socket.participantKind = 'guest';
    socket.displayName = sanitizeDisplayName(decoded.displayName, guestFallbackName());
    return;
  }

  const user = await userModel.findOne({ email: decoded.email }).select({
    _id: 1,
    firstName: 1,
    lastName: 1,
    email: 1,
  });
  if (!user) {
    throw new Error('user not found');
  }
  socket.participantId = String(user._id);
  socket.participantKind = 'user';
  socket.displayName = displayNameFor(user);
  socket.user = user;
};

export const attachSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use(async (socket, next) => {
    try {
      await attachIdentity(socket);
      return next();
    } catch (error) {
      return next(new Error(error?.message || 'invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('room:create', async (payload, ack) => {
      const respond = typeof payload === 'function' ? payload : ack;
      const data = typeof payload === 'function' ? {} : payload || {};
      try {
        const title = String(data.title || '').trim().slice(0, 80);
        const mode = data.mode === 'saved' ? 'saved' : 'incognito';
        if (mode === 'saved' && socket.participantKind !== 'user') {
          throw new Error('Login required to save chat history');
        }

        const room = await withUniqueCode(generateRoomCode, (roomCode) =>
          chatRoomModel.create({
            roomCode,
            title,
            mode,
            createdBy: socket.participantId,
            createdByKind: socket.participantKind,
            members: [
              {
                userId: socket.participantId,
                kind: socket.participantKind,
                displayName: socket.displayName,
                joinedAt: new Date(),
              },
            ],
            expiresAt: new Date(Date.now() + ROOM_TTL_MS),
          })
        );
        socket.join(room.roomCode);
        socket.roomCode = room.roomCode;
        socket.isCreator = true;
        if (typeof respond === 'function') {
          respond({
            ok: true,
            roomCode: room.roomCode,
            title: room.title,
            mode: room.mode,
            expiresAt: room.expiresAt,
            members: room.members,
            maxMembers: MAX_MEMBERS,
            isCreator: true,
          });
        }
      } catch (error) {
        if (typeof respond === 'function') {
          respond({ ok: false, message: error?.message || 'create failed' });
        }
      }
    });

    socket.on('room:join', async (payload, ack) => {
      try {
        const roomCode = String(payload?.roomCode || '').toUpperCase().trim();
        if (!roomCode) {
          throw new Error('room code required');
        }

        const room = await chatRoomModel.findOne({ roomCode });
        if (!room) {
          throw new Error('room not found');
        }
        if (room.expiresAt && new Date(room.expiresAt) < new Date()) {
          throw new Error('room expired');
        }

        const already = room.members.some(
          (m) => String(m.userId) === String(socket.participantId)
        );
        if (!already) {
          if (room.members.length >= MAX_MEMBERS) {
            throw new Error('room is full');
          }
          room.members.push({
            userId: socket.participantId,
            kind: socket.participantKind,
            displayName: socket.displayName,
            joinedAt: new Date(),
          });
          await room.save();
        }

        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.isCreator = String(room.createdBy) === String(socket.participantId);

        const messages = await chatMessageModel
          .find({ roomCode })
          .sort({ createdAt: 1 })
          .limit(100)
          .lean();

        io.to(roomCode).emit('presence:update', {
          roomCode,
          members: room.members,
          maxMembers: MAX_MEMBERS,
        });
        io.to(roomCode).emit('peer:joined', {
          roomCode,
          userId: socket.participantId,
          displayName: socket.displayName,
        });

        if (typeof ack === 'function') {
          ack({
            ok: true,
            roomCode,
            title: room.title || '',
            mode: room.mode || 'incognito',
            members: room.members,
            maxMembers: MAX_MEMBERS,
            isCreator: socket.isCreator,
            messages: messages.map((m) => ({
              id: String(m._id),
              text: m.text,
              displayName: m.displayName,
              userId: String(m.userId),
              createdAt: m.createdAt,
            })),
          });
        }
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ ok: false, message: error?.message || 'join failed' });
        }
      }
    });

    socket.on('room:end', async (ack) => {
      try {
        const roomCode = socket.roomCode;
        if (!roomCode) throw new Error('not in a room');
        const room = await chatRoomModel.findOne({ roomCode });
        if (!room) throw new Error('room not found');
        if (String(room.createdBy) !== String(socket.participantId)) {
          throw new Error('Only the creator can end this room');
        }
        io.to(roomCode).emit('room:ended', {
          roomCode,
          reason: room.mode === 'incognito' ? 'incognito_wipe' : 'ended_by_creator',
        });
        const sockets = await io.in(roomCode).fetchSockets();
        for (const s of sockets) {
          s.leave(roomCode);
          s.roomCode = null;
        }
        await wipeRoom(roomCode);
        if (typeof ack === 'function') {
          ack({ ok: true, roomCode });
        }
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ ok: false, message: error?.message || 'end failed' });
        }
      }
    });

    socket.on('chat:message', async (payload, ack) => {
      try {
        if (!rateOk(socket.id)) {
          throw new Error('slow down');
        }
        const roomCode = socket.roomCode || String(payload?.roomCode || '').toUpperCase();
        const text = String(payload?.text || '').trim().slice(0, 2000);
        if (!roomCode || !text) {
          throw new Error('invalid message');
        }

        const room = await chatRoomModel.findOne({ roomCode }).lean();
        if (!room) {
          throw new Error('room not found');
        }
        const isMember = room.members.some(
          (m) => String(m.userId) === String(socket.participantId)
        );
        if (!isMember) {
          throw new Error('not a member');
        }

        const saved = await chatMessageModel.create({
          roomCode,
          userId: socket.participantId,
          kind: socket.participantKind,
          displayName: socket.displayName,
          text,
        });

        const message = {
          id: String(saved._id),
          text: saved.text,
          displayName: saved.displayName,
          userId: String(saved.userId),
          createdAt: saved.createdAt,
        };

        io.to(roomCode).emit('chat:message', message);
        if (typeof ack === 'function') {
          ack({ ok: true, message });
        }
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ ok: false, message: error?.message || 'send failed' });
        }
      }
    });

    socket.on('chat:typing', (payload) => {
      const roomCode = socket.roomCode || String(payload?.roomCode || '').toUpperCase();
      if (!roomCode) return;
      socket.to(roomCode).emit('chat:typing', {
        roomCode,
        userId: socket.participantId,
        displayName: socket.displayName,
        typing: Boolean(payload?.typing),
      });
    });

    socket.on('room:leave', async () => {
      if (!socket.roomCode) return;
      const roomCode = socket.roomCode;
      socket.leave(roomCode);
      socket.to(roomCode).emit('peer:left', {
        roomCode,
        userId: socket.participantId,
        displayName: socket.displayName,
      });
      socket.roomCode = null;
    });

    socket.on('disconnect', () => {
      if (!socket.roomCode) return;
      socket.to(socket.roomCode).emit('peer:left', {
        roomCode: socket.roomCode,
        userId: socket.participantId,
        displayName: socket.displayName,
      });
    });
  });

  return io;
};
