const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas via Mongoose
 * Reads MONGODB_URI from environment variables
 */
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri || uri.includes('YOUR_PASSWORD') || uri.includes('cluster0.abcde')) {
      console.warn('⚠️  MONGODB_URI is not configured with valid credentials in .env.');
      console.warn('👉 Please update MONGODB_URI in backend/.env with your MongoDB Atlas connection string.');
      console.warn('ℹ️  The backend server is running in offline/standby mode for database operations.');
      return false;
    }

    const conn = await mongoose.connect(uri, {
      dbName: 'studentDB',
    });

    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.host}`);
    console.log(`📦 Database: ${conn.connection.name}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB Atlas Connection Error:', error.message);
    console.error('👉 Verify network access (IP 0.0.0.0/0 allowed) and user credentials in MongoDB Atlas.');
    return false;
  }
};

module.exports = connectDB;
