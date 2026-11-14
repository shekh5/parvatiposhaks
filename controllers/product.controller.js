import Product from '../models/product.model.js';
import Review from '../models/review.model.js';
import ApiError from '../utils/apiError.js';
import ApiFeatures from '../utils/apiFeatures.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/apiResponse.js';
import config from '../config/index.js';

const EDITABLE = ['name', 'description', 'price', 'mrp', 'category', 'stock', 'images', 'variants'];

// Only whitelisted fields ever reach the database
const pick = (body) =>
  EDITABLE.reduce((picked, key) => {
    if (body[key] !== undefined) picked[key] = body[key];
    return picked;
  }, {});

// Images saved from a local path are served from /images
const normalizeImages = (images) =>
  images.map((img) => ({
    public_id: img.public_id,
    url:
      img.url.includes('backend') || img.url.includes('./')
        ? '/images/' + img.url.split('/').pop()
        : img.url,
  }));

export const createProduct = asyncHandler(async (req, res) => {
  const data = pick(req.body);
  if (data.images) data.images = normalizeImages(data.images);
  const product = await Product.create({ ...data, user: req.user._id });
  sendResponse(res, 201, 'Product created successfully', { product });
});

export const getAllProducts = asyncHandler(async (req, res) => {
  const features = new ApiFeatures(Product.find(), req.query, config.shop.resultsPerPage)
    .search()
    .filter();

  const productCount = await features.query.clone().countDocuments();
  const products = await features.sort().paginate().query;

  sendResponse(res, 200, 'Products retrieved successfully', {
    products,
    productCount,
    resultPerPage: features.limit,
    totalPages: Math.ceil(productCount / features.limit),
    currentPage: features.page,
  });
});

export const getAdminProducts = asyncHandler(async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  sendResponse(res, 200, 'Products retrieved successfully', { products, count: products.length });
});

export const getSingleProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError('Product not found', 404);
  sendResponse(res, 200, 'Product retrieved successfully', { product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError('Product not found', 404);

  const data = pick(req.body);
  if (data.images) data.images = normalizeImages(data.images);
  product.set(data);
  await product.save(); // save, not findByIdAndUpdate, so validators and the stock hook run

  sendResponse(res, 200, 'Product updated successfully', { product });
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new ApiError('Product not found', 404);
  await Review.deleteMany({ product: product._id });
  sendResponse(res, 200, 'Product deleted successfully');
});
