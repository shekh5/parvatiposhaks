import Product from '../models/product.model.js';
import Review from '../models/review.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getPagination, paginate } from '../utils/pagination.js';
import { sendResponse } from '../utils/apiResponse.js';
import { recalculateProductRating } from '../services/review.service.js';

// Creates the user's review for a product, or updates it if one exists
export const upsertReview = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  if (!(await Product.exists({ _id: productId }))) throw new ApiError('Product not found', 404);

  const review = await Review.findOneAndUpdate(
    { product: productId, user: req.user._id },
    { rating: req.body.rating, comment: req.body.comment, name: req.user.name },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  const rating = await recalculateProductRating(productId);
  sendResponse(res, 200, 'Review saved successfully', { review, ...rating });
});

export const getProductReviews = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).select('ratings numOfReviews');
  if (!product) throw new ApiError('Product not found', 404);
  const { items: reviews, ...page } = await paginate(
    Review,
    { product: product._id },
    getPagination(req.query, { defaultLimit: 50 })
  );
  sendResponse(res, 200, 'Product reviews retrieved successfully', {
    reviews,
    ratings: product.ratings,
    numOfReviews: product.numOfReviews,
    ...page,
  });
});

export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError('Review not found', 404);

  const isOwner = String(review.user) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') {
    throw new ApiError('You can only delete your own review', 403);
  }

  await review.deleteOne();
  const rating = await recalculateProductRating(review.product);
  sendResponse(res, 200, 'Review deleted successfully', rating);
});
