import Coupon from '../models/coupon.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import pick from '../utils/pick.js';
import { getPagination, paginate } from '../utils/pagination.js';
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


export const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create(pick(req.body, FIELDS));
  sendResponse(res, 201, 'Coupon created successfully', { coupon });
});

export const getCoupons = asyncHandler(async (req, res) => {
  const { items: coupons, ...page } = await paginate(Coupon, {}, getPagination(req.query));
  sendResponse(res, 200, 'Coupons retrieved successfully', { coupons, ...page });
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError('Coupon not found', 404);
  coupon.set(pick(req.body, FIELDS));
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
