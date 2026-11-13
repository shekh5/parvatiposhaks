import Session from '../models/session.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/apiError.js';
import config from '../config/index.js';
import { cookieOptions, hashToken, randomToken, signAccessToken } from '../utils/tokens.js';

const refreshLifetimeMs = () => config.jwt.refreshDays * 24 * 60 * 60 * 1000;

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, {
    ...cookieOptions(),
    maxAge: config.jwt.accessMinutes * 60 * 1000,
  });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions(), maxAge: refreshLifetimeMs() });
};

export const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', cookieOptions());
  res.clearCookie('refreshToken', cookieOptions());
};

// Starts a session for this device and sets both cookies. Returns the access token.
export async function issueSession(user, req, res) {
  const refreshToken = randomToken(40);
  await Session.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshLifetimeMs()),
    userAgent: req.get('user-agent'),
    ip: req.ip,
  });
  const accessToken = signAccessToken(user._id);
  setAuthCookies(res, accessToken, refreshToken);
  return accessToken;
}

// Swaps a refresh token for a new pair. Each refresh token works only once.
export async function rotateSession(refreshToken, req, res) {
  const invalid = new ApiError('Session expired. Please sign in again', 401);
  if (!refreshToken) throw invalid;

  const session = await Session.findOneAndDelete({ tokenHash: hashToken(refreshToken) });
  if (!session || session.expiresAt < new Date()) throw invalid;

  const user = await User.findById(session.user);
  if (!user) throw invalid;

  const accessToken = await issueSession(user, req, res);
  return { user, accessToken };
}

export async function revokeSession(refreshToken) {
  if (refreshToken) await Session.deleteOne({ tokenHash: hashToken(refreshToken) });
}

export async function revokeAllSessions(userId) {
  await Session.deleteMany({ user: userId });
}
