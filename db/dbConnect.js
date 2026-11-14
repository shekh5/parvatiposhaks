import mongoose from 'mongoose';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const dbConnect = async (url = config.mongoUrl) => {
  await mongoose.connect(url);
  logger.info('Connected to database successfully');
};

export default dbConnect;
