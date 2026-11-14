import mongoose from 'mongoose';

export const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
export const PAYMENT_METHODS = ['razorpay', 'cod'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

const orderSchema = new mongoose.Schema(
  {
    shippingInfo: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
      pinCode: { type: String, required: true },
      phoneNo: { type: String, required: true },
    },
    orderItems: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        image: { type: String, default: '' },
        product: { type: mongoose.Schema.ObjectId, ref: 'Product', required: true },
        variantId: { type: mongoose.Schema.ObjectId, default: null },
        variantLabel: { type: String, default: '' },
      },
    ],
    user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true, index: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    paymentInfo: {
      razorpayOrderId: { type: String, index: true, sparse: true },
      razorpayPaymentId: String,
      refundId: String,
      // Carried over from orders created before the payment rework
      id: String,
      status: String,
    },
    paidAt: Date,
    itemsPrice: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    coupon: { type: String, default: null },
    taxPrice: { type: Number, required: true, default: 0 },
    shippingPrice: { type: Number, required: true, default: 0 },
    totalPrice: { type: Number, required: true, default: 0 },
    // Pending means an online payment has not been confirmed yet
    orderStatus: {
      type: String,
      required: true,
      default: 'Processing',
      enum: { values: ORDER_STATUSES, message: "Order status can't be {VALUE}" },
    },
    statusHistory: [
      {
        status: String,
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
    deliveredAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

orderSchema.index({ orderStatus: 1, paymentMethod: 1, createdAt: 1 });

export default mongoose.model('Order', orderSchema);
