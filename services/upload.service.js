import { v2 as cloudinary } from 'cloudinary';
import config from '../config/index.js';
import ApiError from '../utils/apiError.js';
import logger from '../utils/logger.js';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

const IMAGE_DATA_URI = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;

// The avatar can arrive as a multipart file or as an image data URI in the body
export const getAvatarInput = (req) => {
  const file = req.files?.avatar;
  if (file) {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype || '')) {
      throw new ApiError('Avatar must be a PNG, JPEG, WebP or GIF image', 400);
    }
    return `data:${file.mimetype};base64,${file.data.toString('base64')}`;
  }
  const value = req.body?.avatar;
  if (typeof value !== 'string' || !value.trim()) return null;
  // Only image data sent by the browser. A web address here would make the
  // image host fetch a URL chosen by the visitor.
  if (!IMAGE_DATA_URI.test(value)) {
    throw new ApiError('Avatar must be a PNG, JPEG, WebP or GIF image', 400);
  }
  return value;
};

export async function uploadAvatar(source) {
  try {
    const result = await cloudinary.uploader.upload(source, {
      folder: 'avatars',
      width: 150,
      crop: 'scale',
    });
    return { public_id: result.public_id, url: result.secure_url || result.url };
  } catch (error) {
    throw new ApiError('Avatar upload failed. Please choose a valid image.', 400);
  }
}

// Removing an old image is best effort; a failure must not block the request
export async function deleteImage(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    logger.warn(`Failed to delete image ${publicId}: ${error.message}`);
  }
}
