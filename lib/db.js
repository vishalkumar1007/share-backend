import mongoose from 'mongoose';

let cached = global.__mongoose;

if (!cached) {
  cached = global.__mongoose = { conn: null, promise: null };
}

const connectDb = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URL, {
        serverSelectionTimeoutMS: 10000,
      })
      .then((connection) => {
        console.log('[db] mongodb connected');
        return connection;
      })
      .catch((error) => {
        cached.promise = null;
        console.error(`[db] connection error: ${error?.message}`);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

export default connectDb;
