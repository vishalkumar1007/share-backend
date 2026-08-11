import nodemailer from 'nodemailer';
import appSettingsModel from '../models/appSettingsModel.js';
import { decryptSecret } from './cryptoSecret.js';
import { AppError } from './responses.js';

export const getMailSettingsDoc = async () => {
  let doc = await appSettingsModel.findOne({ key: 'default' });
  if (!doc) {
    doc = await appSettingsModel.create({ key: 'default', mail: {} });
  }
  return doc;
};

export const getDecryptedMailConfig = async () => {
  const doc = await getMailSettingsDoc();
  const mail = doc.mail || {};
  const pass = decryptSecret(mail.passEnc);
  return {
    host: mail.host || '',
    port: Number(mail.port) || 587,
    secure: Boolean(mail.secure),
    user: mail.user || '',
    pass,
    fromName: mail.fromName || 'Multiverse',
    fromEmail: mail.fromEmail || mail.user || '',
  };
};

export const assertMailConfigured = (cfg) => {
  if (!cfg.host || !cfg.user || !cfg.pass || !cfg.fromEmail) {
    throw new AppError(
      'Mail credentials are not configured. Ask an admin to set them up.',
      503,
      'mail_not_configured'
    );
  }
};

export const createTransport = (cfg) =>
  nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  });

export const sendMail = async ({ to, subject, text, html }) => {
  const cfg = await getDecryptedMailConfig();
  assertMailConfigured(cfg);
  const transport = createTransport(cfg);
  const from = `"${cfg.fromName}" <${cfg.fromEmail}>`;
  return transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
};
