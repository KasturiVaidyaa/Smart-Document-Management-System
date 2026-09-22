import mongoose from "mongoose";

const connectDb = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGO_URL;
  if (!uri) {
    throw new Error("MONGO_URI (or MONGO_URL) is not set");
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGO_DB_NAME || "smart_cloud_dms",
  });
  console.log("MongoDB connected");
};

export default connectDb;
