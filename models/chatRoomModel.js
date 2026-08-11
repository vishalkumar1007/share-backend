import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    kind: { type: String, enum: ['user', 'guest'], default: 'user' },
    displayName: { type: String, default: '' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatRoomSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: '' },
    mode: { type: String, enum: ['incognito', 'saved'], default: 'incognito' },
    createdBy: { type: String, required: true },
    createdByKind: { type: String, enum: ['user', 'guest'], default: 'guest' },
    members: { type: [memberSchema], default: [] },
    linkedShareId: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

chatRoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('chatRoom', chatRoomSchema);
