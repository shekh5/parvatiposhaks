import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

export const signAccessToken = (userId) =>
  jwt.sign({ id: userId }, config.jwt.secret, { expiresIn: `${config.jwt.accessMinutes}m` });

export const verifyAccessToken = (token) => jwt.verify(token, config.jwt.secret);

export const cookieOptions = () => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.isProduction ? 'none' : 'lax',
  path: '/',
});
