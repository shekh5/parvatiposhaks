import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import {
  cartView,
  clearCart,
  loadCart,
  replaceCartItems,
  resolveLine,
} from '../services/cart.service.js';

const sameLine = (item, productId, variantId) =>
  String(item.product) === String(productId) &&
  String(item.variantId || '') === String(variantId || '');

const respondWithCart = async (res, userId, message, statusCode = 200) =>
  sendResponse(res, statusCode, message, { cart: cartView(await loadCart(userId)) });

export const getCart = asyncHandler(async (req, res) => {
  await respondWithCart(res, req.user._id, 'Cart retrieved successfully');
});

export const addCartItem = asyncHandler(async (req, res) => {
  const { productId, variantId = null, quantity = 1 } = req.body;

  const product = await Product.findById(productId);
  if (!product) throw new ApiError('Product not found', 404);
  const { available } = resolveLine(product, variantId);

  const cart =
    (await Cart.findOne({ user: req.user._id })) || new Cart({ user: req.user._id, items: [] });
  const existing = cart.items.find((item) => sameLine(item, productId, variantId));
  const wanted = (existing ? existing.quantity : 0) + quantity;
  if (wanted > available) {
    throw new ApiError(`Only ${available} of ${product.name} available`, 409);
  }

  if (existing) existing.quantity = wanted;
  else cart.items.push({ product: productId, variantId, quantity });
  await cart.save();

  await respondWithCart(res, req.user._id, 'Item added to cart', 201);
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  const item = cart?.items.id(req.params.itemId);
  if (!item) throw new ApiError('Cart item not found', 404);

  const product = await Product.findById(item.product);
  if (!product) throw new ApiError('Product not found', 404);
  const { available } = resolveLine(product, item.variantId);
  if (req.body.quantity > available) {
    throw new ApiError(`Only ${available} of ${product.name} available`, 409);
  }

  item.quantity = req.body.quantity;
  await cart.save();
  await respondWithCart(res, req.user._id, 'Cart updated');
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const result = await Cart.updateOne(
    { user: req.user._id, 'items._id': req.params.itemId },
    { $pull: { items: { _id: req.params.itemId } } }
  );
  if (result.modifiedCount === 0) throw new ApiError('Cart item not found', 404);
  await respondWithCart(res, req.user._id, 'Item removed from cart');
});

export const emptyCart = asyncHandler(async (req, res) => {
  await clearCart(req.user._id);
  await respondWithCart(res, req.user._id, 'Cart cleared');
});

// Replaces the whole cart in one call. The storefront keeps a cart in the
// browser for guests and sends it here when the shopper signs in to check out.
export const replaceCart = asyncHandler(async (req, res) => {
  await replaceCartItems(req.user._id, req.body.items);
  await respondWithCart(res, req.user._id, 'Cart updated');
});
