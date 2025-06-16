/**
 * @fileoverview MongoDB database configuration and connection management
 * @module config/database
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Establishes connection to MongoDB database with proper error handling and event listeners
 * @async
 * @function connectMongoDB
 * @throws {Error} Exits process with code 1 if connection fails
 * @returns {Promise<void>} Resolves when connection is established
 * @example
 * import { connectMongoDB } from './config/database.js';
 * await connectMongoDB();
 */
const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27018/task_analytics';

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });

    console.log('✅ MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export { connectMongoDB };
