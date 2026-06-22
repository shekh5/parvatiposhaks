import moongoose from 'mongoose';

const dbConnect = async () => {
  await moongoose.connect(process.env.MONGO_DB_URL);
  console.log('connected to database successfully');
};

export default dbConnect;
