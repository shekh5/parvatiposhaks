import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['percent', 'flat'], required: true },
    value: { type: Number, required: true, min: [0, 'Value cannot be negative'] },
    minOrderValue: { type: Number, default: 0, min: 0 },
    // Cap for percent coupons; null means no cap
    maxDiscount: { type: Number, default: null, min: 0 },
    expiresAt: { type: Date, default: null },
    // Total redemptions allowed; null means unlimited
    usageLimit: { type: Number, default: null, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 1, min: 1 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

couponSchema.path('value').validate(function (value) {
  return this.type !== 'percent' || value <= 100;
}, 'Percent coupons cannot exceed 100');

export default mongoose.model('Coupon', couponSchema);
