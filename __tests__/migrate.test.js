import mongoose from 'mongoose';
import { startApp, stopApp } from './helpers/harness.js';
import { migrate } from '../scripts/migrate.js';

let db;
const id = () => new mongoose.Types.ObjectId();
const userA = id();
const userB = id();
const productId = id();
const plainProductId = id();
const orderId = id();
const created = new Date('2025-01-05T10:00:00Z');

beforeAll(async () => {
  await startApp();
  db = mongoose.connection.db;

  // Documents shaped the way the old code wrote them
  await db.collection('products').insertMany([
    {
      _id: productId,
      name: 'Old Kurta',
      description: 'd',
      price: 500,
      category: 'kurta',
      Stock: 7,
      Image: [{ public_id: 'x', url: 'https://img.test/x.png' }],
      noOfreviews: 3,
      ratings: 4.33,
      reviews: [
        { user: userA, name: 'A', rating: 5, comment: 'great', timestamp: created },
        { user: userB, name: 'B', rating: 2, comment: 'meh', timestamp: created },
        { user: userA, name: 'A', rating: 4, comment: 'still good', timestamp: created },
      ],
      user: id(),
      createdAt: created,
    },
    {
      _id: plainProductId,
      name: 'No Reviews',
      description: 'd',
      price: 100,
      category: 'kurta',
      Stock: 1,
      Image: [],
      noOfreviews: 0,
      ratings: 0,
      reviews: [],
      user: id(),
      createdAt: created,
    },
  ]);
  await db.collection('users').insertOne({
    _id: userA,
    name: 'A',
    username: 'a',
    email: 'a@shop.test',
    password: 'hash',
    isemailverified: true,
    role: 'user',
  });
  await db.collection('orders').insertOne({
    _id: orderId,
    shippingInfo: { address: 'x', city: 'y', state: 'z', country: 'India', pinCode: 302001, phoneNo: 9876543210 },
    orderItems: [{ name: 'Old Kurta', price: 500, quantity: 1, image: 'i', product: productId }],
    user: userA,
    paymentInfo: { id: 'pay_old', status: 'succeeded' },
    paidAt: created,
    itemsPrice: 500,
    taxPrice: 0,
    shippingPrice: 0,
    totalPrice: 500,
    orderStatus: 'Delivered',
    deliverdAt: created,
    createdAt: created,
  });
});
afterAll(stopApp);

const snapshot = async () => ({
  products: await db.collection('products').find().sort({ name: 1 }).toArray(),
  users: await db.collection('users').find().toArray(),
  orders: await db.collection('orders').find().toArray(),
  reviews: await db.collection('reviews').find().sort({ rating: 1 }).toArray(),
});

describe('data migration', () => {
  it('reports without changing anything on a dry run', async () => {
    const before = await snapshot();
    const report = await migrate(db, { dryRun: true });
    expect(report).toMatchObject({
      dryRun: true,
      products: { stockRenamed: 2, imagesRenamed: 2, reviewCountRenamed: 2, withEmbeddedReviews: 1, reviewsMoved: 2 },
      users: { emailVerifiedRenamed: 1 },
      orders: { deliveredAtRenamed: 1, paymentBackfilled: 1, contactFieldsConverted: 1 },
    });
    expect(await snapshot()).toEqual(before);
  });

  it('converts old documents so the current models read them', async () => {
    await migrate(db);

    const product = await mongoose.model('Product').findById(productId).lean();
    expect(product).toMatchObject({ stock: 7, numOfReviews: 2, ratings: 3 });
    expect(product.images).toHaveLength(1);
    for (const gone of ['Stock', 'Image', 'noOfreviews', 'reviews']) {
      expect(product[gone]).toBeUndefined();
    }
    const plain = await db.collection('products').findOne({ _id: plainProductId });
    expect(plain.reviews).toBeUndefined();
    expect(plain.stock).toBe(1);

    // One review per user survives: the latest one from user A
    const reviews = await mongoose.model('Review').find({ product: productId }).sort({ rating: 1 });
    expect(reviews.map((r) => [String(r.user), r.rating, r.comment])).toEqual([
      [String(userB), 2, 'meh'],
      [String(userA), 4, 'still good'],
    ]);

    const user = await mongoose.model('User').findById(userA).lean();
    expect(user.isEmailVerified).toBe(true);
    expect(user.isemailverified).toBeUndefined();

    const order = await mongoose.model('Order').findById(orderId).lean();
    expect(order).toMatchObject({
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      discount: 0,
      orderStatus: 'Delivered',
    });
    expect(order.deliveredAt).toEqual(created);
    expect(order.deliverdAt).toBeUndefined();
    expect(order.shippingInfo).toMatchObject({ pinCode: '302001', phoneNo: '9876543210' });
    expect(order.statusHistory).toHaveLength(1);
    expect(order.statusHistory[0]).toMatchObject({ status: 'Delivered', at: created });
    await expect(mongoose.model('Order').findById(orderId).then((o) => o.validate())).resolves.toBeUndefined();
  });

  it('changes nothing when run again', async () => {
    const before = await snapshot();
    const report = await migrate(db);
    expect(report.products).toEqual({
      stockRenamed: 0,
      imagesRenamed: 0,
      reviewCountRenamed: 0,
      withEmbeddedReviews: 0,
      reviewsMoved: 0,
    });
    expect(report.orders).toEqual({ deliveredAtRenamed: 0, paymentBackfilled: 0, contactFieldsConverted: 0 });
    expect(await snapshot()).toEqual(before);
  });
});
