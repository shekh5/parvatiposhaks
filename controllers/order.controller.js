import Order from '../models/order.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { cancelOrder, changeOrderStatus, placeOrder } from '../services/order.service.js';

export const checkout = asyncHandler(async (req, res) => {
  const { shippingInfo, paymentMethod, couponCode } = req.body;
  const { order, payment } = await placeOrder({
    user: req.user,
    shippingInfo,
    paymentMethod,
    couponCode,
  });
  const message = payment ? 'Order created. Complete the payment to confirm it' : 'Order placed successfully';
  sendResponse(res, 201, message, { order, payment });
});

export const myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  sendResponse(res, 200, 'Orders retrieved successfully', { orders, count: orders.length });
});

// Owners can see their own order; admins can see any
export const getSingleOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  const isOwner = order && String(order.user?._id) === String(req.user._id);
  if (!order || (!isOwner && req.user.role !== 'admin')) {
    throw new ApiError('Order not found', 404);
  }
  sendResponse(res, 200, 'Order retrieved successfully', { order });
});

export const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new ApiError('Order not found', 404);
  const cancelled = await cancelOrder(order, 'Cancelled by customer');
  sendResponse(res, 200, 'Order cancelled', { order: cancelled });
});

// ---------- admin ----------
export const getAllOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = typeof req.query.status === 'string' ? { orderStatus: req.query.status } : {};

  const [orders, count, revenue] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
  ]);

  sendResponse(res, 200, 'Orders retrieved successfully', {
    orders,
    count,
    currentPage: page,
    totalPages: Math.ceil(count / limit),
    totalAmount: revenue[0]?.total || 0,
  });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError('Order not found', 404);
  const updated = await changeOrderStatus(order, req.body.status);
  sendResponse(res, 200, 'Order status updated successfully', { order: updated });
});

// Records cash collected on delivery, or a refund made outside this system
export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError('Order not found', 404);

  const { paymentStatus } = req.body;
  if (paymentStatus === 'paid') {
    if (order.paymentMethod !== 'cod') {
      throw new ApiError('Online payments are confirmed by the payment gateway', 400);
    }
    if (order.paymentStatus === 'paid') throw new ApiError('Order is already paid', 400);
    if (order.orderStatus === 'Cancelled') throw new ApiError('Order is cancelled', 400);
    order.paidAt = new Date();
  } else if (order.paymentStatus !== 'paid') {
    throw new ApiError('Only a paid order can be marked refunded', 400);
  }

  order.paymentStatus = paymentStatus;
  order.statusHistory.push({ status: order.orderStatus, note: `Payment marked ${paymentStatus}` });
  await order.save();
  sendResponse(res, 200, 'Payment status updated successfully', { order });
});

export const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError('Order not found', 404);
  if (!['Delivered', 'Cancelled'].includes(order.orderStatus)) {
    throw new ApiError('Only delivered or cancelled orders can be deleted', 400);
  }
  await order.deleteOne();
  sendResponse(res, 200, 'Order deleted successfully');
});
