import Product from '../models/product.model.js';
import ApiError from '../utils/apiError.js';

// Stock changes are single conditional updates, so two buyers can never both
// take the last unit. No multi-document transaction is needed, which keeps this
// working on a standalone MongoDB.

async function reserveOne({ product, variantId, quantity }) {
  if (variantId) {
    const result = await Product.updateOne(
      { _id: product, variants: { $elemMatch: { _id: variantId, stock: { $gte: quantity } } } },
      { $inc: { 'variants.$.stock': -quantity, stock: -quantity } }
    );
    return result.modifiedCount === 1;
  }
  const result = await Product.updateOne(
    { _id: product, stock: { $gte: quantity }, 'variants.0': { $exists: false } },
    { $inc: { stock: -quantity } }
  );
  return result.modifiedCount === 1;
}

async function releaseOne({ product, variantId, quantity }) {
  if (variantId) {
    await Product.updateOne(
      { _id: product, 'variants._id': variantId },
      { $inc: { 'variants.$.stock': quantity, stock: quantity } }
    );
    return;
  }
  await Product.updateOne({ _id: product }, { $inc: { stock: quantity } });
}

// Reserves every item or none: anything already taken is put back on failure.
export async function reserveItems(items) {
  const reserved = [];
  for (const item of items) {
    const ok = await reserveOne(item);
    if (!ok) {
      await releaseItems(reserved);
      throw new ApiError(`Not enough stock for ${item.name || 'an item in your cart'}`, 409);
    }
    reserved.push(item);
  }
}

export async function releaseItems(items) {
  await Promise.all(items.map(releaseOne));
}
