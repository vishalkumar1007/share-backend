import mongoose from 'mongoose';

const mailSettingsSchema = new mongoose.Schema(
  {
    host: { type: String, default: '' },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, default: '' },
    /** AES-encrypted SMTP password */
    passEnc: { type: String, default: '' },
    fromName: { type: String, default: 'Multiverse' },
    fromEmail: { type: String, default: '' },
  },
  { _id: false }
);

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    mail: { type: mailSettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.models.appSettings || mongoose.model('appSettings', appSettingsSchema);
