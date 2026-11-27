import mongoose from 'mongoose';
import request from 'supertest';
import { api, createProduct, signUp, signUpAdmin, startApp, stopApp } from './helpers/harness.js';

let app;
beforeAll(async () => {
  app = await startApp();
});
afterAll(stopApp);

const STOREFRONT = 'http://localhost:5173'; // the default allowed origin
const cookiesOf = (res) => res.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');

describe('cross-site requests', () => {
  it('refuses changes started by another website, even with valid cookies', async () => {
    const { credentials } = await signUp();
    const login = await request(app).post(api('/signin')).send(credentials);
    const cookie = cookiesOf(login);

    const forged = await request(app)
      .put(api('/profile'))
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({ name: 'Hacked' });
    expect(forged.status).toBe(403);

    const profile = await request(app).get(api('/profile')).set('Cookie', cookie);
    expect(profile.body.data.user.name).not.toBe('Hacked');
  });

  it('accepts the storefront, same-host requests and callers without an origin', async () => {
    const { credentials } = await signUp();
    const fromStorefront = await request(app)
      .post(api('/signin'))
      .set('Origin', STOREFRONT)
      .send(credentials);
    expect(fromStorefront.status).toBe(200);

    const sameHost = await request(app)
      .post(api('/signin'))
      .set('Host', 'shop.example')
      .set('Origin', 'http://shop.example')
      .send(credentials);
    expect(sameHost.status).toBe(200);

    expect((await request(app).post(api('/signin')).send(credentials)).status).toBe(200);
  });

  it('lets any site read public pages', async () => {
    const res = await request(app).get(api('/products')).set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
  });

  it('does not read HTML form posts at all', async () => {
    const { credentials } = await signUp();
    const res = await request(app)
      .post(api('/signin'))
      .type('form')
      .send({ email: credentials.email, password: credentials.password });
    expect(res.status).toBe(400);
  });
});

describe('request size', () => {
  const padding = 'x'.repeat(200 * 1024);

  it('rejects oversized bodies on ordinary routes', async () => {
    const res = await request(app)
      .post(api('/contact'))
      .send({ name: 'A', email: 'a@shop.test', subject: 'S', message: padding });
    expect(res.status).toBe(413);
  });

  it('still accepts a profile photo on sign-up and profile update', async () => {
    const avatar = `data:image/png;base64,${'A'.repeat(300 * 1024)}`;
    const signup = await request(app).post(api('/signup')).send({
      name: 'Photo',
      email: 'photo@shop.test',
      username: 'photo1',
      password: 'password123',
      avatar,
    });
    expect(signup.status).toBe(201);
    expect(signup.body.data.user.avatar.url).toBe('https://img.test/a.png');

    const update = await request(app)
      .put(api('/profile'))
      .set('Cookie', cookiesOf(signup))
      .send({ avatar });
    expect(update.status).toBe(200);
  });
});

describe('avatar input', () => {
  it('accepts only image data, never a web address or other content', async () => {
    const { agent } = await signUp();
    for (const avatar of [
      'https://internal.example/secret.png',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'not an image',
    ]) {
      const res = await agent.put(api('/profile')).send({ avatar });
      expect(res.status).toBe(400);
    }
    const ok = await agent.put(api('/profile')).send({ avatar: 'data:image/jpeg;base64,AAAA' });
    expect(ok.status).toBe(200);
  });
});

describe('response headers', () => {
  it('allows product images to be shown on another domain', async () => {
    const res = await request(app).get('/healthCheck');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('paged lists', () => {
  it('pages admin lists and reports the totals', async () => {
    const admin = await signUpAdmin();
    await signUp();
    await signUp();

    const users = await admin.agent.get(api('/admin/users?limit=2&page=2'));
    expect(users.status).toBe(200);
    expect(users.body.data.users.length).toBeLessThanOrEqual(2);
    expect(users.body.data.currentPage).toBe(2);
    expect(users.body.data.count).toBeGreaterThanOrEqual(3);
    expect(users.body.data.totalPages).toBe(Math.ceil(users.body.data.count / 2));

    await createProduct();
    await createProduct();
    await createProduct();
    const products = await admin.agent.get(api('/admin/products?limit=2'));
    expect(products.body.data).toMatchObject({ count: 3, currentPage: 1, totalPages: 2 });
    expect(products.body.data.products).toHaveLength(2);

    // Silly values fall back to sane ones instead of failing
    const odd = await admin.agent.get(api('/admin/products?limit=-5&page=abc'));
    expect(odd.body.data).toMatchObject({ currentPage: 1, count: 3 });
    const capped = await admin.agent.get(api('/admin/products?limit=100000'));
    expect(capped.body.data.totalPages).toBe(1);
  });

  it('pages reviews and a shopper’s orders', async () => {
    const product = await createProduct();
    for (let i = 0; i < 3; i += 1) {
      const { agent } = await signUp();
      await agent.put(api(`/product/${product._id}/review`)).send({ rating: 4, comment: `Review ${i}` });
    }
    const first = await request(app).get(api(`/product/${product._id}/reviews?limit=2`));
    expect(first.body.data).toMatchObject({ count: 3, totalPages: 2, numOfReviews: 3 });
    expect(first.body.data.reviews).toHaveLength(2);
    const second = await request(app).get(api(`/product/${product._id}/reviews?limit=2&page=2`));
    expect(second.body.data.reviews).toHaveLength(1);

    const { agent } = await signUp();
    const orders = await agent.get(api('/orders/me'));
    expect(orders.body.data).toMatchObject({ orders: [], count: 0, currentPage: 1, totalPages: 0 });
  });
});

describe('shared rate limit store', () => {
  it('counts per key across instances and starts again when the window ends', async () => {
    const { MongoRateLimitStore } = await import('../middleware/rateLimit.middleware.js');
    const first = new MongoRateLimitStore('test');
    const second = new MongoRateLimitStore('test'); // as if on another server
    const other = new MongoRateLimitStore('other');
    for (const store of [first, second, other]) store.init({ windowMs: 60 * 1000 });

    expect((await first.increment('1.2.3.4')).totalHits).toBe(1);
    const hit = await second.increment('1.2.3.4');
    expect(hit.totalHits).toBe(2);
    expect(hit.resetTime.getTime()).toBeGreaterThan(Date.now());
    expect((await first.increment('5.6.7.8')).totalHits).toBe(1);
    expect((await other.increment('1.2.3.4')).totalHits).toBe(1);

    await first.decrement('1.2.3.4');
    expect((await first.increment('1.2.3.4')).totalHits).toBe(2);

    // Pretend the window ended
    await mongoose.connection
      .collection('ratelimits')
      .updateOne({ _id: 'test:1.2.3.4' }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await second.increment('1.2.3.4')).totalHits).toBe(1);

    await first.resetKey('1.2.3.4');
    expect((await first.increment('1.2.3.4')).totalHits).toBe(1);
  });
});
