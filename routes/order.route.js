import { Router } from 'express';
import { getStats } from '../controllers/admin.controller.js';
import {
  cancelMyOrder,
  checkout,
  checkoutSummary,
  deleteOrder,
  getAllOrders,
  getSingleOrder,
  myOrders,
  updateOrderStatus,
  updatePaymentStatus,
} from '../controllers/order.controller.js';
import { razorpayWebhook, verifyPayment } from '../controllers/payment.controller.js';
import {
  requireVerifiedEmail,
  roleBasedAccess,
  verifyUserAuth,
} from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import {
  checkoutValidator,
  mongoIdParam,
  orderStatusValidator,
  paymentStatusValidator,
  verifyPaymentValidator,
} from '../validators/index.js';

const router = Router();
const admin = [verifyUserAuth, roleBasedAccess('admin')];

router.post('/checkout', verifyUserAuth, requireVerifiedEmail, checkoutValidator(), validate, checkout);
router.get('/checkout/summary', verifyUserAuth, checkoutSummary);
router.post('/payment/verify', verifyUserAuth, verifyPaymentValidator(), validate, verifyPayment);
// Razorpay calls this directly; it is authenticated by its signature, not a session
router.post('/payment/webhook', razorpayWebhook);

router.get('/orders/me', verifyUserAuth, myOrders);
router.get('/order/:id', verifyUserAuth, mongoIdParam(), validate, getSingleOrder);
router.post('/order/:id/cancel', verifyUserAuth, mongoIdParam(), validate, cancelMyOrder);

router.get('/admin/orders', admin, getAllOrders);
router
  .route('/admin/order/:id')
  .put(admin, orderStatusValidator(), validate, updateOrderStatus)
  .delete(admin, mongoIdParam(), validate, deleteOrder);
router.put('/admin/order/:id/payment', admin, paymentStatusValidator(), validate, updatePaymentStatus);

router.get('/admin/stats', admin, getStats);

export default router;
