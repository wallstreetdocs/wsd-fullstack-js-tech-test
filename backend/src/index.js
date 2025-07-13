/**
 * @fileoverview Main server entry point with Express, Socket.IO, and database connections
 * @module index
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import { connectMongoDB } from './config/database.js';
import { connectRedis } from './config/redis.js';
import JobProcessor from './services/jobProcessor.js';
import swaggerSpecs from './config/swagger.js';
import apiRoutes, { setSocketHandlers } from './routes/api.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import SocketHandlers from './sockets/socketHandlers.js';
import AnalyticsService from './services/analyticsService.js';
import QueueService from './services/queueService.js';
import SocketBroadcastService from './services/socketBroadcastService.js';

dotenv.config();

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Swagger UI setup
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Task Analytics API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      docExpansion: 'list',
      filter: true,
      showRequestHeaders: true,
      tryItOutEnabled: true,
      requestInterceptor: (request) => {
        // Add any default headers if needed
        return request;
      },
      responseInterceptor: (response) => {
        // Process response if needed
        return response;
      }
    }
  })
);

// Serve Swagger JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

app.use('/api', apiRoutes);

// Handle favicon requests to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content response
});

app.get('/', (req, res) => {
  res.json({
    message: 'Task Analytics API Server',
    version: '1.0.0',
    status: 'running',
    documentation: '/api-docs',
    endpoints: {
      tasks: '/api/tasks',
      analytics: '/api/analytics',
      health: '/api/health',
      swagger: '/api-docs'
    }
  });
});

app.use(notFound);
app.use(errorHandler);

const socketHandlers = new SocketHandlers(io);

// Connect socket handlers to API routes for real-time updates
setSocketHandlers(socketHandlers);

// Set socket handlers in SocketBroadcastService for real-time updates
SocketBroadcastService.setSocketHandlers(socketHandlers);

/**
 * Handles graceful server shutdown on SIGTERM/SIGINT signals
 * @param {string} signal - Signal name (SIGTERM/SIGINT)
 */
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.log('⚠️  Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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

    // Fix any existing data issues
    console.log('🔧 Running data consistency checks...');
    await AnalyticsService.fixCompletedTasksData();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('📊 Socket.IO server ready');
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔍 Swagger JSON: http://localhost:${PORT}/api-docs.json`);
    });

    // Start background job processor
    JobProcessor.start();

    // Broadcast analytics updates every 15 seconds (for any missed real-time updates)
    setInterval(async () => {
      try {
        await socketHandlers.broadcastAnalyticsUpdate();
      } catch (error) {
        console.error('Error in metrics broadcast interval:', error);
      }
    }, 15000);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { app, io, socketHandlers };
