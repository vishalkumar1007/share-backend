import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    kind: { type: String, enum: ['user', 'guest'], default: 'user' },
    displayName: { type: String, default: '' },
    text: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
);

chatMessageSchema.index({ roomCode: 1, createdAt: -1 });

export default mongoose.model('chatMessage', chatMessageSchema);
