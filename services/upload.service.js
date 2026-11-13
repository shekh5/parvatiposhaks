import { v2 as cloudinary } from 'cloudinary';
import config from '../config/index.js';
import ApiError from '../utils/apiError.js';
import logger from '../utils/logger.js';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

// The avatar can arrive as a multipart file or as a data URI / URL string in the body
export const getAvatarInput = (req) => {
  const file = req.files?.avatar;
  if (file) {
    if (!file.mimetype?.startsWith('image/')) throw new ApiError('Avatar must be an image', 400);
    return `data:${file.mimetype};base64,${file.data.toString('base64')}`;
  }
  const value = req.body?.avatar;
  return typeof value === 'string' && value.trim() ? value : null;
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
