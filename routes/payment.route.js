import { Router } from 'express';
import { razorpayWebhook, verifyPayment } from '../controllers/payment.controller.js';
import { verifyUserAuth } from '../middleware/auth.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { verifyPaymentValidator } from '../validators/index.js';

const router = Router();

router.post('/payment/verify', verifyUserAuth, verifyPaymentValidator(), validate, verifyPayment);
// Razorpay calls this directly; it is authenticated by its signature, not a session
router.post('/payment/webhook', razorpayWebhook);

export default router;
