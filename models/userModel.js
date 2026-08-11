import mongoose from 'mongoose';

const textDataSchema = new mongoose.Schema(
  {
    codeMappedText: { type: String, required: true },
    multiverseCode: { type: String, required: true },
    shareId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const imageDataSchema = new mongoose.Schema(
  {
    imageData: { type: String, required: true },
    imageMultiverseCode: { type: String, required: true },
    shareId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const fileDataSchema = new mongoose.Schema(
  {
    fileData: { type: String, required: true },
    fileMultiverseCode: { type: String, required: true },
    shareId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const audioDataSchema = new mongoose.Schema(
  {
    audioData: { type: String, required: true },
    audioMultiverseCode: { type: String, required: true },
    shareId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    activityHistory: {
      textMultiverseData: { type: [textDataSchema], default: [] },
      imageMultiverseData: { type: [imageDataSchema], default: [] },
      fileMultiverseData: { type: [fileDataSchema], default: [] },
      audioMultiverseData: { type: [audioDataSchema], default: [] },
    },
  },
  { timestamps: true }
);

const userModel = mongoose.models.user || mongoose.model('user', userSchema);

export default userModel;
