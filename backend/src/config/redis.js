/**
 * @fileoverview Redis cache configuration and connection management
 * @module config/redis
 */

import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Redis client instance configured with connection settings and event handlers
 * @type {Redis}
 * @description Configured with lazy connection, retry logic, and environment-based settings
 */
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6380,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

redisClient.on('ready', () => {
  console.log('🚀 Redis is ready to accept commands');
});

/**
 * Establishes connection to Redis cache server
 * @async
 * @function connectRedis
 * @returns {Promise<void>} Resolves when connection is established or logs error on failure
 * @example
 * import { connectRedis } from './config/redis.js';
 * await connectRedis();
 */
const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
  }
};

export { redisClient, connectRedis };
