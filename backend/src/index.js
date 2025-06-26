/**
 * @fileoverview Main server entry point with Express, Socket.IO, and database connections
 * @module index
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import { connectMongoDB } from './config/database.js';
import { connectRedis } from './config/redis.js';
import apiRoutes, { setSocketHandlers } from './routes/api.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import SocketHandlers from './sockets/socketHandlers.js';
import AnalyticsService from './services/analyticsService.js';
import workerPool from './services/workerPool.js';
import jobQueue from './services/jobQueue.js';
import tempFileCleanupService from './services/tempFileCleanupService.js';

dotenv.config();

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Add debug listener for all Socket.IO events
if (process.env.NODE_ENV !== 'production') {
  io.on('connection', (socket) => {
    console.log(`💡 Debug: Socket connection established: ${socket.id}`);
    
    // Listen for all packets
    socket.onAny((event, ...args) => {
      console.log(`💡 Debug: Socket ${socket.id} event: ${event}`, args);
    });
  });
}

const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Task Analytics API Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      tasks: '/api/tasks',
      analytics: '/api/analytics',
      health: '/api/health'
    }
  });
});

app.use(notFound);
app.use(errorHandler);

const socketHandlers = new SocketHandlers(io);

// Connect socket handlers to API routes for real-time updates
setSocketHandlers(socketHandlers);

/**
 * Handles graceful server shutdown on SIGTERM/SIGINT signals
 * @param {string} signal - Signal name (SIGTERM/SIGINT)
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  try {
    // Shutdown worker pool
    console.log('Shutting down worker pool...');
    await workerPool.shutdown();
    
    // Pause job queue
    console.log('Pausing job queue...');
    await jobQueue.pause();
    
    // Shutdown temp file cleanup service
    console.log('Shutting down temp file cleanup service...');
    tempFileCleanupService.shutdown();
    
    // Close server
    server.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.log('⚠️  Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
  // Log but don't exit for unhandled rejections
});

/**
 * Initializes database connections and starts the Express server
 * @async
 * @function startServer
 * @returns {Promise<void>} Resolves when server is ready
 */
const startServer = async () => {
  try {
    await connectMongoDB();
    await connectRedis();

    // Initialize worker pool
    console.log('🧵 Initializing worker thread pool...');
    workerPool.initialize();
    
    // Initialize job queue
    console.log('🔄 Initializing job queue...');
    await jobQueue.initialize();

    // Fix any existing data issues
    console.log('🔧 Running data consistency checks...');
    await AnalyticsService.fixCompletedTasksData();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('📊 Socket.IO server ready');
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Broadcast analytics updates every 15 seconds (for any missed real-time updates)
    setInterval(async () => {
      try {
        await socketHandlers.broadcastAnalyticsUpdate();
      } catch (error) {
        console.error('Error in metrics broadcast interval:', error);
      }
    }, 15000);

    // Clean up completed/failed jobs periodically (every hour)
    setInterval(async () => {
      try {
        const cleanedCount = await jobQueue.cleanup();
        if (cleanedCount > 0) {
          console.log(`Cleaned up ${cleanedCount} old export jobs`);
        }
      } catch (error) {
        console.error('Error cleaning up jobs:', error);
      }
    }, 3600000);

    // Initialize temp file cleanup service (runs every 24 hours)
    console.log('🧹 Initializing temp file cleanup service...');
    tempFileCleanupService.initialize();
    
    // Also clean up temp files periodically (every 12 hours)
    setInterval(async () => {
      try {
        const cleanedCount = await tempFileCleanupService.cleanupTempFiles();
        const cacheCleanedCount = await tempFileCleanupService.cleanupExportCache();
        if (cleanedCount > 0 || cacheCleanedCount > 0) {
          console.log(`Cleaned up ${cleanedCount} temp files and ${cacheCleanedCount} cache entries`);
        }
      } catch (error) {
        console.error('Error cleaning up temp files:', error);
      }
    }, 43200000); // 12 hours

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, io, socketHandlers };