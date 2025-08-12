import mongoose from "mongoose";

export const connectDB = async (mongoUri : string) => {
    try {
        await mongoose.connect(mongoUri); 
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
} 