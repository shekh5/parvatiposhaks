import { body } from 'express-validator';
import { mongoIdParam } from './common.js';
import { ORDER_STATUSES, PAYMENT_METHODS } from '../models/order.model.js';

export const checkoutValidator = () => [
  body('shippingInfo').isObject().withMessage('Shipping details are required'),
  ...['address', 'city', 'state', 'country'].map((key) =>
    body(`shippingInfo.${key}`)
      .isString()
      .trim()
      .notEmpty()
      .withMessage(`Shipping ${key} is required`)
      .isLength({ max: 200 })
  ),
  body('shippingInfo.pinCode')
    .customSanitizer((value) => (value == null ? '' : String(value).trim()))
    .matches(/^[A-Za-z0-9 -]{4,10}$/)
    .withMessage('Please enter a valid pin code'),
  body('shippingInfo.phoneNo')
    .customSanitizer((value) => (value == null ? '' : String(value).replace(/[\s-]/g, '')))
    .matches(/^\+?\d{10,13}$/)
    .withMessage('Please enter a valid phone number'),
  body('paymentMethod')
    .isIn(PAYMENT_METHODS)
    .withMessage(`Payment method must be one of: ${PAYMENT_METHODS.join(', ')}`),
  body('couponCode').optional({ values: 'falsy' }).isString().trim(),
];

export const verifyPaymentValidator = () =>
  ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'].map((key) =>
    body(key).isString().notEmpty().withMessage(`${key} is required`)
  );

export const orderStatusValidator = () => [
  ...mongoIdParam(),
  body('status')
    .isIn(ORDER_STATUSES.filter((status) => status !== 'Pending'))
    .withMessage('Status must be Processing, Shipped, Delivered or Cancelled'),
];

export const paymentStatusValidator = () => [
  ...mongoIdParam(),
  body('paymentStatus').isIn(['paid', 'refunded']).withMessage('Payment status must be paid or refunded'),
];
