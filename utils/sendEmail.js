import nodemailer from 'nodemailer';
import config from '../config/index.js';
import logger from './logger.js';

let transporter;

const getTransporter = () => {
  if (!transporter) {
    const { service, host, port, mail, password } = config.smtp;
    transporter = nodemailer.createTransport({
      ...(service ? { service } : { host, port }),
      auth: { user: mail, pass: password },
    });
  }
  return transporter;
};

export const sendEmail = async ({ email, subject, message }) => {
  if (!config.smtp.mail) {
    logger.warn(`SMTP is not configured; skipped email "${subject}" to ${email}`);
    return;
  }
  await getTransporter().sendMail({
    from: config.smtp.mail,
    to: email,
    subject,
    text: message,
  });
};
