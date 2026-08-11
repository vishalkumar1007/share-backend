import mongoose from 'mongoose';

const blobSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    key: { type: String, default: '' },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    filename: { type: String, default: '' },
    width: Number,
    height: Number,
    duration: Number,
  },
  { _id: false }
);

const shareSchema = new mongoose.Schema(
  {
    shareId: { type: String, required: true, unique: true },
    type: {
      type: String,
      required: true,
      enum: ['text', 'image', 'file', 'audio'],
    },
    title: { type: String, default: '' },
    content: { type: String, default: null },
    blob: { type: blobSchema, default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
    privacy: {
      type: String,
      default: 'public',
      enum: ['public', 'incognito'],
    },
    readCount: { type: Number, default: 0 },
    lastReadAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

shareSchema.index({ ownerId: 1, createdAt: -1 });
shareSchema.index({ type: 1 });
shareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ShareModel = mongoose.models.share || mongoose.model('share', shareSchema);

export default ShareModel;
