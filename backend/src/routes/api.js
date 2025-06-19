/**
 * @fileoverview API routes for task management and analytics
 * @module routes/api
 */

import express from 'express';
import Task from '../models/Task.js';
import ExportJob from '../models/ExportJob.js';
import AnalyticsService from '../services/analyticsService.js';
import ExportService from '../services/exportService.js';
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
      status,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

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
    
    // Invalidate export cache for all possible formats and filter combinations
    await ExportService.invalidateExportCache({ format: 'csv' });
    await ExportService.invalidateExportCache({ format: 'json' });

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
    
    // Invalidate export cache for all possible formats and filter combinations
    await ExportService.invalidateExportCache({ format: 'csv' });
    await ExportService.invalidateExportCache({ format: 'json' });

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
    
    // Invalidate export cache for all possible formats and filter combinations
    await ExportService.invalidateExportCache({ format: 'csv' });
    await ExportService.invalidateExportCache({ format: 'json' });

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
 * POST /exportTasks - Start a background task export process
 * @name exportTasks
 * @function
 * @param {Object} req.body - Request body
 * @param {string} req.body.format - Export format ('csv' or 'json')
 * @param {Object} req.body.filters - Filter parameters
 * @returns {Object} Export job metadata
 */
router.post('/exportTasks', async (req, res, next) => {
  try {
    const { format, filters } = req.body;
    
    // Validate format
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Must be csv or json.'
      });
    }
    
    // Create an export job using the export service
    const exportJob = await ExportService.createExportJob({
      format,
      filters
    });
    
    // Log export job creation
    console.log('Export job created:', { jobId: exportJob._id, format, filters });
    
    // Return the job ID and status
    res.status(202).json({
      success: true,
      data: {
        jobId: exportJob._id,
        status: exportJob.status
      },
      message: 'Export job created successfully'
    });
    
    // If socket handlers are available, notify clients about new export job
    if (socketHandlers) {
      socketHandlers.broadcastNotification(
        `Export job started: ${format.toUpperCase()} export`,
        'info'
      );
      
      // Start processing the job in the background
      const progressCallback = (updatedJob) => {
        // Find the socket for the client that created the job
        if (socketHandlers) {
          // Only broadcast occasional progress updates to avoid noise
          if (updatedJob.progress % 20 === 0 || updatedJob.status === 'completed') {
            socketHandlers.broadcastNotification(
              `Export progress: ${updatedJob.progress}% complete`,
              'info'
            );
          }
          
          // Emit progress events for all updates
          socketHandlers.io.emit('export-progress', {
            jobId: updatedJob._id,
            status: updatedJob.status,
            progress: updatedJob.progress,
            processedItems: updatedJob.processedItems,
            totalItems: updatedJob.totalItems
          });
          
          // If job completed, send completion notification
          if (updatedJob.status === 'completed') {
            socketHandlers.io.emit('export-completed', {
              jobId: updatedJob._id,
              filename: updatedJob.filename
            });
            
            socketHandlers.broadcastNotification(
              `Export completed: ${updatedJob.filename}`,
              'success'
            );
          }
          
          // If job failed, send error notification
          if (updatedJob.status === 'failed') {
            socketHandlers.io.emit('export-failed', {
              jobId: updatedJob._id,
              error: updatedJob.error
            });
          }
        }
      };
      
      // Start processing in the background
      ExportService.processExportJob(exportJob, progressCallback).catch((error) => {
        console.error('Error in background export processing:', error);
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /exportTasks/:id - Get export job status
 * @name getExportJob
 * @function
 * @param {string} req.params.id - Export job ID
 * @returns {Object} Export job status and progress
 */
router.get('/exportTasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const exportJob = await ExportJob.findById(id);
    
    if (!exportJob) {
      return res.status(404).json({
        success: false,
        message: 'Export job not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: exportJob._id,
        status: exportJob.status,
        progress: exportJob.progress,
        format: exportJob.format,
        filters: exportJob.filters,
        createdAt: exportJob.createdAt,
        updatedAt: exportJob.updatedAt,
        filename: exportJob.filename,
        error: exportJob.error
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /exportTasks/:id/download - Download exported file
 * @name downloadExport
 * @function
 * @param {string} req.params.id - Export job ID
 * @returns {File} Exported file data
 */
router.get('/exportTasks/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const exportJob = await ExportJob.findById(id);
    
    if (!exportJob) {
      return res.status(404).json({
        success: false,
        message: 'Export job not found'
      });
    }
    
    if (exportJob.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Export is not yet complete'
      });
    }
    
    if (!exportJob.result) {
      return res.status(404).json({
        success: false,
        message: 'Export result not found'
      });
    }
    
    // Set content type based on format
    const contentType = exportJob.format === 'csv' ? 'text/csv' : 'application/json';
    
    // Set headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${exportJob.filename}`);
    
    console.log(`Serving download for job ${id}, format: ${exportJob.format}, size: ${exportJob.result.length} bytes`);
    
    // Send file data as Buffer
    res.send(exportJob.result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /exportHistory - Get export job history
 * @name getExportHistory
 * @function
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=10] - Items per page
 * @returns {Object} Paginated export history
 */
router.get('/exportHistory', async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Get export jobs without result data to reduce response size
    const jobs = await ExportJob.find({}, { result: 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await ExportJob.countDocuments();
    
    res.json({
      success: true,
      data: {
        jobs,
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
