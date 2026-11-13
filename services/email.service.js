import config from '../config/index.js';
import logger from '../utils/logger.js';
import { sendEmail } from '../utils/sendEmail.js';

// Notification emails must never fail the request that triggered them
const sendSafely = async (options) => {
  try {
    await sendEmail(options);
    return true;
  } catch (error) {
    logger.error(`Failed to send email "${options.subject}" to ${options.email}: ${error.message}`);
    return false;
  }
};

const money = (amount) => `${config.shop.currency} ${Number(amount).toFixed(2)}`;

export const sendVerificationEmail = (user, token) =>
  sendSafely({
    email: user.email,
    subject: 'Verify your email address',
    message: `Hi ${user.name},\n\nPlease confirm your email address by opening this link:\n\n${config.frontendUrl}/verify-email/${token}\n\nThe link is valid for 24 hours. If you did not create an account, you can ignore this email.`,
  });

// This one throws, so the caller can undo the token when sending fails
export const sendPasswordResetEmail = (user, token) =>
  sendEmail({
    email: user.email,
    subject: 'Password reset request',
    message: `Use the following link to reset your password:\n\n${config.frontendUrl}/reset/${token}\n\nThe link is valid for 15 minutes. If you did not request this, please ignore this email.`,
  });

export const sendOrderConfirmationEmail = (user, order) => {
  const lines = order.orderItems
    .map(
      (item) =>
        `- ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''} x ${item.quantity}: ${money(item.price * item.quantity)}`
    )
    .join('\n');
  const payment =
    order.paymentMethod === 'cod' ? 'Cash on delivery' : `Paid online (${order.paymentStatus})`;
  return sendSafely({
    email: user.email,
    subject: `Order confirmed: ${order._id}`,
    message: `Hi ${user.name},\n\nThank you for your order.\n\n${lines}\n\nItems: ${money(order.itemsPrice)}\nDiscount: ${money(order.discount)}\nTax: ${money(order.taxPrice)}\nShipping: ${money(order.shippingPrice)}\nTotal: ${money(order.totalPrice)}\nPayment: ${payment}\n\nWe will email you when it ships.`,
  });
};

export const sendOrderStatusEmail = (user, order) =>
  sendSafely({
    email: user.email,
    subject: `Order ${order._id} is now ${order.orderStatus}`,
    message: `Hi ${user.name},\n\nYour order ${order._id} is now: ${order.orderStatus}.\n\nTotal: ${money(order.totalPrice)}`,
  });
