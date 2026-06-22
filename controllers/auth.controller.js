import User from '../models/user.models.js';
import asyncHandler from '../utils/async-handler.js';
import apiError from '../utils/api.Error.js';
import apiResponse from '../utils/api.Response.js';
import { sendToken } from '../utils/jwtToken.js';
import { sendEmail } from '../utils/sendEmail.js';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
// import bcrypt from "bcryptjs"

const registerUser = asyncHandler(async (req, res, next) => {
  const { name, email, password, username, avatar } = req.body;

  if (!avatar) {
    return next(new apiError('Avatar is required', 400));
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    const message =
      existingUser.email === email ? 'Email already exists' : 'Username already exists';
    return next(new apiError(message, 400));
  }

  let myCloud;
  try {
    myCloud = await cloudinary.uploader.upload(avatar, {
      folder: 'avatars',
      width: 150,
      crop: 'scale',
    });
  } catch (error) {
    return next(new apiError('Avatar upload failed. Please choose a valid image.', 400));
  }
  // const hashedPassword = await bcrypt.hash(password,10);

  // if(await User.findOne({email})){
  //     return next(new apiError("Email already exists",400))
  // }

  const user = await User.create({
    name,
    email,
    // password:hashedPassword,
    password,
    username,
    avatar: {
      public_id: myCloud.public_id,
      url: myCloud.secure_url || myCloud.url,
    },
  });

  if (!user) {
    return next(new apiError('Failed to register user', 500));
  }

  const token = user.getJWTToken();
  const userResponse = user.toObject();
  delete userResponse.password;

  return res
    .status(201)
    .json(new apiResponse(201, 'user registered successfully', userResponse, true, token));
});

const loginUser = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new apiError('Invalid Email or Pass', 401));
  }

  const isPasswordValid = await user.isPasswordMatch(password);

  if (!isPasswordValid) {
    return next(new apiError('Invalid email or password', 401));
  }

  sendToken(user, 201, res);
});

const logout = asyncHandler(async (req, res, next) => {
  res.cookie('token', null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });
  return res.status(200).json(new apiResponse(200, 'Logged out successfully', null, true));
});

//forgot password
const requestPasswordReset = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new apiError('User not found with this email', 404));
  }
  let resetToken;
  try {
    resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });
    //return res.status(200).json(new apiResponse(200,"Password reset link sent to your email",null,true))
  } catch (error) {
    return next(new apiError('could not save reset token, please try again later', 500));
  }

  const resetPasswordUrl = `${req.protocol}://${req.get('host')}/reset/${resetToken}`;

  const message = `use the following link to reset your password:\n\n ${resetPasswordUrl}\n\n this link is valid for 5 minutes. \n\n if you did not request this email, please ignore it.`;

  try {
    //send email
    await sendEmail({
      email: user.email,
      subject: 'Password Reset Request',
      message: message,
    });
    res
      .status(200)
      .json({ success: true, message: `Password reset link sent to your email ${user.email}` });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new apiError('Failed to send email, please try again later', 500));
  }
});

//reset password
const resetPassword = asyncHandler(async (req, res, next) => {
  const resetToken = req.params.token;
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  // console.log("Received reset token:", resetToken); // Debugging log to check received token
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new apiError('Invalid or expired reset token', 400));
  }
  const { password, confirmedPassword } = req.body;

  if (password !== confirmedPassword) {
    return next(new apiError('Password and confirmed password do not match', 400));
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();
  sendToken(user, 200, res);
});

//get user details
const getUserDetail = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new apiError('User not found', 404));
  }
  return res
    .status(200)
    .json(new apiResponse(200, 'User details retrieved successfully', user, true));
});

const updatePassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword, confirmNewPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password'); //?
  if (!user) {
    return next(new apiError('User not found', 404));
  }

  const checkPasswordMatch = await user.isPasswordMatch(oldPassword);
  if (!checkPasswordMatch) {
    return next(new apiError('Old password is incorrect', 400));
  }

  if (newPassword !== confirmNewPassword) {
    return next(new apiError('New password and confirm new password do not match', 400));
  }

  user.password = newPassword;
  await user.save();
  sendToken(user, 200, res);
});

const updateProfile = asyncHandler(async (req, res, next) => {
  const { name, email, avatar } = req.body;
  const updateUserdetails = {
    name,
    email,
  };

  if (avatar !== '') {
    const user = await User.findById(req.user.id);
    if (user && user.avatar && user.avatar.public_id) {
      try {
        await cloudinary.uploader.destroy(user.avatar.public_id);
      } catch (err) {
        console.log('Failed to delete old avatar:', err);
      }
    }

    let myCloud;
    try {
      myCloud = await cloudinary.uploader.upload(avatar, {
        folder: 'avatars',
        width: 150,
        crop: 'scale',
      });
      updateUserdetails.avatar = {
        public_id: myCloud.public_id,
        url: myCloud.secure_url || myCloud.url,
      };
    } catch (error) {
      return next(new apiError('Avatar upload failed. Please choose a valid image.', 400));
    }
  }

  const user = await User.findByIdAndUpdate(req.user.id, updateUserdetails, {
    new: true,
    runValidators: true,
  });
  res.status(200).json(new apiResponse(200, 'Profile updated successfully', user, true));
});

const getUserList = asyncHandler(async (req, res, next) => {
  const users = await User.find();
  res.status(200).json(new apiResponse(200, 'User list retrieved successfully', users));
});

const getSingleUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new apiError('User not found with id ' + req.params.id, 404));
  }
  res.status(200).json(new apiResponse(200, 'User details retrieved successfully', user));
});

//admin- changing user role
const updateUserRole = asyncHandler(async (req, res, next) => {
  const { role } = req.body;
  const newUserData = {
    role,
  };
  const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
    new: true,
    runValidators: true,
  });
  if (!user) {
    return next(new apiError('User not found', 400));
  }
  res.status(200).json(new apiResponse(200, 'User role updated successfully', user));
});

//admin delete user profile
const deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return next(new apiError('User not found', 404));
  }
  await User.findByIdAndDelete(req.params.id);
  res.status(200).json(new apiResponse(200, 'User deleted successfully', null, true));
});
export {
  registerUser,
  loginUser,
  logout,
  requestPasswordReset,
  resetPassword,
  getUserDetail,
  updatePassword,
  updateProfile,
  getUserList,
  getSingleUser,
  updateUserRole,
  deleteUser,
};
