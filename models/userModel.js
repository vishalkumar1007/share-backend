import mongoose from 'mongoose';

const textDataSchema = new mongoose.Schema({
  codeMappedText: { type: String, required: true },
  multiverseCode: { type: Number, required: true }
}, { _id: false });

const imageDataSchema = new mongoose.Schema({
  imageData: { type: String, required: true },
  imageMultiverseCode: { type: Number, required: true }
}, { _id: false });

const fileDataSchema = new mongoose.Schema({
  fileData: { type: String, required: true },
  fileMultiverseCode: { type: Number, required:  true }
}, { _id: false });

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  activityHistory: {
    textMultiverseData: { type: [textDataSchema], default: [] },
    imageMultiverseData: { type: [imageDataSchema], default: [] },
    fileMultiverseData: { type: [fileDataSchema], default: [] }
  }
}, { timestamps: true });

const userModel = mongoose.model('user', userSchema);
export default userModel;
