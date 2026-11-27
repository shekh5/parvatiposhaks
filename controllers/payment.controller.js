import Order from '../models/order.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';
import { markOrderPaid, recordPaymentFailure } from '../services/order.service.js';
import { verifyPaymentSignature, verifyWebhookSignature } from '../services/payment.service.js';

// Called by the client after Razorpay checkout succeeds
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const owned = await Order.exists({
    'paymentInfo.razorpayOrderId': razorpay_order_id,
    user: req.user._id,
  });
  if (!owned) throw new ApiError('Order not found', 404);

  if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    throw new ApiError('Payment verification failed', 400);
  }

  const { order } = await markOrderPaid(razorpay_order_id, razorpay_payment_id);
  if (order.orderStatus === 'Cancelled') {
    throw new ApiError(
      'This order was cancelled before the payment arrived. The amount will be refunded',
      409
    );
  }
  sendResponse(res, 200, 'Payment verified successfully', { order });
});

// Called by Razorpay's servers. Covers buyers who close the tab before the
// client callback runs. Always answers 200 once the signature is valid, so
// Razorpay does not retry events that were handled.
export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  if (!verifyWebhookSignature(req.rawBody, signature)) {
    throw new ApiError('Invalid webhook signature', 400);
  }

  const event = req.body?.event;
  const payment = req.body?.payload?.payment?.entity;

  if (payment?.order_id) {
    if (event === 'payment.captured') {
      await markOrderPaid(payment.order_id, payment.id);
    } else if (event === 'payment.failed') {
      await recordPaymentFailure(payment.order_id, payment.error_description || 'unknown reason');
    }
  } else {
    logger.info(`Ignored Razorpay webhook event: ${event}`);
  }

  res.status(200).json({ success: true });
});
