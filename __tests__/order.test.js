import mongoose from 'mongoose';
import {
  api,
  createProduct,
  lastEmailTo,
  shippingInfo,
  signUp,
  signUpAdmin,
  startApp,
  stopApp,
} from './helpers/harness.js';

let admin;
beforeAll(async () => {
  await startApp();
  admin = await signUpAdmin();
});
afterAll(stopApp);

const placeOrder = async (product, quantity = 1) => {
  const session = await signUp();
  await session.agent.post(api('/cart/items')).send({ productId: product._id, quantity });
  const res = await session.agent.post(api('/checkout')).send({ shippingInfo, paymentMethod: 'cod' });
  expect(res.status).toBe(201);
  return { ...session, order: res.body.data.order };
};

const setStatus = (id, status) => admin.agent.put(api(`/admin/order/${id}`)).send({ status });
const stockOf = async (product) => (await mongoose.model('Product').findById(product._id)).stock;

describe('viewing orders', () => {
  it('shows buyers their own orders only', async () => {
    const product = await createProduct();
    const buyer = await placeOrder(product);
    const stranger = await signUp();

    const mine = await buyer.agent.get(api('/orders/me'));
    expect(mine.body.data.orders.map((o) => o._id)).toEqual([buyer.order._id]);
    expect((await stranger.agent.get(api('/orders/me'))).body.data.orders).toEqual([]);

    expect((await buyer.agent.get(api(`/order/${buyer.order._id}`))).status).toBe(200);
    expect((await stranger.agent.get(api(`/order/${buyer.order._id}`))).status).toBe(404);
    const asAdmin = await admin.agent.get(api(`/order/${buyer.order._id}`));
    expect(asAdmin.body.data.order.user.email).toBe(buyer.user.email);

    expect((await stranger.agent.post(api(`/order/${buyer.order._id}/cancel`))).status).toBe(404);
    expect((await buyer.agent.get(api('/admin/orders'))).status).toBe(403);
  });
});

describe('order status', () => {
  it('moves Processing to Shipped to Delivered, saves it and emails the buyer', async () => {
    const product = await createProduct({ stock: 5 });
    const { order, user } = await placeOrder(product, 2);
    expect(await stockOf(product)).toBe(3);

    const shipped = await setStatus(order._id, 'Shipped');
    expect(shipped.status).toBe(200);
    expect(shipped.body.data.order.orderStatus).toBe('Shipped');
    expect(lastEmailTo(user.email).subject).toContain('Shipped');

    const delivered = await setStatus(order._id, 'Delivered');
    expect(delivered.body.data.order.deliveredAt).toEqual(expect.any(String));

    const stored = await mongoose.model('Order').findById(order._id);
    expect(stored.orderStatus).toBe('Delivered');
    expect(stored.deliveredAt).toBeInstanceOf(Date);
    expect(stored.statusHistory.map((h) => h.status)).toEqual(['Processing', 'Shipped', 'Delivered']);

    // Stock was taken once, at checkout, and status changes leave it alone
    expect(await stockOf(product)).toBe(3);
  });

  it('refuses skipped, backward and unknown transitions', async () => {
    const product = await createProduct();
    const { order } = await placeOrder(product);
    expect((await setStatus(order._id, 'Delivered')).status).toBe(400);
    expect((await setStatus(order._id, 'Pending')).status).toBe(400);
    expect((await setStatus(order._id, 'Lost')).status).toBe(400);
    await setStatus(order._id, 'Shipped');
    expect((await setStatus(order._id, 'Processing')).status).toBe(400);
    expect((await setStatus(order._id, 'Cancelled')).status).toBe(400);
    await setStatus(order._id, 'Delivered');
    expect((await setStatus(order._id, 'Shipped')).status).toBe(400);
  });

  it('lets buyers cancel before shipping but not after', async () => {
    const product = await createProduct({ stock: 2 });
    const first = await placeOrder(product);
    const second = await placeOrder(product);
    expect(await stockOf(product)).toBe(0);

    expect((await first.agent.post(api(`/order/${first.order._id}/cancel`))).status).toBe(200);
    expect(await stockOf(product)).toBe(1);

    await setStatus(second.order._id, 'Shipped');
    expect((await second.agent.post(api(`/order/${second.order._id}/cancel`))).status).toBe(400);
    expect(await stockOf(product)).toBe(1);
  });

  it('lets an admin cancel, which releases stock', async () => {
    const product = await createProduct({ stock: 2 });
    const { order } = await placeOrder(product, 2);
    const res = await setStatus(order._id, 'Cancelled');
    expect(res.status).toBe(200);
    expect(await stockOf(product)).toBe(2);
  });
});

describe('payment status and deletion', () => {
  it('records cash collected, then a refund', async () => {
    const product = await createProduct();
    const { order } = await placeOrder(product);
    const pay = (paymentStatus) =>
      admin.agent.put(api(`/admin/order/${order._id}/payment`)).send({ paymentStatus });

    expect((await pay('refunded')).status).toBe(400);
    const paid = await pay('paid');
    expect(paid.body.data.order).toMatchObject({ paymentStatus: 'paid' });
    expect(paid.body.data.order.paidAt).toEqual(expect.any(String));
    expect((await pay('paid')).status).toBe(400);
    expect((await pay('refunded')).body.data.order.paymentStatus).toBe('refunded');
  });

  it('deletes only delivered or cancelled orders', async () => {
    const product = await createProduct();
    const { order } = await placeOrder(product);
    expect((await admin.agent.delete(api(`/admin/order/${order._id}`))).status).toBe(400);
    await setStatus(order._id, 'Cancelled');
    expect((await admin.agent.delete(api(`/admin/order/${order._id}`))).status).toBe(200);
    expect(await mongoose.model('Order').findById(order._id)).toBeNull();
  });
});

describe('admin overview', () => {
  it('lists orders with pagination and reports stats', async () => {
    await mongoose.model('Order').deleteMany({});
    const kurta = await createProduct({ name: 'Stats Kurta', price: 400, stock: 20 });
    const saree = await createProduct({ name: 'Stats Saree', price: 2000, stock: 3 });

    const a = await placeOrder(kurta, 3); // 1200 + 120 tax, free shipping = 1320
    await placeOrder(saree, 1); // 2000 + 200 tax = 2200
    const c = await placeOrder(kurta, 1);
    await admin.agent.put(api(`/admin/order/${a.order._id}/payment`)).send({ paymentStatus: 'paid' });
    await setStatus(c.order._id, 'Cancelled');

    const list = await admin.agent.get(api('/admin/orders?limit=2'));
    expect(list.body.data).toMatchObject({ count: 3, totalPages: 2, totalAmount: 1320 });
    expect(list.body.data.orders).toHaveLength(2);
    const filtered = await admin.agent.get(api('/admin/orders?status=Cancelled'));
    expect(filtered.body.data.count).toBe(1);

    const stats = (await admin.agent.get(api('/admin/stats'))).body.data;
    expect(stats).toMatchObject({
      revenue: 1320,
      paidOrders: 1,
      totalOrders: 3,
      ordersByStatus: { Processing: 2, Cancelled: 1 },
    });
    expect(stats.topProducts[0]).toMatchObject({ name: 'Stats Kurta', unitsSold: 3, sales: 1200 });
    expect(stats.topProducts[1]).toMatchObject({ name: 'Stats Saree', unitsSold: 1 });
    expect(stats.lowStock.map((p) => p.name)).toContain('Stats Saree');
    expect(stats.lowStock.map((p) => p.name)).not.toContain('Stats Kurta');
    expect(stats.totalUsers).toBeGreaterThanOrEqual(4);
  });
});
