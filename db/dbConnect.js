import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const dbConnect = async () => {
  await mongoose.connect(process.env.MONGO_DB_URL);
  logger.info('Connected to database successfully');
};

export default dbConnect;
