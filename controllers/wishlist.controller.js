import Product from '../models/product.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';

const loadWishlist = async (userId) => {
  const user = await User.findById(userId).populate(
    'wishlist',
    'name price images category stock ratings numOfReviews'
  );
  return user.wishlist.filter(Boolean);
};

export const getWishlist = asyncHandler(async (req, res) => {
  sendResponse(res, 200, 'Wishlist retrieved successfully', {
    wishlist: await loadWishlist(req.user._id),
  });
});

export const addToWishlist = asyncHandler(async (req, res) => {
  if (!(await Product.exists({ _id: req.params.productId }))) {
    throw new ApiError('Product not found', 404);
  }
  await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: req.params.productId } });
  sendResponse(res, 200, 'Added to wishlist', { wishlist: await loadWishlist(req.user._id) });
});

export const removeFromWishlist = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.params.productId } });
  sendResponse(res, 200, 'Removed from wishlist', { wishlist: await loadWishlist(req.user._id) });
});
