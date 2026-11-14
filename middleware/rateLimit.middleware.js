import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Keeps request counts in MongoDB, so the limit holds across several server
// instances and survives restarts. No extra infrastructure is needed.
export class MongoRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.windowMs = 60 * 1000;
    this.indexed = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async collection() {
    const collection = mongoose.connection.collection('ratelimits');
    if (!this.indexed) {
      this.indexed = true;
      // MongoDB clears out counters whose window has ended
      await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    }
    return collection;
  }

  async increment(key) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + this.windowMs);
    const active = { $gt: ['$expiresAt', now] };
    try {
      const collection = await this.collection();
      // One atomic update: count up inside a live window, otherwise start a new one
      const doc = await collection.findOneAndUpdate(
        { _id: `${this.prefix}:${key}` },
        [
          {
            $set: {
              hits: { $cond: [active, { $add: ['$hits', 1] }, 1] },
              expiresAt: { $cond: [active, '$expiresAt', windowEnd] },
            },
          },
        ],
        { upsert: true, returnDocument: 'after' }
      );
      return { totalHits: doc.hits, resetTime: doc.expiresAt };
    } catch (error) {
      // A database hiccup must not lock everyone out of the shop
      logger.error(`Rate limit store failed: ${error.message}`);
      return { totalHits: 1, resetTime: windowEnd };
    }
  }

  async decrement(key) {
    const collection = await this.collection();
    await collection.updateOne({ _id: `${this.prefix}:${key}`, hits: { $gt: 0 } }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    const collection = await this.collection();
    await collection.deleteOne({ _id: `${this.prefix}:${key}` });
  }
}

const build = (name, limit, message) =>
  rateLimit({
    windowMs: config.rateLimit.windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !config.isProduction,
    store: new MongoRateLimitStore(name),
    message: { success: false, message, errors: [] },
  });

export const apiLimiter = build('api', config.rateLimit.max, 'Too many requests. Please try again later');

// Tighter limit for sign-in, sign-up and password or token endpoints
export const authLimiter = build(
  'auth',
  config.rateLimit.authMax,
  'Too many attempts. Please try again later'
);
