// One-off data migration to the current schema. Safe to run more than once.
//
//   npm run migrate -- --dry-run   show what would change
//   npm run migrate                apply the changes
//
// What it does:
//   products  Stock -> stock, Image -> images, noOfreviews -> numOfReviews,
//             embedded reviews -> the reviews collection, ratings recalculated
//   users     isemailverified -> isEmailVerified
//   orders    deliverdAt -> deliveredAt, payment fields backfilled,
//             pinCode and phoneNo stored as text
import { pathToFileURL } from 'url';
import mongoose from 'mongoose';

const renameField = async (collection, from, to, dryRun) => {
  const filter = { [from]: { $exists: true } };
  const count = await collection.countDocuments(filter);
  if (count && !dryRun) {
    // Where the new field already exists, keep it and just drop the old one
    await collection.updateMany({ ...filter, [to]: { $exists: true } }, { $unset: { [from]: '' } });
    await collection.updateMany(filter, { $rename: { [from]: to } });
  }
  return count;
};

async function migrateReviews(db, dryRun) {
  const products = db.collection('products');
  const reviews = db.collection('reviews');
  const cursor = products.find({ 'reviews.0': { $exists: true } });

  let moved = 0;
  let productsTouched = 0;
  for await (const product of cursor) {
    productsTouched += 1;
    // Keep one review per user, the same rule the new unique index enforces
    const byUser = new Map();
    for (const review of product.reviews) {
      if (review.user) byUser.set(String(review.user), review);
    }
    moved += byUser.size;
    if (dryRun) continue;

    for (const review of byUser.values()) {
      const when = review.timestamp || new Date();
      await reviews.updateOne(
        { product: product._id, user: review.user },
        {
          $setOnInsert: {
            product: product._id,
            user: review.user,
            name: review.name || 'Customer',
            rating: Math.min(5, Math.max(1, Number(review.rating) || 1)),
            comment: review.comment || '',
            createdAt: when,
            updatedAt: when,
          },
        },
        { upsert: true }
      );
    }

    const saved = await reviews.find({ product: product._id }).toArray();
    const average = saved.reduce((sum, r) => sum + r.rating, 0) / (saved.length || 1);
    await products.updateOne(
      { _id: product._id },
      {
        $set: { ratings: Math.round(average * 10) / 10, numOfReviews: saved.length },
        $unset: { reviews: '' },
      }
    );
  }

  // Empty embedded arrays carry nothing; just remove the field
  if (!dryRun) await products.updateMany({ reviews: { $exists: true } }, { $unset: { reviews: '' } });
  return { moved, productsTouched };
}

// Converts a stored number to text and leaves anything else untouched
const numberToText = (field) => ({
  $cond: [{ $isNumber: field }, { $toString: { $toLong: field } }, field],
});

async function migrateOrders(db, dryRun) {
  const orders = db.collection('orders');
  const report = {};

  report.deliveredAtRenamed = await renameField(orders, 'deliverdAt', 'deliveredAt', dryRun);

  // The old flow marked every order as paid online at creation
  const legacy = { paymentMethod: { $exists: false } };
  report.paymentBackfilled = await orders.countDocuments(legacy);
  if (report.paymentBackfilled && !dryRun) {
    await orders.updateMany(legacy, [
      {
        $set: {
          paymentMethod: 'razorpay',
          paymentStatus: 'paid',
          discount: { $ifNull: ['$discount', 0] },
          coupon: { $ifNull: ['$coupon', null] },
          updatedAt: { $ifNull: ['$updatedAt', '$createdAt'] },
          statusHistory: {
            $ifNull: [
              '$statusHistory',
              [{ status: '$orderStatus', note: 'Migrated', at: { $ifNull: ['$createdAt', '$$NOW'] } }],
            ],
          },
        },
      },
    ]);
  }

  const numeric = {
    $or: [
      { 'shippingInfo.pinCode': { $type: 'number' } },
      { 'shippingInfo.phoneNo': { $type: 'number' } },
    ],
  };
  report.contactFieldsConverted = await orders.countDocuments(numeric);
  if (report.contactFieldsConverted && !dryRun) {
    await orders.updateMany(numeric, [
      {
        $set: {
          'shippingInfo.pinCode': numberToText('$shippingInfo.pinCode'),
          'shippingInfo.phoneNo': numberToText('$shippingInfo.phoneNo'),
        },
      },
    ]);
  }
  return report;
}

export async function migrate(db, { dryRun = false } = {}) {
  const products = db.collection('products');
  const users = db.collection('users');

  const report = { dryRun, products: {}, users: {}, orders: {} };
  report.products.stockRenamed = await renameField(products, 'Stock', 'stock', dryRun);
  report.products.imagesRenamed = await renameField(products, 'Image', 'images', dryRun);
  report.products.reviewCountRenamed = await renameField(products, 'noOfreviews', 'numOfReviews', dryRun);

  const reviews = await migrateReviews(db, dryRun);
  report.products.withEmbeddedReviews = reviews.productsTouched;
  report.products.reviewsMoved = reviews.moved;

  report.users.emailVerifiedRenamed = await renameField(users, 'isemailverified', 'isEmailVerified', dryRun);
  report.orders = await migrateOrders(db, dryRun);
  return report;
}

// Run directly from the command line
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { default: config } = await import('../config/index.js');
  const dryRun = process.argv.includes('--dry-run');
  if (!config.mongoUrl) {
    console.error('MONGO_DB_URL is not set');
    process.exit(1);
  }
  try {
    await mongoose.connect(config.mongoUrl);
    const report = await migrate(mongoose.connection.db, { dryRun });
    console.log(JSON.stringify(report, null, 2));
    console.log(dryRun ? 'Dry run only. Nothing was changed.' : 'Migration complete.');
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
