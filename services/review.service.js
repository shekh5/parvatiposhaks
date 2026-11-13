import mongoose from 'mongoose';
import Product from '../models/product.model.js';
import Review from '../models/review.model.js';

// Recomputes the stored average and count from the reviews collection
export async function recalculateProductRating(productId) {
  const [stats] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)) } },
    { $group: { _id: '$product', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const ratings = stats ? Math.round(stats.average * 10) / 10 : 0;
  const numOfReviews = stats ? stats.count : 0;
  await Product.updateOne({ _id: productId }, { ratings, numOfReviews });
  return { ratings, numOfReviews };
}
