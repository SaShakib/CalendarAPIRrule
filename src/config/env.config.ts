import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || "mongodb://localhost:27017/calendar",
  DEFAULT_RANGE_DAYS: Number(process.env.DEFAULT_RANGE_DAYS || 365),
};
