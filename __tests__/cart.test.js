import mongoose from 'mongoose';
import request from 'supertest';
import { api, createProduct, signUp, startApp, stopApp } from './helpers/harness.js';

let app;
beforeAll(async () => {
  app = await startApp();
});
afterAll(stopApp);

describe('cart', () => {
  it('requires sign-in', async () => {
    expect((await request(app).get(api('/cart'))).status).toBe(401);
  });

  it('adds, merges, updates and removes items with live prices', async () => {
    const { agent } = await signUp();
    const kurta = await createProduct({ price: 400, stock: 5 });
    const saree = await createProduct({ price: 1000, stock: 2 });

    const empty = await agent.get(api('/cart'));
    expect(empty.body.data.cart).toEqual({ items: [], totalItems: 0, itemsPrice: 0 });

    await agent.post(api('/cart/items')).send({ productId: kurta._id, quantity: 2 });
    await agent.post(api('/cart/items')).send({ productId: kurta._id });
    const added = await agent.post(api('/cart/items')).send({ productId: saree._id });
    expect(added.status).toBe(201);
    expect(added.body.data.cart).toMatchObject({ totalItems: 4, itemsPrice: 2200 });
    expect(added.body.data.cart.items).toHaveLength(2);

    // A price change shows up without touching the cart
    await mongoose.model('Product').updateOne({ _id: kurta._id }, { price: 500 });
    const repriced = await agent.get(api('/cart'));
    expect(repriced.body.data.cart.itemsPrice).toBe(2500);

    const line = repriced.body.data.cart.items.find((i) => i.product._id === String(kurta._id));
    const updated = await agent.put(api(`/cart/items/${line._id}`)).send({ quantity: 1 });
    expect(updated.body.data.cart.itemsPrice).toBe(1500);

    const removed = await agent.delete(api(`/cart/items/${line._id}`));
    expect(removed.body.data.cart.items).toHaveLength(1);
    expect((await agent.delete(api(`/cart/items/${line._id}`))).status).toBe(404);

    const cleared = await agent.delete(api('/cart'));
    expect(cleared.body.data.cart.items).toEqual([]);
  });

  it('does not allow more than the available stock', async () => {
    const { agent } = await signUp();
    const product = await createProduct({ stock: 2 });
    expect((await agent.post(api('/cart/items')).send({ productId: product._id, quantity: 3 })).status).toBe(409);
    await agent.post(api('/cart/items')).send({ productId: product._id, quantity: 2 });
    expect((await agent.post(api('/cart/items')).send({ productId: product._id })).status).toBe(409);
    expect((await agent.post(api('/cart/items')).send({ productId: product._id, quantity: 0 })).status).toBe(400);
  });

  it('handles variants: required, priced and stocked per option', async () => {
    const { agent } = await signUp();
    const product = await createProduct({
      price: 800,
      variants: [
        { size: 'M', color: 'Red', stock: 1 },
        { size: 'L', color: 'Red', stock: 4, price: 900 },
      ],
    });
    const [medium, large] = product.variants;

    expect((await agent.post(api('/cart/items')).send({ productId: product._id })).status).toBe(400);
    expect(
      (await agent.post(api('/cart/items')).send({ productId: product._id, variantId: medium._id, quantity: 2 })).status
    ).toBe(409);

    await agent.post(api('/cart/items')).send({ productId: product._id, variantId: medium._id });
    const res = await agent
      .post(api('/cart/items'))
      .send({ productId: product._id, variantId: large._id, quantity: 2 });
    expect(res.body.data.cart.items).toHaveLength(2);
    expect(res.body.data.cart.itemsPrice).toBe(800 + 2 * 900);
    expect(res.body.data.cart.items.map((i) => i.variantLabel).sort()).toEqual(['L / Red', 'M / Red']);
  });

  it('drops items whose product was deleted', async () => {
    const { agent } = await signUp();
    const product = await createProduct();
    await agent.post(api('/cart/items')).send({ productId: product._id });
    await mongoose.model('Product').deleteOne({ _id: product._id });
    const res = await agent.get(api('/cart'));
    expect(res.body.data.cart.items).toEqual([]);
  });
});

describe('wishlist', () => {
  it('adds without duplicates and removes', async () => {
    const { agent } = await signUp();
    const product = await createProduct();

    await agent.post(api(`/wishlist/${product._id}`));
    const again = await agent.post(api(`/wishlist/${product._id}`));
    expect(again.body.data.wishlist).toHaveLength(1);
    expect(again.body.data.wishlist[0].name).toBe(product.name);

    const missing = await agent.post(api(`/wishlist/${new mongoose.Types.ObjectId()}`));
    expect(missing.status).toBe(404);

    const removed = await agent.delete(api(`/wishlist/${product._id}`));
    expect(removed.body.data.wishlist).toEqual([]);
  });
});
