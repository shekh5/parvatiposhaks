import mongoose from 'mongoose';
import request from 'supertest';
import { api, createProduct, signUp, signUpAdmin, startApp, stopApp } from './helpers/harness.js';

let app;
let admin;
beforeAll(async () => {
  app = await startApp();
  admin = await signUpAdmin();
});
afterAll(stopApp);

const Product = () => mongoose.model('Product');

describe('product management', () => {
  const body = {
    name: 'Silk Saree',
    description: 'Handwoven',
    price: 2500,
    category: 'saree',
    stock: 4,
    images: [{ public_id: 'a', url: 'https://img.test/a.png' }],
  };

  it('lets only admins create products', async () => {
    const { agent } = await signUp();
    expect((await agent.post(api('/admin/product')).send(body)).status).toBe(403);
    expect((await request(app).post(api('/admin/product')).send(body)).status).toBe(401);

    const res = await admin.agent.post(api('/admin/product')).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.product).toMatchObject({ name: 'Silk Saree', stock: 4, ratings: 0 });
    expect(res.body.data.product.user).toBe(admin.user._id);
  });

  it('validates input', async () => {
    const res = await admin.agent.post(api('/admin/product')).send({ ...body, price: -5, name: '' });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['name', 'price']));
  });

  it('keeps product stock equal to the sum of its variants', async () => {
    const created = await admin.agent.post(api('/admin/product')).send({
      ...body,
      stock: 999,
      variants: [
        { size: 'M', color: 'Red', stock: 3 },
        { size: 'L', color: 'Red', stock: 2, price: 2700 },
      ],
    });
    expect(created.status).toBe(201);
    expect(created.body.data.product.stock).toBe(5);

    const id = created.body.data.product._id;
    const updated = await admin.agent
      .put(api(`/admin/product/${id}`))
      .send({ variants: [{ size: 'M', stock: 7 }] });
    expect(updated.status).toBe(200);
    expect(updated.body.data.product.stock).toBe(7);
  });

  it('updates only editable fields', async () => {
    const product = await createProduct();
    const res = await admin.agent
      .put(api(`/admin/product/${product._id}`))
      .send({ price: 750, ratings: 5, numOfReviews: 99 });
    expect(res.status).toBe(200);
    expect(res.body.data.product).toMatchObject({ price: 750, ratings: 0, numOfReviews: 0 });

    const missing = await admin.agent
      .put(api(`/admin/product/${new mongoose.Types.ObjectId()}`))
      .send({ price: 1 });
    expect(missing.status).toBe(404);
  });
});

describe('product listing', () => {
  beforeAll(async () => {
    await Product().deleteMany({});
    await createProduct({ name: 'Red Kurta', price: 400, category: 'kurta', ratings: 4 });
    await createProduct({ name: 'Blue Kurta', price: 900, category: 'kurta', ratings: 2 });
    await createProduct({ name: 'Bridal Lehenga (gold)', price: 9000, category: 'lehenga', stock: 0 });
  });

  const list = (query) => request(app).get(api(`/products${query}`));
  const names = (res) => res.body.data.products.map((p) => p.name);

  it('paginates', async () => {
    const first = await list('');
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ productCount: 3, totalPages: 2, currentPage: 1 });
    expect(first.body.data.products).toHaveLength(2);
    const second = await list('?page=2');
    expect(second.body.data.products).toHaveLength(1);
    const beyond = await list('?page=9');
    expect(beyond.status).toBe(200);
    expect(beyond.body.data.products).toEqual([]);
  });

  it('searches by keyword and treats special characters literally', async () => {
    expect(names(await list('?keyword=kurta')).sort()).toEqual(['Blue Kurta', 'Red Kurta']);
    expect(names(await list('?keyword=(gold)'))).toEqual(['Bridal Lehenga (gold)']);
    expect((await list('?keyword=.*')).body.data.productCount).toBe(0);
  });

  it('filters by category, price range and stock, and sorts', async () => {
    expect((await list('?category=lehenga')).body.data.productCount).toBe(1);
    expect(names(await list('?price[gte]=500&price[lte]=1000'))).toEqual(['Blue Kurta']);
    expect(names(await list('?ratings[gte]=3'))).toEqual(['Red Kurta']);
    expect((await list('?inStock=true')).body.data.productCount).toBe(2);
    expect(names(await list('?sort=-price&limit=3'))).toEqual([
      'Bridal Lehenga (gold)',
      'Blue Kurta',
      'Red Kurta',
    ]);
  });

  it('ignores filters on fields that are not whitelisted', async () => {
    const res = await list('?user[$ne]=x&numOfReviews=0&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data.productCount).toBe(3);
  });

  it('returns 400 for a malformed id and 404 for a missing product', async () => {
    expect((await request(app).get(api('/product/abc'))).status).toBe(400);
    const missing = await request(app).get(api(`/product/${new mongoose.Types.ObjectId()}`));
    expect(missing.status).toBe(404);
  });
});

describe('reviews', () => {
  it('keeps one review per user and recalculates the average', async () => {
    const product = await createProduct();
    const first = await signUp();
    const second = await signUp();
    const url = api(`/product/${product._id}/review`);

    expect((await request(app).put(url).send({ rating: 5, comment: 'x' })).status).toBe(401);
    expect((await first.agent.put(url).send({ rating: 9, comment: 'x' })).status).toBe(400);

    await first.agent.put(url).send({ rating: 5, comment: 'Lovely' });
    const afterSecond = await second.agent.put(url).send({ rating: 2, comment: 'Too small' });
    expect(afterSecond.body.data).toMatchObject({ ratings: 3.5, numOfReviews: 2 });

    const edited = await first.agent.put(url).send({ rating: 4, comment: 'Still lovely' });
    expect(edited.body.data).toMatchObject({ ratings: 3, numOfReviews: 2 });

    const listed = await request(app).get(api(`/product/${product._id}/reviews`));
    expect(listed.body.data.reviews).toHaveLength(2);
    const stored = await Product().findById(product._id);
    expect(stored).toMatchObject({ ratings: 3, numOfReviews: 2 });
  });

  it('lets only the author or an admin delete a review', async () => {
    const product = await createProduct();
    const author = await signUp();
    const stranger = await signUp();
    const url = api(`/product/${product._id}/review`);

    const one = await author.agent.put(url).send({ rating: 5, comment: 'Great' });
    const reviewId = one.body.data.review._id;

    expect((await stranger.agent.delete(api(`/review/${reviewId}`))).status).toBe(403);
    const own = await author.agent.delete(api(`/review/${reviewId}`));
    expect(own.status).toBe(200);
    expect(own.body.data).toEqual({ ratings: 0, numOfReviews: 0 });

    const two = await author.agent.put(url).send({ rating: 1, comment: 'Changed my mind' });
    const byAdmin = await admin.agent.delete(api(`/review/${two.body.data.review._id}`));
    expect(byAdmin.status).toBe(200);
  });

  it('answers 404 for a review on a missing product', async () => {
    const { agent } = await signUp();
    const res = await agent
      .put(api(`/product/${new mongoose.Types.ObjectId()}/review`))
      .send({ rating: 3, comment: 'ghost' });
    expect(res.status).toBe(404);
  });

  it('removes reviews with their product', async () => {
    const product = await createProduct();
    const { agent } = await signUp();
    await agent.put(api(`/product/${product._id}/review`)).send({ rating: 3, comment: 'ok' });
    expect((await admin.agent.delete(api(`/admin/product/${product._id}`))).status).toBe(200);
    expect(await mongoose.model('Review').countDocuments({ product: product._id })).toBe(0);
  });
});

describe('list price', () => {
  it('stores an optional MRP and validates it', async () => {
    const body = { name: 'Priced Saree', description: 'd', price: 1500, mrp: 1999, category: 'Sarees' };
    const created = await admin.agent.post(api('/admin/product')).send(body);
    expect(created.status).toBe(201);
    expect(created.body.data.product.mrp).toBe(1999);

    const listed = await request(app).get(api(`/product/${created.body.data.product._id}`));
    expect(listed.body.data.product.mrp).toBe(1999);

    const cleared = await admin.agent
      .put(api(`/admin/product/${created.body.data.product._id}`))
      .send({ mrp: null });
    expect(cleared.body.data.product.mrp).toBeNull();

    const bad = await admin.agent.post(api('/admin/product')).send({ ...body, mrp: -1 });
    expect(bad.status).toBe(400);
  });
});
