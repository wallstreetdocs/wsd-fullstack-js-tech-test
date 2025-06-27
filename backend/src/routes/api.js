/**
 * @fileoverview API routes for task management and analytics
 * @module routes/api
 */

import express from 'express';
import Task from '../models/Task.js';
import AnalyticsService from '../services/analyticsService.js';
import { redisClient } from '../config/redis.js';
import exportService from '../services/exportService.js';
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
 * GET /tasks - Retrieve tasks with pagination, filtering, and sorting
 * @name GetTasks
 * @function
 * @param {Object} req.query - Query parameters
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=10] - Number of tasks per page
 * @param {string} [req.query.status] - Filter by task status
 * @param {string} [req.query.priority] - Filter by task priority
 * @param {string} [req.query.sortBy=createdAt] - Field to sort by
 * @param {string} [req.query.sortOrder=desc] - Sort order (asc/desc)
 * @returns {Object} Paginated tasks with metadata
 */
router.get('/tasks', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      dateStart,
      dateEnd,
      term,
      status,
      priority,
      estimatedTime,
      actualTime,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (dateStart || dateEnd) {
      query.createdAt = {};
      if(dateStart) query.createdAt.$gte = new Date(dateStart);
      if(dateEnd) query.createdAt.$lte = new Date(dateEnd);
    }
    if(term) {
      query.title = { $regex: term, $options: 'i'}
    }
    if(estimatedTime) {
      query.estimatedTime = estimatedTime;
    }
    if (actualTime) {
      query.actualTime = actualTime;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const tasks = await Task.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Task.countDocuments(query);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
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

/**
 * POST /exports - Export endpoint
 */
router.post('/exports', async (req, res) => {
  const { format, filters } = req.body;

  if (!['csv', 'json', 'xlsx'].includes(format)) {
    res.status(400).json({ error: 'Invalid format' });
    return;
  }

  const exportId = await exportService.createExport(format, filters);
  await AnalyticsService.invalidateCacheForExport();

  res.status(201).json({
    exportId,
    status: 'pending',
    message: 'Export process started successfully'
  })
})

/**
 * GET /exports/:id - Export endpoint
 */
router.get('/exports/:id', async (req, res) => {
  const exportDetails = await exportService.getExport(req.params.id);

  res.json({
    status: 'success',
    data: exportDetails
  });
});

router.get('/exports/:id/download', async (req, res, next) => {
  try {
    const exportId = req.params.id;
    const exportDoc = await exportService.getExport(exportId);

    if (exportDoc.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Export is not ready for download'
      });
    }

    const content = await exportService.getExportContent(exportId);

    const contentTypes = {
      csv: 'text/csv',
      json: 'application/json',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    const fileName = `tasks-export-${new Date().toISOString().split('T')[0]}.${exportDoc.format}`;

    res.setHeader('Content-Type', contentTypes[exportDoc.format]);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(content);

  } catch (error) {
    next(error);
  }
});

router.get('/exports', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const exports = await exportService.getExportHistory(page, limit);

  res.json({
    status: 'success',
    data: exports
  });
});

router.delete('/exports/cleanup', async (req, res) => {

  const result = await exportService.deleteExpiredFiles()
  await AnalyticsService.invalidateCacheForExport();
  res.json({
    status: 'success',
    data: result
  });
});

router.get('/analytics/exports', async (req, res) => {
  try {
    const analytics = await AnalyticsService.getExportAnalytics()
    res.json({
      success: true,
      data: analytics
    })
  } catch (error) {
    console.error('Export analytics error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch export analytics'
    })
  }
})
export default router;
