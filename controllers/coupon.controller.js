import Coupon from '../models/coupon.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import { loadCart } from '../services/cart.service.js';
import { computeTotals, findValidCoupon } from '../services/pricing.service.js';

const FIELDS = [
  'code',
  'type',
  'value',
  'minOrderValue',
  'maxDiscount',
  'expiresAt',
  'usageLimit',
  'perUserLimit',
  'active',
];

const pick = (body) =>
  FIELDS.reduce((picked, key) => {
    if (body[key] !== undefined) picked[key] = body[key];
    return picked;
  }, {});

export const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create(pick(req.body));
  sendResponse(res, 201, 'Coupon created successfully', { coupon });
});

export const getCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  sendResponse(res, 200, 'Coupons retrieved successfully', { coupons, count: coupons.length });
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError('Coupon not found', 404);
  coupon.set(pick(req.body));
  await coupon.save();
  sendResponse(res, 200, 'Coupon updated successfully', { coupon });
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new ApiError('Coupon not found', 404);
  sendResponse(res, 200, 'Coupon deleted successfully');
});

// Shows what the coupon would do to the signed-in user's current cart
export const validateCoupon = asyncHandler(async (req, res) => {
  const { lines, itemsPrice } = await loadCart(req.user._id);
  if (lines.length === 0) throw new ApiError('Your cart is empty', 400);
  const coupon = await findValidCoupon(req.body.code, req.user._id, itemsPrice);
  sendResponse(res, 200, 'Coupon applied', {
    code: coupon.code,
    ...computeTotals(itemsPrice, coupon),
  });
});
