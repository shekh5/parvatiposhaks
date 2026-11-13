import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/apiError.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { clearCart, loadCart } from './cart.service.js';
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from './email.service.js';
import { createRazorpayOrder } from './payment.service.js';
import { claimCoupon, computeTotals, findValidCoupon, releaseCoupon } from './pricing.service.js';
import { releaseItems, reserveItems } from './stock.service.js';

// Allowed admin moves. Pending orders move to Processing only through payment.
const TRANSITIONS = {
  Pending: ['Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

// Builds an order from the user's cart. Prices, discounts and totals come from
// the database, never from the client. Stock is reserved here.
export async function placeOrder({ user, shippingInfo, paymentMethod, couponCode }) {
  const { lines, itemsPrice } = await loadCart(user._id);
  if (lines.length === 0) throw new ApiError('Your cart is empty', 400);

  const coupon = couponCode ? await findValidCoupon(couponCode, user._id, itemsPrice) : null;
  const totals = computeTotals(itemsPrice, coupon);

  // A new online checkout replaces any earlier one still waiting for payment
  if (paymentMethod === 'razorpay') {
    const stale = await Order.find({ user: user._id, orderStatus: 'Pending' });
    for (const order of stale) {
      await cancelOrder(order, 'Replaced by a new checkout').catch(() => {});
    }
  }

  const orderItems = lines.map((line) => ({
    name: line.product.name,
    price: line.unitPrice,
    quantity: line.quantity,
    image: line.product.images?.[0]?.url || '',
    product: line.product._id,
    variantId: line.variantId || null,
    variantLabel: line.variantLabel,
  }));

  await reserveItems(orderItems);

  let couponClaimed = false;
  try {
    if (coupon) {
      couponClaimed = await claimCoupon(coupon);
      if (!couponClaimed) throw new ApiError('This coupon has reached its usage limit', 400);
    }

    const orderId = new mongoose.Types.ObjectId();
    // Nothing to charge (for example a full-value coupon): no gateway round trip
    const needsOnlinePayment = paymentMethod === 'razorpay' && totals.totalPrice > 0;
    const razorpayOrder = needsOnlinePayment
      ? await createRazorpayOrder(totals.totalPrice, orderId)
      : null;

    const paidNow = paymentMethod === 'razorpay' && !needsOnlinePayment;
    const orderStatus = needsOnlinePayment ? 'Pending' : 'Processing';
    const order = await Order.create({
      _id: orderId,
      shippingInfo,
      orderItems,
      user: user._id,
      paymentMethod,
      paymentStatus: paidNow ? 'paid' : 'pending',
      paidAt: paidNow ? new Date() : undefined,
      paymentInfo: razorpayOrder ? { razorpayOrderId: razorpayOrder.id } : {},
      ...totals,
      coupon: coupon ? coupon.code : null,
      orderStatus,
      statusHistory: [
        { status: orderStatus, note: needsOnlinePayment ? 'Awaiting payment' : 'Order placed' },
      ],
    });

    if (!needsOnlinePayment) {
      await clearCart(user._id);
      await sendOrderConfirmationEmail(user, order);
    }

    return {
      order,
      payment: razorpayOrder
        ? {
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: config.shop.currency,
            keyId: config.razorpay.keyId,
          }
        : null,
    };
  } catch (error) {
    await releaseItems(orderItems);
    if (couponClaimed) await releaseCoupon(coupon.code);
    throw error;
  }
}

// Marks an online order as paid. Safe to call more than once for the same
// payment (the client callback and the webhook usually both arrive).
export async function markOrderPaid(razorpayOrderId, razorpayPaymentId) {
  const paid = await Order.findOneAndUpdate(
    { 'paymentInfo.razorpayOrderId': razorpayOrderId, orderStatus: 'Pending' },
    {
      $set: {
        paymentStatus: 'paid',
        paidAt: new Date(),
        orderStatus: 'Processing',
        'paymentInfo.razorpayPaymentId': razorpayPaymentId,
        'paymentInfo.status': 'captured',
      },
      $push: { statusHistory: { status: 'Processing', note: 'Payment received' } },
    },
    { new: true }
  );

  if (paid) {
    await clearCart(paid.user);
    const user = await User.findById(paid.user);
    if (user) await sendOrderConfirmationEmail(user, paid);
    return { order: paid, newlyPaid: true };
  }

  const order = await Order.findOne({ 'paymentInfo.razorpayOrderId': razorpayOrderId });
  if (!order) return { order: null, newlyPaid: false };

  // Money arrived for an order that had already been cancelled and whose stock
  // was released. Record it so an admin can refund; do not revive the order.
  if (order.orderStatus === 'Cancelled' && order.paymentStatus !== 'paid') {
    order.paymentStatus = 'paid';
    order.paidAt = new Date();
    order.paymentInfo.razorpayPaymentId = razorpayPaymentId;
    order.paymentInfo.status = 'captured';
    order.statusHistory.push({
      status: 'Cancelled',
      note: 'Payment received after cancellation; refund required',
    });
    await order.save();
    logger.error(`Payment ${razorpayPaymentId} captured for cancelled order ${order._id}; refund required`);
  }
  return { order, newlyPaid: false };
}

export async function recordPaymentFailure(razorpayOrderId, reason) {
  await Order.updateOne(
    { 'paymentInfo.razorpayOrderId': razorpayOrderId, orderStatus: 'Pending' },
    {
      $set: { 'paymentInfo.status': 'failed' },
      $push: { statusHistory: { status: 'Pending', note: `Payment attempt failed: ${reason}` } },
    }
  );
}

// Cancels an order that has not shipped and puts its stock and coupon use back.
// The status flip is conditional, so stock is released exactly once.
export async function cancelOrder(order, note = 'Cancelled') {
  const refundNote = order.paymentStatus === 'paid' ? `${note}; refund required` : note;
  const cancelled = await Order.findOneAndUpdate(
    { _id: order._id, orderStatus: { $in: ['Pending', 'Processing'] } },
    {
      $set: { orderStatus: 'Cancelled', cancelledAt: new Date() },
      $push: { statusHistory: { status: 'Cancelled', note: refundNote } },
    },
    { new: true }
  );
  if (!cancelled) {
    throw new ApiError(`An order that is ${order.orderStatus} cannot be cancelled`, 400);
  }
  await releaseItems(cancelled.orderItems);
  await releaseCoupon(cancelled.coupon);
  return cancelled;
}

export async function changeOrderStatus(order, nextStatus) {
  const allowed = TRANSITIONS[order.orderStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new ApiError(
      `Cannot change an order from ${order.orderStatus} to ${nextStatus}`,
      400
    );
  }

  let updated;
  if (nextStatus === 'Cancelled') {
    updated = await cancelOrder(order, 'Cancelled by admin');
  } else {
    order.orderStatus = nextStatus;
    if (nextStatus === 'Delivered') order.deliveredAt = new Date();
    order.statusHistory.push({ status: nextStatus });
    updated = await order.save();
  }

  const user = await User.findById(updated.user);
  if (user) await sendOrderStatusEmail(user, updated);
  return updated;
}

// Online orders that were never paid hold stock; release it after the window
export async function expirePendingOrders() {
  const cutoff = new Date(Date.now() - config.shop.pendingPaymentMinutes * 60 * 1000);
  const stale = await Order.find({ orderStatus: 'Pending', createdAt: { $lt: cutoff } });
  let expired = 0;
  for (const order of stale) {
    try {
      await cancelOrder(order, 'Payment was not completed in time');
      expired += 1;
    } catch {
      // Paid or cancelled in the meantime; nothing to do
    }
  }
  return expired;
}
