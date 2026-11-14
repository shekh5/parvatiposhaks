import { body } from 'express-validator';
import { mongoIdParam } from './common.js';

const productFields = (optional) => {
  const field = (name) => (optional ? body(name).optional() : body(name));
  return [
    field('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
    field('description').trim().notEmpty().withMessage('Description is required'),
    field('price').isFloat({ min: 0 }).withMessage('Price must be a number of 0 or more').toFloat(),
    field('category').trim().notEmpty().withMessage('Category is required'),
    body('mrp')
      .optional({ values: 'null' })
      .isFloat({ min: 0 })
      .withMessage('MRP must be a number of 0 or more')
      .toFloat(),
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
