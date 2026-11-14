import { body, param } from 'express-validator';
import { mongoIdParam, password, email } from './common.js';

export const signupValidator = () => [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }),
  email(),
  password('password'),
  body('username')
    .trim()
    .isLength({ min: 3, max: 13 })
    .withMessage('Username must be between 3 and 13 characters')
    .matches(/^[a-zA-Z0-9_.]+$/)
    .withMessage('Username can only contain letters, numbers, dots and underscores'),
];

export const loginValidator = () => [
  email(),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

export const forgotPasswordValidator = () => [email()];

export const resetPasswordValidator = () => [
  param('token').isHexadecimal().withMessage('Invalid reset token'),
  password('password'),
  body('confirmedPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Password and confirmed password do not match'),
];

export const updatePasswordValidator = () => [
  body('oldPassword').isString().notEmpty().withMessage('Old password is required'),
  password('newPassword', 'New password'),
  body('confirmNewPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('New password and confirmation do not match'),
];

export const updateProfileValidator = () => [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').isLength({ max: 80 }),
  body('email').optional().trim().isEmail().withMessage('Please enter a valid email address').toLowerCase(),
];

export const tokenParamValidator = () => [
  param('token').isHexadecimal().withMessage('Invalid token'),
];

export const roleValidator = () => [
  ...mongoIdParam(),
  body('role').isIn(['user', 'admin']).withMessage('Role must be either user or admin'),
];
