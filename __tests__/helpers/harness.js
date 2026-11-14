import { jest } from '@jest/globals';
import crypto from 'crypto';
import mongoose from 'mongoose';
import request from 'supertest';

// Everything the app would have sent to outside services is captured here
export const sentEmails = [];
export const razorpayOrders = [];
export const razorpay = { failNext: false, failNextRefund: false };
export const razorpayRefunds = [];

let memoryServer;
let app;
let counter = 0;

// Uses MONGO_TEST_URL when given, otherwise starts an in-memory MongoDB
async function connect() {
  const dbName = `pp_test_${process.pid}_${Date.now()}`;
  if (process.env.MONGO_TEST_URL) {
    await mongoose.connect(`${process.env.MONGO_TEST_URL.replace(/\/$/, '')}/${dbName}`);
    return;
  }
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri(dbName));
}

export async function startApp() {
  jest.unstable_mockModule('../../utils/sendEmail.js', () => ({
    sendEmail: async (options) => {
      sentEmails.push(options);
    },
  }));

  jest.unstable_mockModule('razorpay', () => ({
    default: class FakeRazorpay {
      constructor() {
        this.orders = {
          create: async (options) => {
            if (razorpay.failNext) {
              razorpay.failNext = false;
              throw new Error('gateway down');
            }
            const order = { id: `order_test_${++counter}`, ...options };
            razorpayOrders.push(order);
            return order;
          },
        };
        this.payments = {
          refund: async (paymentId, options) => {
            if (razorpay.failNextRefund) {
              razorpay.failNextRefund = false;
              throw new Error('refund declined');
            }
            const refund = { id: `rfnd_test_${++counter}`, payment_id: paymentId, ...options };
            razorpayRefunds.push(refund);
            return refund;
          },
        };
      }
    },
  }));

  jest.unstable_mockModule('cloudinary', () => ({
    v2: {
      config: () => {},
      uploader: {
        upload: async () => ({ public_id: 'avatars/test', secure_url: 'https://img.test/a.png' }),
        destroy: async () => ({}),
      },
    },
  }));

  await connect();
  ({ default: app } = await import('../../app.js'));
  return app;
}

export async function stopApp() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (memoryServer) await memoryServer.stop();
}

export const api = (path) => `/api/v1${path}`;

// Runs `fn` with one config value changed, and always puts the old value back.
// Example: await withConfig('shop.shippingFee', 0, () => checkout(agent))
export async function withConfig(path, value, fn) {
  const { default: config } = await import('../../config/index.js');
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((object, key) => object[key], config);
  const previous = target[last];
  target[last] = value;
  try {
    return await fn();
  } finally {
    target[last] = previous;
  }
}

// Signs up a fresh user and returns a cookie-keeping agent for them
export async function signUp(overrides = {}) {
  const n = ++counter;
  const credentials = {
    name: `User ${n}`,
    email: `user${n}@shop.test`,
    username: `user${n}`,
    password: 'password123',
    ...overrides,
  };
  const agent = request.agent(app);
  const res = await agent.post(api('/signup')).send(credentials);
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${res.text}`);
  return { agent, user: res.body.data.user, credentials };
}

export async function signUpAdmin() {
  const session = await signUp();
  await mongoose.model('User').updateOne({ _id: session.user._id }, { role: 'admin' });
  return session;
}

export async function createProduct(overrides = {}) {
  const n = ++counter;
  return mongoose.model('Product').create({
    name: `Product ${n}`,
    description: 'A fine garment',
    price: 500,
    category: 'kurta',
    stock: 10,
    images: [{ public_id: `p${n}`, url: `https://img.test/p${n}.png` }],
    user: new mongoose.Types.ObjectId(),
    ...overrides,
  });
}

export const shippingInfo = {
  address: '12 MG Road',
  city: 'Jaipur',
  state: 'Rajasthan',
  country: 'India',
  pinCode: '302001',
  phoneNo: '9876543210',
};

export const paymentSignature = (orderId, paymentId) =>
  crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

export const webhookSignature = (rawBody) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');

export const lastEmailTo = (email) => [...sentEmails].reverse().find((mail) => mail.email === email);

export const tokenFromEmail = (mail) => mail.message.match(/\/(?:verify-email|reset)\/([a-f0-9]+)/)[1];
