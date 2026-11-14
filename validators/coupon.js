import { body } from 'express-validator';
import { mongoIdParam } from './common.js';

const couponFields = (optional) => {
  const field = (name) => (optional ? body(name).optional() : body(name));
  const nullable = (name) => body(name).optional({ values: 'null' });
  return [
    field('code')
      .trim()
      .matches(/^[A-Za-z0-9_-]{3,30}$/)
      .withMessage('Code must be 3 to 30 letters, numbers, dashes or underscores'),
    field('type').isIn(['percent', 'flat']).withMessage('Type must be percent or flat'),
    field('value').isFloat({ min: 0 }).withMessage('Value must be a number of 0 or more').toFloat(),
    body('minOrderValue').optional().isFloat({ min: 0 }).withMessage('Minimum order must be 0 or more').toFloat(),
    nullable('maxDiscount').isFloat({ min: 0 }).withMessage('Maximum discount must be 0 or more').toFloat(),
    nullable('expiresAt').isISO8601().withMessage('expiresAt must be a date').toDate(),
    nullable('usageLimit').isInt({ min: 1 }).withMessage('Usage limit must be at least 1').toInt(),
    body('perUserLimit').optional().isInt({ min: 1 }).withMessage('Per-user limit must be at least 1').toInt(),
    body('active').optional().isBoolean().withMessage('active must be true or false').toBoolean(),
  ];
};

export const createCouponValidator = () => couponFields(false);
export const updateCouponValidator = () => [...mongoIdParam(), ...couponFields(true)];
export const validateCouponValidator = () => [
  body('code').trim().notEmpty().withMessage('Coupon code is required'),
];
