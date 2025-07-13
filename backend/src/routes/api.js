/**
 * @fileoverview API routes for task management and analytics
 * @module routes/api
 */

import express from 'express';
import { createReadStream } from 'fs';
import Task from '../models/Task.js';
import AnalyticsService from '../services/analyticsService.js';
import { redisClient } from '../config/redis.js';
import { buildTaskQuery, buildSortQuery, sanitizeFilters } from '../services/queryBuilderService.js';
import { exportTasks, getExportHistory } from '../services/exportService.js';

const router = express.Router();

/**
 * Socket handlers reference for real-time updates
 * @type {Object|null}
 */
let socketHandlers = null;

/**
 * Sets socket handlers for broadcasting real-time updates
 * @param {Object} handlers - Socket handler object with broadcast methods
 * @example
 * setSocketHandlers(socketHandlers);
 */
export const setSocketHandlers = (handlers) => {
  socketHandlers = handlers;
};

/**
 * POST /export/tasks - Export tasks with advanced filtering
 * @name ExportTasks
 * @function
 * @param {Object} req.body - Export parameters
 * @param {string} [req.body.format=csv] - Export format (csv, json)
 * @param {string|string[]} [req.body.status] - Filter by task status
 * @param {string|string[]} [req.body.priority] - Filter by task priority
 * @param {string} [req.body.createdAfter] - Filter tasks created after date
 * @param {string} [req.body.createdBefore] - Filter tasks created before date
 * @param {string} [req.body.completedAfter] - Filter tasks completed after date
 * @param {string} [req.body.completedBefore] - Filter tasks completed before date
 * @param {string} [req.body.updatedAfter] - Filter tasks updated after date
 * @param {string} [req.body.updatedBefore] - Filter tasks updated before date
 * @param {string} [req.body.createdWithin] - Filter by predefined date range
 * @param {string} [req.body.completedWithin] - Filter by predefined completion date range
 * @param {boolean} [req.body.overdueTasks] - Filter for overdue tasks
 * @param {boolean} [req.body.recentlyCompleted] - Filter for recently completed tasks
 * @param {number} [req.body.estimatedTimeMin] - Minimum estimated time
 * @param {number} [req.body.estimatedTimeMax] - Maximum estimated time
 * @param {number} [req.body.actualTimeMin] - Minimum actual time
 * @param {number} [req.body.actualTimeMax] - Maximum actual time
 * @param {boolean} [req.body.underEstimated] - Filter for under-estimated tasks
 * @param {boolean} [req.body.overEstimated] - Filter for over-estimated tasks
 * @param {boolean} [req.body.noEstimate] - Filter for tasks without estimated time
 * @returns {Object} File download response
 */
router.post('/export/tasks', async (req, res, next) => {
  try {
    const { format = 'csv', ...rawFilters } = req.body;
    // Sanitize filters
    const filters = sanitizeFilters(rawFilters);

    // Prepare request info for tracking
    const requestInfo = {
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    };

    // Export tasks using the export service (creates temporary file)
    const exportResult = await exportTasks(filters, format, requestInfo);

    // Set appropriate headers for file download
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    res.setHeader('X-Export-Metadata', JSON.stringify({
      taskCount: exportResult.taskCount,
      format: exportResult.format,
      generatedAt: exportResult.generatedAt,
      processingTime: exportResult.processingTime,
      exportId: exportResult.exportId,
      fileSizeBytes: exportResult.fileSizeBytes
    }));

    // Stream the temporary file to HTTP response
    const readStream = createReadStream(exportResult.filePath, { encoding: 'utf8' });

    // Handle streaming errors
    readStream.on('error', (error) => {
      console.error('Error streaming export file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming export file'
        });
      }
    });

    // Pipe the file stream directly to the HTTP response
    readStream.pipe(res);

    // Clean up the temporary file after streaming completes
    readStream.on('end', () => {
      console.log(`Export completed: ${exportResult.filename} (${exportResult.taskCount} tasks)`);
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /tasks - Retrieve tasks with advanced filtering, pagination, and sorting
 * @name GetTasks
 * @function
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of tasks per page
 * @param {string|string[]} [req.query.status] - Filter by task status (single value or comma-separated)
 * @param {string|string[]} [req.query.priority] - Filter by task priority (single value or comma-separated)
 * @param {string} [req.query.createdAfter] - Filter tasks created after date (ISO string)
 * @param {string} [req.query.createdBefore] - Filter tasks created before date (ISO string)
 * @param {string} [req.query.completedAfter] - Filter tasks completed after date (ISO string)
 * @param {string} [req.query.completedBefore] - Filter tasks completed before date (ISO string)
 * @param {string} [req.query.updatedAfter] - Filter tasks updated after date (ISO string)
 * @param {string} [req.query.updatedBefore] - Filter tasks updated before date (ISO string)
 * @param {string} [req.query.createdWithin] - Filter by predefined date range (last-7-days, last-30-days, last-90-days)
 * @param {string} [req.query.completedWithin] - Filter by predefined completion date range
 * @param {boolean} [req.query.overdueTasks] - Filter for overdue tasks (in-progress > 7 days)
 * @param {boolean} [req.query.recentlyCompleted] - Filter for recently completed tasks (< 7 days)
 * @param {number} [req.query.estimatedTimeMin] - Minimum estimated time in minutes
 * @param {number} [req.query.estimatedTimeMax] - Maximum estimated time in minutes
 * @param {number} [req.query.actualTimeMin] - Minimum actual time in minutes
 * @param {number} [req.query.actualTimeMax] - Maximum actual time in minutes
 * @param {boolean} [req.query.underEstimated] - Filter for tasks that took longer than estimated
 * @param {boolean} [req.query.overEstimated] - Filter for tasks that took less than estimated
 * @param {boolean} [req.query.noEstimate] - Filter for tasks without estimated time
 * @param {string} [req.query.sortBy=createdAt] - Field to sort by
 * @param {string} [req.query.sortOrder=desc] - Sort order (asc/desc)
 * @returns {Object} Paginated tasks with metadata and applied filters
 */
router.get('/tasks', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      ...rawFilters
    } = req.query;

    // Sanitize and validate filters
    const filters = sanitizeFilters(rawFilters);

    // Build MongoDB query using the reusable query builder
    const query = buildTaskQuery(filters);
    const sort = buildSortQuery(filters);
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;

    const tasks = await Task.find(query)
      .sort(sort)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .exec();

    const total = await Task.countDocuments(query);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /tasks/:id - Retrieve a specific task by ID with Redis caching
 * @name GetTaskById
 * @function
 * @param {string} req.params.id - Task ID
 * @returns {Object} Task data or 404 if not found
 */
router.get('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const cacheKey = `task:${id}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached)
      });
    }

    const task = await Task.findById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await redisClient.setex(cacheKey, 300, JSON.stringify(task));

    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /tasks - Create a new task
 * @name CreateTask
 * @function
 * @param {Object} req.body - Task data
 * @param {string} req.body.title - Task title (required)
 * @param {string} [req.body.description] - Task description
 * @param {string} [req.body.priority] - Task priority
 * @param {number} [req.body.estimatedTime] - Estimated completion time
 * @returns {Object} Created task with success message
 */
router.post('/tasks', async (req, res, next) => {
  try {
    const { title, description, priority, estimatedTime } = req.body;

    const task = new Task({
      title,
      description,
      priority,
      estimatedTime
    });

    await task.save();

    await AnalyticsService.invalidateCache();

    // Broadcast real-time update
    if (socketHandlers) {
      socketHandlers.broadcastTaskUpdate('created', task);
    }

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /tasks/:id - Update an existing task
 * @name UpdateTask
 * @function
 * @param {string} req.params.id - Task ID to update
 * @param {Object} req.body - Updated task data
 * @returns {Object} Updated task data or 404 if not found
 */
router.put('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const task = await Task.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await redisClient.del(`task:${id}`);
    await AnalyticsService.invalidateCache();

    // Broadcast real-time update
    if (socketHandlers) {
      socketHandlers.broadcastTaskUpdate('updated', task);
    }

    res.json({
      success: true,
      data: task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /tasks/:id - Delete a task by ID
 * @name DeleteTask
 * @function
 * @param {string} req.params.id - Task ID to delete
 * @returns {Object} Success message or 404 if not found
 */
router.delete('/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const task = await Task.findByIdAndDelete(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await redisClient.del(`task:${id}`);
    await AnalyticsService.invalidateCache();

    // Broadcast real-time update
    if (socketHandlers) {
      socketHandlers.broadcastTaskUpdate('deleted', task);
    }

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics - Retrieve comprehensive task analytics
 * @name GetAnalytics
 * @function
 * @returns {Object} Complete analytics data including metrics and charts
 */
router.get('/analytics', async (req, res, next) => {
  try {
    const metrics = await AnalyticsService.getTaskMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /exports - Retrieve export history with filtering and pagination
 * @name GetExportHistory
 * @function
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @param {string|string[]} [req.query.status] - Filter by status (pending, completed, failed)
 * @param {string|string[]} [req.query.format] - Filter by format (csv, json)
 * @param {string} [req.query.sortBy=createdAt] - Sort field
 * @param {string} [req.query.sortOrder=desc] - Sort order (asc, desc)
 * @param {string} [req.query.dateFrom] - Filter exports from date
 * @param {string} [req.query.dateTo] - Filter exports to date
 * @returns {Object} Paginated export history
 */
router.get('/exports', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      format,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateFrom,
      dateTo
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      format,
      sortBy,
      sortOrder,
      dateFrom,
      dateTo
    };

    const result = await getExportHistory(options);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /health - Health check endpoint
 * @name HealthCheck
 * @function
 * @returns {Object} API health status and timestamp
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
