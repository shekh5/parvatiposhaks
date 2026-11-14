import { body, param } from 'express-validator';

export const mongoIdParam = (name = 'id') => [
  param(name).isMongoId().withMessage(`Invalid ${name}`),
];

export const password = (field, label = 'Password') =>
  body(field)
    .isString()
    .withMessage(`${label} is required`)
    .isLength({ min: 8, max: 128 })
    .withMessage(`${label} must be between 8 and 128 characters`);

export const email = () =>
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .toLowerCase();
