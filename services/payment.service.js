import crypto from 'crypto';
import Razorpay from 'razorpay';
import config from '../config/index.js';
import ApiError from '../utils/apiError.js';
import logger from '../utils/logger.js';

let client;

const getClient = () => {
  const { keyId, keySecret } = config.razorpay;
  if (!keyId || !keySecret) {
    throw new ApiError('Online payments are not configured', 503);
  }
  if (!client) client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
};

export async function createRazorpayOrder(amount, receipt) {
  try {
    return await getClient().orders.create({
      amount: Math.round(amount * 100), // Razorpay works in the smallest currency unit
      currency: config.shop.currency,
      receipt: String(receipt),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error(`Razorpay order creation failed: ${error?.error?.description || error.message}`);
    throw new ApiError('Could not start the payment. Please try again', 502);
  }
}

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const hmac = (secret, payload) => crypto.createHmac('sha256', secret).update(payload).digest('hex');

// Checkout signature: HMAC of "<order id>|<payment id>" with the key secret
export function verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, signature) {
  const { keySecret } = config.razorpay;
  if (!keySecret || !signature) return false;
  return safeEqual(hmac(keySecret, `${razorpayOrderId}|${razorpayPaymentId}`), signature);
}

// Webhook signature: HMAC of the raw request body with the webhook secret
export function verifyWebhookSignature(rawBody, signature) {
  const { webhookSecret } = config.razorpay;
  if (!webhookSecret || !signature || !rawBody) return false;
  return safeEqual(hmac(webhookSecret, rawBody), signature);
}
