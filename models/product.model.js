import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  size: { type: String, trim: true },
  color: { type: String, trim: true },
  sku: { type: String, trim: true },
  stock: { type: Number, required: true, min: [0, 'Stock cannot be negative'], default: 0 },
  // Optional override; the product price applies when this is not set
  price: { type: Number, min: [0, 'Price cannot be negative'] },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Please enter product name'], trim: true },
    description: { type: String, required: [true, 'Please enter product description'] },
    price: {
      type: Number,
      required: [true, 'Please enter product price'],
      min: [0, 'Price cannot be negative'],
      max: [99999999, 'Price cannot exceed 8 digits'],
    },
    // Optional list price. When it is higher than price, the storefront shows a discount
    mrp: { type: Number, min: [0, 'MRP cannot be negative'], default: null },
    ratings: { type: Number, default: 0 },
    numOfReviews: { type: Number, default: 0 },
    images: [
      {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    category: { type: String, required: [true, 'Please enter product category'], index: true },
    // With variants, this is always the sum of the variant stocks
    stock: {
      type: Number,
      required: [true, 'Please enter product stock'],
      min: [0, 'Stock cannot be negative'],
      max: [9999999, 'Stock cannot exceed 7 digits'],
      default: 1,
    },
    variants: [variantSchema],
    user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

productSchema.pre('validate', function () {
  if (this.variants && this.variants.length > 0) {
    this.stock = this.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
  }
});

export default mongoose.model('Product', productSchema);
