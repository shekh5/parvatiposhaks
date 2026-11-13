import { Router } from 'express';
import {
  createCoupon,
  deleteCoupon,
  getCoupons,
  updateCoupon,
  validateCoupon,
} from '../controllers/coupon.controller.js';
import { roleBasedAccess, verifyUserAuth } from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import {
  createCouponValidator,
  mongoIdParam,
  updateCouponValidator,
  validateCouponValidator,
} from '../validators/index.js';

const router = Router();
const admin = [verifyUserAuth, roleBasedAccess('admin')];

router.post('/coupon/validate', verifyUserAuth, validateCouponValidator(), validate, validateCoupon);

router
  .route('/admin/coupons')
  .get(admin, getCoupons)
  .post(admin, createCouponValidator(), validate, createCoupon);
router
  .route('/admin/coupon/:id')
  .put(admin, updateCouponValidator(), validate, updateCoupon)
  .delete(admin, mongoIdParam(), validate, deleteCoupon);

export default router;
