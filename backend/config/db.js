const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.warn("MONGO_URI not set. Running without MongoDB persistence.");
    return false;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("MongoDB connected.");
    return true;
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    return false;
  }
};

module.exports = { connectDB };
