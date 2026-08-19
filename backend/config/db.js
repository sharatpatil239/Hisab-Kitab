const mongoose = require("mongoose");

/**
 * Connects to MongoDB using the connection string in process.env.MONGO_URI.
 * Exits the process if the connection fails, since the app cannot function
 * without a database connection.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
