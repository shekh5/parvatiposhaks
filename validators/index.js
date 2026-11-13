import { body, param } from 'express-validator';
import { ORDER_STATUSES, PAYMENT_METHODS } from '../models/order.model.js';

export const mongoIdParam = (name = 'id') => [
  param(name).isMongoId().withMessage(`Invalid ${name}`),
];

const password = (field, label = 'Password') =>
  body(field)
    .isString()
    .withMessage(`${label} is required`)
    .isLength({ min: 8, max: 128 })
    .withMessage(`${label} must be between 8 and 128 characters`);

const email = () =>
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .toLowerCase();

// ---------- auth ----------
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

// ---------- products ----------
const productFields = (optional) => {
  const field = (name) => (optional ? body(name).optional() : body(name));
  return [
    field('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
    field('description').trim().notEmpty().withMessage('Description is required'),
    field('price').isFloat({ min: 0 }).withMessage('Price must be a number of 0 or more').toFloat(),
    field('category').trim().notEmpty().withMessage('Category is required'),
    body('stock')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Stock must be a whole number of 0 or more')
      .toInt(),
    body('images').optional().isArray().withMessage('Images must be a list'),
    body('images.*.public_id').isString().notEmpty().withMessage('Each image needs a public_id'),
    body('images.*.url').isString().notEmpty().withMessage('Each image needs a url'),
    body('variants').optional().isArray().withMessage('Variants must be a list'),
    body('variants.*.stock')
      .isInt({ min: 0 })
      .withMessage('Variant stock must be a whole number of 0 or more')
      .toInt(),
    body('variants.*.price')
      .optional({ values: 'null' })
      .isFloat({ min: 0 })
      .withMessage('Variant price must be a number of 0 or more')
      .toFloat(),
    body('variants.*.size').optional().isString().isLength({ max: 40 }),
    body('variants.*.color').optional().isString().isLength({ max: 40 }),
    body('variants.*.sku').optional().isString().isLength({ max: 60 }),
  ];
};

export const createProductValidator = () => productFields(false);
export const updateProductValidator = () => [...mongoIdParam(), ...productFields(true)];

export const reviewValidator = () => [
  ...mongoIdParam(),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be a whole number from 1 to 5').toInt(),
  body('comment')
    .trim()
    .notEmpty()
    .withMessage('Comment is required')
    .isLength({ max: 2000 })
    .withMessage('Comment cannot exceed 2000 characters'),
];

// ---------- cart ----------
export const addCartItemValidator = () => [
  body('productId').isMongoId().withMessage('Invalid productId'),
  body('variantId').optional({ values: 'null' }).isMongoId().withMessage('Invalid variantId'),
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100')
    .toInt(),
];

export const updateCartItemValidator = () => [
  ...mongoIdParam('itemId'),
  body('quantity').isInt({ min: 1, max: 100 }).withMessage('Quantity must be between 1 and 100').toInt(),
];

// ---------- coupons ----------
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

// ---------- checkout and orders ----------
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
