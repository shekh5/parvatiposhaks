import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  getAdminProducts,
  getAllProducts,
  getSingleProduct,
  updateProduct,
} from '../controllers/product.controller.js';
import {
  deleteReview,
  getProductReviews,
  upsertReview,
} from '../controllers/review.controller.js';
import {
  requireVerifiedEmail,
  roleBasedAccess,
  verifyUserAuth,
} from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import {
  createProductValidator,
  mongoIdParam,
  reviewValidator,
  updateProductValidator,
} from '../validators/index.js';

const router = Router();
const admin = [verifyUserAuth, roleBasedAccess('admin')];

router.get('/products', getAllProducts);
router.get('/product/:id', mongoIdParam(), validate, getSingleProduct);

router.get('/product/:id/reviews', mongoIdParam(), validate, getProductReviews);
router.put(
  '/product/:id/review',
  verifyUserAuth,
  requireVerifiedEmail,
  reviewValidator(),
  validate,
  upsertReview
);
router.delete('/review/:id', verifyUserAuth, mongoIdParam(), validate, deleteReview);

router.get('/admin/products', admin, getAdminProducts);
router.post('/admin/product', admin, createProductValidator(), validate, createProduct);
router
  .route('/admin/product/:id')
  .put(admin, updateProductValidator(), validate, updateProduct)
  .delete(admin, mongoIdParam(), validate, deleteProduct);

export default router;
