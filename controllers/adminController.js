import bcrypt from 'bcryptjs';
import userModel from '../models/userModel.js';
import { signToken } from '../lib/jwt.js';
import { encryptSecret, decryptSecret, maskSecret } from '../lib/cryptoSecret.js';
import {
  getMailSettingsDoc,
  getDecryptedMailConfig,
  createTransport,
  assertMailConfigured,
  sendMail,
} from '../lib/mailer.js';
import { AppError, success } from '../lib/responses.js';

const adminLogin = async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      throw new AppError('email and password required', 422, 'validation_error');
    }

    const user = await userModel.findOne({ email });
    if (!user || user.role !== 'admin') {
      throw new AppError('Invalid admin credentials', 401, 'admin_invalid');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new AppError('Invalid admin credentials', 401, 'admin_invalid');
    }

    const token = signToken({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: 'admin',
    });

    return success(res, {
      msg: 'admin login successful',
      accessToken: token,
      admin: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getMailSettings = async (req, res, next) => {
  try {
    const doc = await getMailSettingsDoc();
    const mail = doc.mail || {};
    const passPlain = decryptSecret(mail.passEnc);
    return success(res, {
      mail: {
        host: mail.host || '',
        port: mail.port || 587,
        secure: Boolean(mail.secure),
        user: mail.user || '',
        passMasked: maskSecret(passPlain),
        hasPassword: Boolean(passPlain),
        fromName: mail.fromName || 'Multiverse',
        fromEmail: mail.fromEmail || '',
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const updateMailSettings = async (req, res, next) => {
  try {
    const {
      host,
      port,
      secure,
      user,
      pass,
      fromName,
      fromEmail,
    } = req.body || {};

    const doc = await getMailSettingsDoc();
    const nextMail = {
      host: String(host || '').trim(),
      port: Number(port) || 587,
      secure: Boolean(secure),
      user: String(user || '').trim(),
      fromName: String(fromName || 'Multiverse').trim() || 'Multiverse',
      fromEmail: String(fromEmail || '').trim(),
      passEnc: doc.mail?.passEnc || '',
    };

    if (pass !== undefined && pass !== null && String(pass).length > 0) {
      nextMail.passEnc = encryptSecret(String(pass));
    }

    doc.mail = nextMail;
    await doc.save();

    return success(res, {
      msg: 'mail settings saved',
      mail: {
        host: nextMail.host,
        port: nextMail.port,
        secure: nextMail.secure,
        user: nextMail.user,
        passMasked: maskSecret(decryptSecret(nextMail.passEnc)),
        hasPassword: Boolean(nextMail.passEnc),
        fromName: nextMail.fromName,
        fromEmail: nextMail.fromEmail,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const testMailSettings = async (req, res, next) => {
  try {
    const cfg = await getDecryptedMailConfig();
    assertMailConfigured(cfg);
    const transport = createTransport(cfg);
    await transport.verify();

    const to = String(req.body?.to || req.admin?.email || cfg.fromEmail).trim();
    await sendMail({
      to,
      subject: 'Multiverse mail test',
      text: 'Your Multiverse SMTP credentials are working.',
      html: '<p>Your Multiverse SMTP credentials are working.</p>',
    });

    return success(res, { msg: `test email sent to ${to}` });
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(new AppError(error?.message || 'mail test failed', 502, 'mail_test_failed'));
  }
};

export { adminLogin, getMailSettings, updateMailSettings, testMailSettings };
