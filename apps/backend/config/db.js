import mongoose from "mongoose";

const connectDB = async (retries = 5) => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    console.log("MongoDB Connected");
    return true;
  } catch (error) {
    console.error(`MongoDB connection failed (${error.message}). Retries left: ${retries - 1}`);
    
    if (retries > 1) {
      console.log("Retrying connection in 3 seconds...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      return connectDB(retries - 1);
    }
    
    console.error("Failed to connect to MongoDB after multiple retries. Server will run without DB.");
    return false;
  }
};

export default connectDB;