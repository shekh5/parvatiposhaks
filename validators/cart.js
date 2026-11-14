import { body } from 'express-validator';
import { mongoIdParam } from './common.js';

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

export const replaceCartValidator = () => [
  body('items').isArray({ max: 100 }).withMessage('Items must be a list'),
  body('items.*.productId').isMongoId().withMessage('Invalid productId'),
  body('items.*.variantId').optional({ values: 'null' }).isMongoId().withMessage('Invalid variantId'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100')
    .toInt(),
];
