import User from '../models/user.model.js';
import Cart from '../models/cart.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { hashToken } from '../utils/tokens.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/email.service.js';
import {
  clearAuthCookies,
  issueSession,
  revokeAllSessions,
  revokeSession,
  rotateSession,
} from '../services/session.service.js';
import { deleteImage, getAvatarInput, uploadAvatar } from '../services/upload.service.js';

const sendVerification = async (user) => {
  const token = user.generateEmailVerificationToken();
  await user.save({ validateBeforeSave: false });
  await sendVerificationEmail(user, token);
};

export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, username } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { username: username.toLowerCase() }] });
  if (existing) {
    throw new ApiError(existing.email === email ? 'Email already exists' : 'Username already exists', 409);
  }

  const avatarInput = getAvatarInput(req);
  const avatar = avatarInput ? await uploadAvatar(avatarInput) : undefined;

  const user = await User.create({ name, email, password, username, avatar });
  await sendVerification(user);
  const accessToken = await issueSession(user, req, res);

  sendResponse(res, 201, 'User registered successfully. Please verify your email', {
    user,
    accessToken,
  });
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.isPasswordMatch(password))) {
    throw new ApiError('Invalid email or password', 401);
  }
  const accessToken = await issueSession(user, req, res);
  sendResponse(res, 200, 'Signed in successfully', { user, accessToken });
});

export const refreshSession = asyncHandler(async (req, res) => {
  try {
    const { user, accessToken } = await rotateSession(req.cookies?.refreshToken, req, res);
    sendResponse(res, 200, 'Session refreshed', { user, accessToken });
  } catch (error) {
    clearAuthCookies(res);
    throw error;
  }
});

export const logout = asyncHandler(async (req, res) => {
  await revokeSession(req.cookies?.refreshToken);
  clearAuthCookies(res);
  sendResponse(res, 200, 'Logged out successfully');
});

export const logoutAll = asyncHandler(async (req, res) => {
  await revokeAllSessions(req.user._id);
  clearAuthCookies(res);
  sendResponse(res, 200, 'Logged out from all devices');
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    emailVerificationToken: hashToken(req.params.token),
    emailVerificationExpires: { $gt: new Date() },
  });
  if (!user) throw new ApiError('Invalid or expired verification link', 400);

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });
  sendResponse(res, 200, 'Email verified successfully');
});

export const resendVerification = asyncHandler(async (req, res) => {
  if (req.user.isEmailVerified) throw new ApiError('Email is already verified', 400);
  await sendVerification(req.user);
  sendResponse(res, 200, 'Verification email sent');
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  // Same answer whether or not the account exists, so emails cannot be probed
  const message = 'If an account exists for this email, a password reset link has been sent';
  const user = await User.findOne({ email: req.body.email });
  if (!user) return sendResponse(res, 200, message);

  const token = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    await sendPasswordResetEmail(user, token);
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError('Failed to send email, please try again later', 500);
  }
  sendResponse(res, 200, message);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: hashToken(req.params.token),
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user) throw new ApiError('Invalid or expired reset token', 400);

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  // Anyone holding an old session is signed out
  await revokeAllSessions(user._id);
  const accessToken = await issueSession(user, req, res);
  sendResponse(res, 200, 'Password reset successfully', { user, accessToken });
});

export const getUserDetail = asyncHandler(async (req, res) => {
  sendResponse(res, 200, 'User details retrieved successfully', { user: req.user });
});

export const updatePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.isPasswordMatch(req.body.oldPassword))) {
    throw new ApiError('Old password is incorrect', 400);
  }
  user.password = req.body.newPassword;
  await user.save();

  await revokeAllSessions(user._id);
  const accessToken = await issueSession(user, req, res);
  sendResponse(res, 200, 'Password updated successfully', { user, accessToken });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const { name, email } = req.body;

  if (name !== undefined) user.name = name;

  const emailChanged = email !== undefined && email !== user.email;
  if (emailChanged) {
    if (await User.exists({ email, _id: { $ne: user._id } })) {
      throw new ApiError('Email already exists', 409);
    }
    user.email = email;
    user.isEmailVerified = false;
  }

  const avatarInput = getAvatarInput(req);
  if (avatarInput) {
    const previous = user.avatar?.public_id;
    user.avatar = await uploadAvatar(avatarInput);
    await deleteImage(previous);
  }

  await user.save();
  if (emailChanged) await sendVerification(user);
  sendResponse(res, 200, 'Profile updated successfully', { user });
});

// ---------- admin ----------
export const getUserList = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  sendResponse(res, 200, 'User list retrieved successfully', { users, count: users.length });
});

export const getSingleUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError('User not found', 404);
  sendResponse(res, 200, 'User details retrieved successfully', { user });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role: req.body.role },
    { new: true, runValidators: true }
  );
  if (!user) throw new ApiError('User not found', 404);
  sendResponse(res, 200, 'User role updated successfully', { user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    throw new ApiError('You cannot delete your own account here', 400);
  }
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError('User not found', 404);

  await Promise.all([
    revokeAllSessions(user._id),
    Cart.deleteOne({ user: user._id }),
    deleteImage(user.avatar?.public_id),
  ]);
  sendResponse(res, 200, 'User deleted successfully');
});
