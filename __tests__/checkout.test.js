import mongoose from 'mongoose';
import request from 'supertest';
import {
  api,
  createProduct,
  lastEmailTo,
  paymentSignature,
  razorpay,
  razorpayOrders,
  shippingInfo,
  signUp,
  signUpAdmin,
  startApp,
  stopApp,
  webhookSignature,
  withConfig,
  razorpayRefunds,
} from './helpers/harness.js';

let app;
let admin;
beforeAll(async () => {
  app = await startApp();
  admin = await signUpAdmin();
});
afterAll(stopApp);

const stockOf = async (product) => (await mongoose.model('Product').findById(product._id)).stock;
const Order = () => mongoose.model('Order');

// A signed-in shopper with `quantity` of one product in the cart
const shopper = async (product, quantity = 1, variantId) => {
  const session = await signUp();
  const res = await session.agent
    .post(api('/cart/items'))
    .send({ productId: product._id, quantity, variantId });
  expect(res.status).toBe(201);
  return session;
};

const checkout = (agent, extra = {}) =>
  agent.post(api('/checkout')).send({ shippingInfo, paymentMethod: 'cod', ...extra });

const sendWebhook = (payload, signature) => {
  const raw = JSON.stringify(payload);
  return request(app)
    .post(api('/payment/webhook'))
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', signature ?? webhookSignature(raw))
    .send(raw);
};

const captured = (orderId, paymentId) => ({
  event: 'payment.captured',
  payload: { payment: { entity: { id: paymentId, order_id: orderId } } },
});

describe('cash on delivery checkout', () => {
  it('prices the order on the server, takes stock, clears the cart and emails', async () => {
    const product = await createProduct({ price: 400, stock: 5 });
    const { agent, user } = await shopper(product, 2);

    // Client-supplied prices must be ignored
    const res = await checkout(agent, { totalPrice: 1, itemsPrice: 1, orderItems: [{ price: 1 }] });
    expect(res.status).toBe(201);
    const { order, payment } = res.body.data;
    expect(payment).toBeNull();
    expect(order).toMatchObject({
      itemsPrice: 800,
      discount: 0,
      taxPrice: 80,
      shippingPrice: 50,
      totalPrice: 930,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      orderStatus: 'Processing',
    });
    expect(order.orderItems[0]).toMatchObject({ price: 400, quantity: 2, name: product.name });
    expect(order.paidAt).toBeUndefined();

    expect(await stockOf(product)).toBe(3);
    expect((await agent.get(api('/cart'))).body.data.cart.items).toEqual([]);
    expect(lastEmailTo(user.email).subject).toContain('Order confirmed');
  });

  it('rejects an empty cart, bad shipping details and unknown payment methods', async () => {
    const { agent } = await signUp();
    expect((await checkout(agent)).status).toBe(400);

    const product = await createProduct();
    const buyer = await shopper(product);
    const badPhone = await checkout(buyer.agent, { shippingInfo: { ...shippingInfo, phoneNo: '12' } });
    expect(badPhone.status).toBe(400);
    expect((await checkout(buyer.agent, { paymentMethod: 'bitcoin' })).status).toBe(400);
    expect(await stockOf(product)).toBe(10);
  });

  it('gives free shipping above the threshold', async () => {
    const product = await createProduct({ price: 1200 });
    const { agent } = await shopper(product);
    const res = await checkout(agent);
    expect(res.body.data.order).toMatchObject({ shippingPrice: 0, taxPrice: 120, totalPrice: 1320 });
  });

  it('never oversells when two buyers race for the last unit', async () => {
    const product = await createProduct({ stock: 1 });
    const first = await shopper(product);
    const second = await shopper(product);

    const results = await Promise.all([checkout(first.agent), checkout(second.agent)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await stockOf(product)).toBe(0);
    expect(await Order().countDocuments({ 'orderItems.product': product._id })).toBe(1);
  });

  it('puts back stock already taken when a later item is unavailable', async () => {
    const plenty = await createProduct({ stock: 5 });
    const scarce = await createProduct({ stock: 1 });
    const { agent } = await shopper(plenty, 2);
    await agent.post(api('/cart/items')).send({ productId: scarce._id });
    await mongoose.model('Product').updateOne({ _id: scarce._id }, { stock: 0 });

    expect((await checkout(agent)).status).toBe(409);
    expect(await stockOf(plenty)).toBe(5);
  });

  it('takes stock from the chosen variant', async () => {
    const product = await createProduct({
      price: 800,
      variants: [
        { size: 'M', stock: 2 },
        { size: 'L', stock: 3, price: 900 },
      ],
    });
    const large = product.variants[1];
    const { agent } = await shopper(product, 2, large._id);
    const res = await checkout(agent);
    expect(res.status).toBe(201);
    expect(res.body.data.order.orderItems[0]).toMatchObject({ price: 900, variantLabel: 'L' });

    const stored = await mongoose.model('Product').findById(product._id);
    expect(stored.variants.map((v) => v.stock)).toEqual([2, 1]);
    expect(stored.stock).toBe(3);
  });
});

describe('coupons', () => {
  const makeCoupon = (body) => admin.agent.post(api('/admin/coupons')).send(body);

  it('is admin-only to manage and validates input', async () => {
    const { agent } = await signUp();
    expect((await agent.get(api('/admin/coupons'))).status).toBe(403);
    const bad = await makeCoupon({ code: 'BIG', type: 'percent', value: 150 });
    expect(bad.status).toBe(400);
  });

  it('applies a capped percent discount before tax', async () => {
    await makeCoupon({ code: 'festive20', type: 'percent', value: 20, maxDiscount: 100 });
    const product = await createProduct({ price: 400 });
    const { agent } = await shopper(product, 2);

    const preview = await agent.post(api('/coupon/validate')).send({ code: 'FESTIVE20' });
    expect(preview.status).toBe(200);
    expect(preview.body.data).toMatchObject({ code: 'FESTIVE20', discount: 100, totalPrice: 820 });

    const res = await checkout(agent, { couponCode: 'festive20' });
    expect(res.body.data.order).toMatchObject({
      coupon: 'FESTIVE20',
      discount: 100,
      taxPrice: 70,
      shippingPrice: 50,
      totalPrice: 820,
    });
  });

  it('enforces minimum order, expiry, per-user and total limits', async () => {
    await makeCoupon({ code: 'MIN5000', type: 'flat', value: 100, minOrderValue: 5000 });
    await makeCoupon({ code: 'OLD', type: 'flat', value: 100, expiresAt: '2020-01-01' });
    await makeCoupon({ code: 'ONCE', type: 'flat', value: 50, usageLimit: 1, perUserLimit: 5 });
    await makeCoupon({ code: 'PERUSER', type: 'flat', value: 50 });
    const product = await createProduct({ stock: 50 });

    const buyer = await shopper(product);
    for (const code of ['MIN5000', 'OLD', 'NOPE']) {
      expect((await checkout(buyer.agent, { couponCode: code })).status).toBe(400);
    }
    expect(await stockOf(product)).toBe(50);

    expect((await checkout(buyer.agent, { couponCode: 'PERUSER' })).status).toBe(201);
    await buyer.agent.post(api('/cart/items')).send({ productId: product._id });
    expect((await checkout(buyer.agent, { couponCode: 'PERUSER' })).status).toBe(400);

    expect((await checkout(buyer.agent, { couponCode: 'ONCE' })).status).toBe(201);
    const other = await shopper(product);
    expect((await checkout(other.agent, { couponCode: 'ONCE' })).status).toBe(400);
  });

  it('gives the coupon use and the stock back when the order is cancelled', async () => {
    await makeCoupon({ code: 'RETURNME', type: 'flat', value: 50, usageLimit: 1 });
    const product = await createProduct({ stock: 3 });
    const { agent } = await shopper(product, 2);
    const placed = await checkout(agent, { couponCode: 'RETURNME' });
    expect(await stockOf(product)).toBe(1);

    const cancelled = await agent.post(api(`/order/${placed.body.data.order._id}/cancel`));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.order.orderStatus).toBe('Cancelled');
    expect(await stockOf(product)).toBe(3);
    expect((await mongoose.model('Coupon').findOne({ code: 'RETURNME' })).usedCount).toBe(0);

    // Cancelling twice must not release stock twice
    expect((await agent.post(api(`/order/${placed.body.data.order._id}/cancel`))).status).toBe(400);
    expect(await stockOf(product)).toBe(3);
  });
});

describe('razorpay checkout', () => {
  const start = async (product, quantity = 1) => {
    const session = await shopper(product, quantity);
    const res = await checkout(session.agent, { paymentMethod: 'razorpay' });
    expect(res.status).toBe(201);
    return { ...session, ...res.body.data };
  };

  it('creates a pending order, holds stock and keeps the cart until payment', async () => {
    const product = await createProduct({ price: 400, stock: 5 });
    const { agent, order, payment } = await start(product, 2);

    expect(order).toMatchObject({ orderStatus: 'Pending', paymentStatus: 'pending', totalPrice: 930 });
    expect(payment).toMatchObject({ amount: 93000, currency: 'INR', keyId: 'rzp_test_key' });
    expect(payment.razorpayOrderId).toBe(order.paymentInfo.razorpayOrderId);
    expect(razorpayOrders.at(-1)).toMatchObject({ amount: 93000, receipt: order._id });
    expect(await stockOf(product)).toBe(3);
    expect((await agent.get(api('/cart'))).body.data.cart.items).toHaveLength(1);
  });

  it('rejects a wrong signature and accepts the right one, once', async () => {
    const product = await createProduct({ stock: 5 });
    const { agent, user, order, payment } = await start(product);
    const body = {
      razorpay_order_id: payment.razorpayOrderId,
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'deadbeef',
    };

    expect((await agent.post(api('/payment/verify')).send(body)).status).toBe(400);
    expect((await Order().findById(order._id)).paymentStatus).toBe('pending');

    body.razorpay_signature = paymentSignature(payment.razorpayOrderId, 'pay_1');
    const stranger = await signUp();
    expect((await stranger.agent.post(api('/payment/verify')).send(body)).status).toBe(404);

    const ok = await agent.post(api('/payment/verify')).send(body);
    expect(ok.status).toBe(200);
    expect(ok.body.data.order).toMatchObject({ paymentStatus: 'paid', orderStatus: 'Processing' });
    expect(ok.body.data.order.paidAt).toEqual(expect.any(String));
    expect((await agent.get(api('/cart'))).body.data.cart.items).toEqual([]);
    expect(lastEmailTo(user.email).subject).toContain('Order confirmed');

    // The webhook for the same payment, and a repeated verify, change nothing
    const hook = await sendWebhook(captured(payment.razorpayOrderId, 'pay_1'));
    expect(hook.status).toBe(200);
    expect((await agent.post(api('/payment/verify')).send(body)).status).toBe(200);
    const stored = await Order().findById(order._id);
    expect(stored.statusHistory.filter((h) => h.note === 'Payment received')).toHaveLength(1);
    expect(await stockOf(product)).toBe(4);
  });

  it('confirms payment from the webhook alone and rejects forged webhooks', async () => {
    const product = await createProduct();
    const { order, payment } = await start(product);

    const forged = await sendWebhook(captured(payment.razorpayOrderId, 'pay_2'), 'bad');
    expect(forged.status).toBe(400);
    expect((await Order().findById(order._id)).paymentStatus).toBe('pending');

    expect((await sendWebhook(captured(payment.razorpayOrderId, 'pay_2'))).status).toBe(200);
    const stored = await Order().findById(order._id);
    expect(stored).toMatchObject({ paymentStatus: 'paid', orderStatus: 'Processing' });
    expect(stored.paymentInfo.razorpayPaymentId).toBe('pay_2');

    expect((await sendWebhook({ event: 'order.paid', payload: {} })).status).toBe(200);
  });

  it('records a failed attempt without cancelling the order', async () => {
    const product = await createProduct();
    const { order, payment } = await start(product);
    const res = await sendWebhook({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: { id: 'pay_f', order_id: payment.razorpayOrderId, error_description: 'card declined' },
        },
      },
    });
    expect(res.status).toBe(200);
    const stored = await Order().findById(order._id);
    expect(stored.orderStatus).toBe('Pending');
    expect(stored.statusHistory.at(-1).note).toContain('card declined');
  });

  it('releases everything when the gateway is down', async () => {
    const product = await createProduct({ stock: 2 });
    const { agent } = await shopper(product);
    razorpay.failNext = true;
    const res = await checkout(agent, { paymentMethod: 'razorpay' });
    expect(res.status).toBe(502);
    expect(await stockOf(product)).toBe(2);
    expect(await Order().countDocuments({ 'orderItems.product': product._id })).toBe(0);
  });

  it('replaces an unpaid checkout when the buyer checks out again', async () => {
    const product = await createProduct({ stock: 5 });
    const { agent, order } = await start(product, 2);
    const again = await checkout(agent, { paymentMethod: 'razorpay' });
    expect(again.status).toBe(201);
    expect((await Order().findById(order._id)).orderStatus).toBe('Cancelled');
    expect(await stockOf(product)).toBe(3);
  });

  it('expires unpaid orders after the payment window and flags late payments', async () => {
    const { expirePendingOrders } = await import('../services/order.service.js');
    const product = await createProduct({ stock: 4 });
    const { order, payment } = await start(product, 3);
    expect(await stockOf(product)).toBe(1);

    expect(await expirePendingOrders()).toBe(0); // still inside the window

    await Order().collection.updateOne(
      { _id: new mongoose.Types.ObjectId(order._id) },
      { $set: { createdAt: new Date(Date.now() - 31 * 60 * 1000) } }
    );
    expect(await expirePendingOrders()).toBe(1);
    expect((await Order().findById(order._id)).orderStatus).toBe('Cancelled');
    expect(await stockOf(product)).toBe(4);

    // Money that arrives afterwards is sent straight back; the order stays cancelled
    await sendWebhook(captured(payment.razorpayOrderId, 'pay_late'));
    const stored = await Order().findById(order._id);
    expect(stored).toMatchObject({ orderStatus: 'Cancelled', paymentStatus: 'refunded' });
    expect(stored.statusHistory.at(-1).note).toBe('Refund issued');
    expect(razorpayRefunds.at(-1)).toMatchObject({ payment_id: 'pay_late', amount: order.totalPrice * 100 });
    expect(await stockOf(product)).toBe(4);

    // The same webhook again must not refund twice
    const refundsSoFar = razorpayRefunds.length;
    await sendWebhook(captured(payment.razorpayOrderId, 'pay_late'));
    expect(razorpayRefunds.length).toBe(refundsSoFar);
  });

  it('refunds a paid order automatically when it is cancelled', async () => {
    const product = await createProduct({ price: 400, stock: 3 });
    const { agent, order, payment } = await start(product, 2);
    await agent.post(api('/payment/verify')).send({
      razorpay_order_id: payment.razorpayOrderId,
      razorpay_payment_id: 'pay_refund_me',
      razorpay_signature: paymentSignature(payment.razorpayOrderId, 'pay_refund_me'),
    });

    const res = await agent.post(api(`/order/${order._id}/cancel`));
    expect(res.status).toBe(200);
    expect(res.body.data.order).toMatchObject({ orderStatus: 'Cancelled', paymentStatus: 'refunded' });
    expect(razorpayRefunds.at(-1)).toMatchObject({ payment_id: 'pay_refund_me', amount: 93000 });
    expect(res.body.data.order.paymentInfo.refundId).toBe(razorpayRefunds.at(-1).id);
    expect(await stockOf(product)).toBe(3);
  });

  it('flags the order for a manual refund when the gateway refuses', async () => {
    const product = await createProduct();
    const { agent, order, payment } = await start(product);
    await agent.post(api('/payment/verify')).send({
      razorpay_order_id: payment.razorpayOrderId,
      razorpay_payment_id: 'pay_stuck',
      razorpay_signature: paymentSignature(payment.razorpayOrderId, 'pay_stuck'),
    });

    razorpay.failNextRefund = true;
    const res = await agent.post(api(`/order/${order._id}/cancel`));
    expect(res.status).toBe(200);
    expect(res.body.data.order).toMatchObject({ orderStatus: 'Cancelled', paymentStatus: 'paid' });
    expect(res.body.data.order.statusHistory.at(-1).note).toMatch(/refund required/);

    // An admin can then record the refund made by hand
    const marked = await admin.agent
      .put(api(`/admin/order/${order._id}/payment`))
      .send({ paymentStatus: 'refunded' });
    expect(marked.body.data.order.paymentStatus).toBe('refunded');
  });

  it('never lets one shopper claim a once-per-person coupon twice at the same moment', async () => {
    const { claimCoupon, releaseCoupon } = await import('../services/pricing.service.js');
    await admin.agent.post(api('/admin/coupons')).send({ code: 'RACE', type: 'flat', value: 10, usageLimit: 3 });
    const coupon = await mongoose.model('Coupon').findOne({ code: 'RACE' });
    const shopperId = new mongoose.Types.ObjectId();
    const otherId = new mongoose.Types.ObjectId();

    const claims = await Promise.all([1, 2, 3, 4].map(() => claimCoupon(coupon, shopperId)));
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await claimCoupon(coupon, otherId)).toBe(true);
    expect((await mongoose.model('Coupon').findOne({ code: 'RACE' })).usedCount).toBe(2);

    await releaseCoupon('RACE', shopperId);
    expect(await claimCoupon(coupon, shopperId)).toBe(true);
    expect(await claimCoupon(coupon, new mongoose.Types.ObjectId())).toBe(true);
    // Total limit of 3 is now reached
    expect(await claimCoupon(coupon, new mongoose.Types.ObjectId())).toBe(false);

    const listed = await admin.agent.get(api('/admin/coupons'));
    expect(listed.body.data.coupons.find((c) => c.code === 'RACE').usedBy).toBeUndefined();
  });

  it('skips the gateway when a coupon covers the whole order', async () => {
    await admin.agent.post(api('/admin/coupons')).send({ code: 'FREE', type: 'percent', value: 100 });
    const product = await createProduct({ price: 2000 });
    const { agent } = await shopper(product);
    const before = razorpayOrders.length;

    // Shipping is still charged on a fully discounted order, so remove it here
    const res = await withConfig('shop.shippingFee', 0, () =>
      checkout(agent, { paymentMethod: 'razorpay', couponCode: 'FREE' })
    );
    expect(res.status).toBe(201);
    expect(res.body.data.payment).toBeNull();
    expect(res.body.data.order).toMatchObject({
      totalPrice: 0,
      paymentStatus: 'paid',
      orderStatus: 'Processing',
    });
    expect(razorpayOrders.length).toBe(before);
  });
});
