import mongoose from 'mongoose';
import request from 'supertest';
import {
  api,
  createProduct,
  lastEmailTo,
  shippingInfo,
  signUp,
  signUpAdmin,
  startApp,
  stopApp,
  withConfig,
} from './helpers/harness.js';

let app;
beforeAll(async () => {
  app = await startApp();
});
afterAll(stopApp);

describe('cart sync', () => {
  it('replaces the whole cart in one call and merges duplicate lines', async () => {
    const { agent } = await signUp();
    const old = await createProduct();
    const kurta = await createProduct({ price: 400, stock: 5 });
    const saree = await createProduct({ price: 1000, stock: 2 });
    await agent.post(api('/cart/items')).send({ productId: old._id });

    const res = await agent.put(api('/cart')).send({
      items: [
        { productId: kurta._id, quantity: 2 },
        { productId: saree._id, quantity: 1 },
        { productId: kurta._id, quantity: 1 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.cart).toMatchObject({ totalItems: 4, itemsPrice: 2200 });
    expect(res.body.data.cart.items).toHaveLength(2);

    const emptied = await agent.put(api('/cart')).send({ items: [] });
    expect(emptied.body.data.cart.items).toEqual([]);
  });

  it('rejects more than is in stock and leaves the cart as it was', async () => {
    const { agent } = await signUp();
    const product = await createProduct({ stock: 2 });
    await agent.put(api('/cart')).send({ items: [{ productId: product._id, quantity: 1 }] });

    const tooMany = await agent.put(api('/cart')).send({ items: [{ productId: product._id, quantity: 3 }] });
    expect(tooMany.status).toBe(409);
    const missing = await agent
      .put(api('/cart'))
      .send({ items: [{ productId: new mongoose.Types.ObjectId(), quantity: 1 }] });
    expect(missing.status).toBe(409);
    expect((await agent.put(api('/cart')).send({ items: 'nope' })).status).toBe(400);
    expect((await request(app).put(api('/cart')).send({ items: [] })).status).toBe(401);

    expect((await agent.get(api('/cart'))).body.data.cart.totalItems).toBe(1);
  });

  it('requires a variant for products that have them', async () => {
    const { agent } = await signUp();
    const product = await createProduct({ variants: [{ size: 'M', stock: 2, price: 900 }] });
    const without = await agent.put(api('/cart')).send({ items: [{ productId: product._id, quantity: 1 }] });
    expect(without.status).toBe(400);
    const withVariant = await agent
      .put(api('/cart'))
      .send({ items: [{ productId: product._id, variantId: product.variants[0]._id, quantity: 2 }] });
    expect(withVariant.body.data.cart.itemsPrice).toBe(1800);
  });
});

describe('checkout summary', () => {
  it('previews exactly what checkout then charges', async () => {
    const admin = await signUpAdmin();
    await admin.agent.post(api('/admin/coupons')).send({ code: 'TENOFF', type: 'percent', value: 10 });
    const { agent } = await signUp();
    const product = await createProduct({ price: 400 });

    expect((await agent.get(api('/checkout/summary'))).status).toBe(400); // empty cart
    await agent.put(api('/cart')).send({ items: [{ productId: product._id, quantity: 2 }] });

    const plain = await agent.get(api('/checkout/summary'));
    expect(plain.body.data).toMatchObject({
      itemsPrice: 800,
      discount: 0,
      taxPrice: 80,
      shippingPrice: 50,
      totalPrice: 930,
      coupon: null,
      taxPercent: 10,
      onlinePaymentAvailable: true,
    });

    const withCoupon = await agent.get(api('/checkout/summary?couponCode=tenoff'));
    expect(withCoupon.body.data).toMatchObject({ coupon: 'TENOFF', discount: 80, totalPrice: 842 });
    expect((await agent.get(api('/checkout/summary?couponCode=NOPE'))).status).toBe(400);

    const order = await agent
      .post(api('/checkout'))
      .send({ shippingInfo, paymentMethod: 'cod', couponCode: 'TENOFF' });
    expect(order.body.data.order.totalPrice).toBe(withCoupon.body.data.totalPrice);
  });
});

describe('contact and newsletter', () => {
  it('forwards a contact message to the shop mailbox', async () => {
    const res = await request(app).post(api('/contact')).send({
      name: 'Asha',
      email: 'asha@shop.test',
      subject: 'Sizes',
      message: 'Do you stock XL?',
    });
    expect(res.status).toBe(200);
    const mail = lastEmailTo('shop@shop.test');
    expect(mail.subject).toBe('Contact form: Sizes');
    expect(mail.message).toContain('asha@shop.test');
    expect(mail.message).toContain('Do you stock XL?');

    const bad = await request(app).post(api('/contact')).send({ name: 'A', email: 'nope' });
    expect(bad.status).toBe(400);
  });

  it('says so when no mailbox is configured, so messages are not lost silently', async () => {
    const res = await withConfig('smtp.mail', '', () =>
      request(app).post(api('/contact')).send({
        name: 'Asha',
        email: 'asha@shop.test',
        subject: 'Hi',
        message: 'Hello',
      })
    );
    expect(res.status).toBe(503);
  });

  it('stores newsletter sign-ups once and lists them for admins', async () => {
    const first = await request(app).post(api('/newsletter')).send({ email: 'Fan@Shop.Test' });
    const again = await request(app).post(api('/newsletter')).send({ email: 'fan@shop.test' });
    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(await mongoose.model('Subscriber').countDocuments({ email: 'fan@shop.test' })).toBe(1);
    expect((await request(app).post(api('/newsletter')).send({ email: 'x' })).status).toBe(400);

    const { agent } = await signUp();
    expect((await agent.get(api('/admin/subscribers'))).status).toBe(403);
    const admin = await signUpAdmin();
    const list = await admin.agent.get(api('/admin/subscribers'));
    expect(list.body.data.subscribers.map((s) => s.email)).toContain('fan@shop.test');
  });
});
