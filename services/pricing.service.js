import Coupon from '../models/coupon.model.js';
import ApiError from '../utils/apiError.js';
import config from '../config/index.js';

const round = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;

export function couponDiscount(coupon, itemsPrice) {
  if (!coupon) return 0;
  let discount = coupon.type === 'percent' ? (itemsPrice * coupon.value) / 100 : coupon.value;
  if (coupon.type === 'percent' && coupon.maxDiscount != null) {
    discount = Math.min(discount, coupon.maxDiscount);
  }
  return round(Math.min(discount, itemsPrice));
}

// All order amounts are computed here, on the server, from current prices
export function computeTotals(itemsPrice, coupon = null) {
  const { taxPercent, shippingFee, freeShippingAbove } = config.shop;
  const discount = couponDiscount(coupon, itemsPrice);
  const taxable = itemsPrice - discount;
  const taxPrice = round((taxable * taxPercent) / 100);
  const freeShipping = freeShippingAbove > 0 && taxable >= freeShippingAbove;
  const shippingPrice = freeShipping ? 0 : round(shippingFee);
  return {
    itemsPrice: round(itemsPrice),
    discount,
    taxPrice,
    shippingPrice,
    totalPrice: round(taxable + taxPrice + shippingPrice),
  };
}

// Returns the coupon when this user may use it on this cart; throws otherwise
export async function findValidCoupon(code, userId, itemsPrice) {
  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
  if (!coupon || !coupon.active) throw new ApiError('Invalid coupon code', 400);
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new ApiError('This coupon has expired', 400);
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new ApiError('This coupon has reached its usage limit', 400);
  }
  if (itemsPrice < coupon.minOrderValue) {
    throw new ApiError(`This coupon needs a minimum order of ${coupon.minOrderValue}`, 400);
  }
  if ((coupon.usedBy?.get(String(userId)) || 0) >= coupon.perUserLimit) {
    throw new ApiError('You have already used this coupon', 400);
  }
  return coupon;
}

// Counts one redemption. The total limit and the per-user limit are both
// checked inside the update itself, so concurrent checkouts cannot exceed them.
export async function claimCoupon(coupon, userId) {
  const mine = `usedBy.${userId}`;
  const result = await Coupon.updateOne(
    {
      _id: coupon._id,
      active: true,
      $and: [
        { $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
        { $expr: { $lt: [{ $ifNull: [`$${mine}`, 0] }, '$perUserLimit'] } },
      ],
    },
    { $inc: { usedCount: 1, [mine]: 1 } }
  );
  return result.modifiedCount === 1;
}

export async function releaseCoupon(code, userId) {
  if (!code) return;
  const mine = `usedBy.${userId}`;
  const result = await Coupon.updateOne(
    { code, usedCount: { $gt: 0 }, [mine]: { $gt: 0 } },
    { $inc: { usedCount: -1, [mine]: -1 } }
  );
  // Orders placed before per-user counting only have the total to give back
  if (result.modifiedCount === 0) {
    await Coupon.updateOne({ code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  }
}
