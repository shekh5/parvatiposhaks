import { body } from 'express-validator';
import { email } from './common.js';

export const contactValidator = () => [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }),
  email(),
  body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 150 }),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 5000 })
    .withMessage('Message cannot exceed 5000 characters'),
];

export const newsletterValidator = () => [email()];
