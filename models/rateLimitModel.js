import mongoose from 'mongoose';

const rateLimitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number },
    windowStart: { type: Number },
    expireAt: { type: Date },
  },
  { timestamps: true }
);

rateLimitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const RateLimitModel =
  mongoose.models.rateLimit || mongoose.model('rateLimit', rateLimitSchema);

export default RateLimitModel;
