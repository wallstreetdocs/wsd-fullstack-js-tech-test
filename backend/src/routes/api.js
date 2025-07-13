/**
 * @fileoverview API routes for task management and analytics
 * @module routes/api
 */

import express from 'express';
import Task from '../models/Task.js';
import Export from '../models/Export.js';
import AnalyticsService from '../services/analyticsService.js';
import ExportService from '../services/exportService.js';
import QueueService from '../services/queueService.js';
import JobProcessor from '../services/jobProcessor.js';
import SocketBroadcastService from '../services/socketBroadcastService.js';
import { redisClient } from '../config/redis.js';

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
  console.log('🔧 Setting socket handlers:', !!handlers);
  socketHandlers = handlers;
};

/**
 * Parse query parameters for advanced filtering
 * @param {Object} query - Express query object
 * @returns {Object} Parsed filters and options
 */
const parseQueryParams = (query) => {
  const filters = {};
  const options = {};

  // Basic filters
  if (query.search) filters.search = query.search;
  if (query.title) filters.title = query.title;
  if (query.description) filters.description = query.description;

  // Status and priority (support arrays)
  if (query.status) {
    filters.status = query.status.includes(',')
      ? query.status.split(',')
      : query.status;
  }
  if (query.priority) {
    filters.priority = query.priority.includes(',')
      ? query.priority.split(',')
      : query.priority;
  }

  // Date ranges
  if (query.createdAtStart || query.createdAtEnd) {
    filters.createdAtRange = {};
    if (query.createdAtStart)
      filters.createdAtRange.start = query.createdAtStart;
    if (query.createdAtEnd) filters.createdAtRange.end = query.createdAtEnd;
  }

  if (query.updatedAtStart || query.updatedAtEnd) {
    filters.updatedAtRange = {};
    if (query.updatedAtStart)
      filters.updatedAtRange.start = query.updatedAtStart;
    if (query.updatedAtEnd) filters.updatedAtRange.end = query.updatedAtEnd;
  }

  if (query.completedAtStart || query.completedAtEnd) {
    filters.completedAtRange = {};
    if (query.completedAtStart)
      filters.completedAtRange.start = query.completedAtStart;
    if (query.completedAtEnd)
      filters.completedAtRange.end = query.completedAtEnd;
  }

  // Completion status
  if (query.isCompleted !== undefined) {
    filters.isCompleted = query.isCompleted === 'true';
  }

  // Time ranges
  if (query.estimatedTimeMin || query.estimatedTimeMax) {
    filters.estimatedTimeRange = {};
    if (query.estimatedTimeMin)
      filters.estimatedTimeRange.min = parseInt(query.estimatedTimeMin);
    if (query.estimatedTimeMax)
      filters.estimatedTimeRange.max = parseInt(query.estimatedTimeMax);
  }

  if (query.actualTimeMin || query.actualTimeMax) {
    filters.actualTimeRange = {};
    if (query.actualTimeMin)
      filters.actualTimeRange.min = parseInt(query.actualTimeMin);
    if (query.actualTimeMax)
      filters.actualTimeRange.max = parseInt(query.actualTimeMax);
  }

  // Existence filters
  if (query.hasEstimatedTime !== undefined) {
    filters.hasEstimatedTime = query.hasEstimatedTime === 'true';
  }
  if (query.hasActualTime !== undefined) {
    filters.hasActualTime = query.hasActualTime === 'true';
  }

  // Time efficiency
  if (query.timeEfficiency) {
    filters.timeEfficiency = query.timeEfficiency;
  }

  // Custom conditions
  if (query.where) {
    try {
      filters.where = JSON.parse(query.where);
    } catch {
      // Ignore invalid JSON
    }
  }

  if (query.orWhere) {
    try {
      filters.orWhere = JSON.parse(query.orWhere);
    } catch {
      // Ignore invalid JSON
    }
  }

  if (query.andWhere) {
    try {
      filters.andWhere = JSON.parse(query.andWhere);
    } catch {
      // Ignore invalid JSON
    }
  }

  // Options
  if (query.sortBy) options.sortBy = query.sortBy;
  if (query.sortOrder) options.sortOrder = query.sortOrder;
  if (query.select) options.select = query.select;
  if (query.page) options.page = parseInt(query.page);
  if (query.limit) options.limit = parseInt(query.limit);

  return { filters, options };
};

// GET /tasks - Retrieve tasks with comprehensive filtering, pagination, and sorting
router.get('/tasks', async (req, res, next) => {
  try {
    const { filters, options } = parseQueryParams(req.query);

    // Set defaults
    options.page = options.page || 1;
    options.limit = options.limit || 10;
    options.sortBy = options.sortBy || 'createdAt';
    options.sortOrder = options.sortOrder || 'desc';

    const result = await Task.advancedSearch(filters, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// GET /tasks/search - Advanced search endpoint with full-text search
router.get('/tasks/search', async (req, res, next) => {
  try {
    const { q, filters: filtersStr, options: optionsStr } = req.query;

    let filters = {};
    let options = {};

    if (q) {
      filters.search = q;
    }

    if (filtersStr) {
      try {
        filters = { ...filters, ...JSON.parse(filtersStr) };
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid filters JSON'
        });
      }
    }

    if (optionsStr) {
      try {
        options = JSON.parse(optionsStr);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid options JSON'
        });
      }
    }

    // Set defaults
    options.page = options.page || 1;
    options.limit = options.limit || 10;
    options.sortBy = options.sortBy || 'createdAt';
    options.sortOrder = options.sortOrder || 'desc';

    const result = await Task.advancedSearch(filters, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// POST /tasks/query - Raw query builder endpoint for complex queries
router.post('/tasks/query', async (req, res, next) => {
  try {
    const { filters = {}, options = {} } = req.body;

    // Set defaults
    options.page = options.page || 1;
    options.limit = options.limit || 10;
    options.sortBy = options.sortBy || 'createdAt';
    options.sortOrder = options.sortOrder || 'desc';

    const result = await Task.advancedSearch(filters, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// GET /tasks/stats - Get task statistics and counts
router.get('/tasks/stats', async (req, res, next) => {
  try {
    const { filters } = parseQueryParams(req.query);

    const builder = Task.queryBuilder();

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (builder[key] && typeof builder[key] === 'function') {
        builder[key](value);
      }
    });

    // Get counts for different statuses
    const totalCount = await builder.count();

    const pendingCount = await Task.queryBuilder()
      .where(filters)
      .status('pending')
      .count();

    const inProgressCount = await Task.queryBuilder()
      .where(filters)
      .status('in-progress')
      .count();

    const completedCount = await Task.queryBuilder()
      .where(filters)
      .status('completed')
      .count();

    // Priority counts
    const lowPriorityCount = await Task.queryBuilder()
      .where(filters)
      .priority('low')
      .count();

    const mediumPriorityCount = await Task.queryBuilder()
      .where(filters)
      .priority('medium')
      .count();

    const highPriorityCount = await Task.queryBuilder()
      .where(filters)
      .priority('high')
      .count();

    // Time efficiency stats
    const overEstimatedCount = await Task.queryBuilder()
      .where(filters)
      .timeEfficiency('over-estimated')
      .count();

    const underEstimatedCount = await Task.queryBuilder()
      .where(filters)
      .timeEfficiency('under-estimated')
      .count();

    const accurateCount = await Task.queryBuilder()
      .where(filters)
      .timeEfficiency('accurate')
      .count();

    res.json({
      success: true,
      data: {
        total: totalCount,
        byStatus: {
          pending: pendingCount,
          'in-progress': inProgressCount,
          completed: completedCount
        },
        byPriority: {
          low: lowPriorityCount,
          medium: mediumPriorityCount,
          high: highPriorityCount
        },
        byTimeEfficiency: {
          'over-estimated': overEstimatedCount,
          'under-estimated': underEstimatedCount,
          accurate: accurateCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /tasks/:id - Retrieve a specific task by ID with Redis caching
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

// POST /tasks - Create a new task
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

// PUT /tasks/:id - Update an existing task
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

// DELETE /tasks/:id - Delete a task by ID
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

// GET /analytics - Retrieve comprehensive task analytics
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

// GET /health - Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

// GET /test-socket - Test socket communication
router.get('/test-socket', (req, res) => {
  if (!socketHandlers) {
    return res.status(500).json({
      success: false,
      message: 'Socket handlers not initialized'
    });
  }

  console.log('🧪 Testing socket communication...');

  // Test export progress
  socketHandlers.broadcastExportProgress(
    'test-export-id',
    'processing',
    'Testing socket communication...'
  );

  // Test notification
  socketHandlers.broadcastNotification('Socket test notification', 'info');

  res.json({
    success: true,
    message: 'Socket test events sent',
    timestamp: new Date().toISOString()
  });
});

// ===== EXPORT ROUTES =====

// POST /exports - Create a new export
router.post('/exports', async (req, res, next) => {
  try {
    const { format, filters = {}, options = {} } = req.body;

    if (!format || !['csv', 'json'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Format must be either "csv" or "json"'
      });
    }

    // Create temporary export record to generate cache key
    const tempExport = new Export({
      format,
      filters,
      options
    });

    // Generate cache key
    const cacheKey = tempExport.generateCacheKey();

    // Check if an export with the same cache key already exists
    const existingExport = await Export.findByCacheKey(cacheKey);

    if (existingExport) {
      // If a completed export exists, return it immediately
      if (existingExport.status === 'completed') {
        return res.json({
          success: true,
          data: existingExport,
          message: 'Export already exists and is completed'
        });
      }

      // If a pending/processing export exists, return it
      if (
        existingExport.status === 'pending' ||
        existingExport.status === 'processing'
      ) {
        return res.json({
          success: true,
          data: existingExport,
          message: 'Export already exists and is in progress'
        });
      }
    }

    // Create new export record
    const exportRecord = new Export({
      format,
      filters,
      options,
      cacheKey
    });

    await exportRecord.save();

    // Add job to queue
    await QueueService.addExportJob({
      exportId: exportRecord._id.toString(),
      format,
      filters,
      options
    });

    // Send initial progress update via SocketBroadcastService
    await SocketBroadcastService.broadcastExportQueued(
      exportRecord._id.toString()
    );

    res.status(201).json({
      success: true,
      data: exportRecord,
      message: 'Export queued successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /exports - Get export history
router.get('/exports', async (req, res, next) => {
  try {
    const { limit = 10, status, format } = req.query;

    const exports = await ExportService.getExportHistory({
      limit: parseInt(limit),
      status,
      format
    });

    res.json({
      success: true,
      data: exports
    });
  } catch (error) {
    next(error);
  }
});

// GET /exports/stats - Get export statistics
router.get('/exports/stats', async (req, res, next) => {
  try {
    const stats = await ExportService.getExportStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// GET /exports/:id - Get export by ID
router.get('/exports/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const exportRecord = await ExportService.getExportById(id);

    if (!exportRecord) {
      return res.status(404).json({
        success: false,
        message: 'Export not found'
      });
    }

    res.json({
      success: true,
      data: exportRecord
    });
  } catch (error) {
    next(error);
  }
});

// GET /exports/queue/status - Get queue status
router.get('/exports/queue/status', async (req, res, next) => {
  try {
    const queueLength = await QueueService.getQueueLength();
    const stats = await JobProcessor.getStats();

    res.json({
      success: true,
      data: {
        queueLength,
        processorStatus: stats.processorStatus,
        timestamp: stats.timestamp
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /exports/queue/clear - Clear the export queue
router.post('/exports/queue/clear', async (req, res, next) => {
  try {
    await QueueService.clearQueue();

    res.json({
      success: true,
      message: 'Export queue cleared successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /exports/:id/download - Download export file
router.get('/exports/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;

    const fileData = await ExportService.downloadExport(id);

    res.setHeader(
      'Content-Type',
      fileData.format === 'csv' ? 'text/csv' : 'application/json'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileData.filename}"`
    );

    res.send(fileData.content);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
});

// DELETE /exports/cleanup - Clean up old exports
router.delete('/exports/cleanup', async (req, res, next) => {
  try {
    const { daysOld = 7 } = req.query;

    const deletedCount = await ExportService.cleanupOldExports(
      parseInt(daysOld)
    );

    res.json({
      success: true,
      data: { deletedCount },
      message: `Cleaned up ${deletedCount} old exports`
    });
  } catch (error) {
    next(error);
  }
});

export default router;
