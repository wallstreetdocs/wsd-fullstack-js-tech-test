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
 * @param {string} [req.query.search] - Search in title and description
 * @param {string} [req.query.createdAfter] - Filter tasks created after date (ISO format)
 * @param {string} [req.query.createdBefore] - Filter tasks created before date (ISO format)
 * @param {string} [req.query.completedAfter] - Filter tasks completed after date (ISO format)
 * @param {string} [req.query.completedBefore] - Filter tasks completed before date (ISO format)
 * @param {number} [req.query.estimatedTimeLt] - Filter tasks with estimated time less than value (minutes)
 * @param {number} [req.query.estimatedTimeGte] - Filter tasks with estimated time greater than or equal to value (minutes)
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
      sortOrder = 'desc',
      // Advanced filters
      search,
      createdAfter,
      createdBefore,
      completedAfter,
      completedBefore,
      estimatedTimeLt,
      estimatedTimeGte
    } = req.query;

    const query = {};
    
    // Basic filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    
    // Text search in title or description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Date range filters
    if (createdAfter || createdBefore) {
      query.createdAt = {};
      if (createdAfter) query.createdAt.$gte = new Date(createdAfter);
      if (createdBefore) query.createdAt.$lte = new Date(createdBefore);
    }
    
    // Completed date range filters
    if (completedAfter || completedBefore) {
      query.completedAt = {};
      if (completedAfter) query.completedAt.$gte = new Date(completedAfter);
      if (completedBefore) query.completedAt.$lte = new Date(completedBefore);
    }
    
    // Estimated time filters
    if (estimatedTimeLt || estimatedTimeGte) {
      query.estimatedTime = {};
      if (estimatedTimeLt) query.estimatedTime.$lt = parseInt(estimatedTimeLt);
      if (estimatedTimeGte) query.estimatedTime.$gte = parseInt(estimatedTimeGte);
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
 * POST /exportTasks - Start a task export process with automatic size-based approach
 * @name exportTasks
 * @function
 * @param {Object} req.body - Request body
 * @param {string} req.body.format - Export format ('csv' or 'json')
 * @param {Object} req.body.filters - Filter parameters
 * @param {string} [req.body.filters.status] - Filter by task status
 * @param {string} [req.body.filters.priority] - Filter by task priority
 * @param {string} [req.body.filters.sortBy] - Field to sort by
 * @param {string} [req.body.filters.sortOrder] - Sort order (asc/desc)
 * @param {string} [req.body.filters.search] - Search in title and description
 * @param {string} [req.body.filters.createdAfter] - Filter tasks created after date
 * @param {string} [req.body.filters.createdBefore] - Filter tasks created before date
 * @param {string} [req.body.filters.completedAfter] - Filter tasks completed after date
 * @param {string} [req.body.filters.completedBefore] - Filter tasks completed before date
 * @param {number} [req.body.filters.estimatedTimeLt] - Filter tasks with estimated time less than value
 * @param {number} [req.body.filters.estimatedTimeGte] - Filter tasks with estimated time greater than or equal to value
 * @returns {Object} Export job metadata for background processing
 */
router.post('/exportTasks', async (req, res, next) => {
  try {
    const { format, filters } = req.body;
    
    const validatedFormat = format.toLowerCase() === 'json' ? 'json' : 'csv';

    console.log(`Export request - format: '${validatedFormat}'`);
    
    // Create an export job using the export service with validated format
    const exportJob = await ExportService.createExportJob({
      format: validatedFormat,
      filters
    });
    
    console.log('Export job created:', { 
      jobId: exportJob._id, 
      format: validatedFormat
    });
    
    // All exports now use background processing for consistency and scalability
    res.status(202).json({
      success: true,
      data: {
        jobId: exportJob._id,
        status: exportJob.status
      },
      message: 'Export job created and queued for processing'
    });
    
    // Notify clients via socket if available
    if (socketHandlers) {
      socketHandlers.broadcastNotification(
        `Export job started: ${validatedFormat.toUpperCase()} export`,
        'info'
      );
    }
  } catch (error) {
    console.error('Error in export tasks endpoint:', error);
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
    
    // Ensure progress is 100% for completed jobs when reporting status
    const reportedProgress = exportJob.status === 'completed' ? 100 : exportJob.progress;
    
    res.json({
      success: true,
      data: {
        id: exportJob._id,
        status: exportJob.status,
        progress: reportedProgress,
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
 * GET /exportTasks/:id/download - Download exported file with streaming support
 * @name downloadExport
 * @function
 * @param {string} req.params.id - Export job ID
 * @returns {File} Exported file data
 */
router.get('/exportTasks/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(`Download request for export job ${id}`);
    
    const exportJob = await ExportJob.findById(id);
    
    if (!exportJob) {
      console.error(`Export job ${id} not found for download`);
      return res.status(404).json({
        success: false,
        message: 'Export job not found'
      });
    }
    
    console.log(`Found export job ${id} with status: ${exportJob.status}, storageType: ${exportJob.storageType}`);
    
    if (exportJob.status !== 'completed') {
      console.error(`Export job ${id} status is ${exportJob.status}, not completed`);
      return res.status(400).json({
        success: false,
        message: 'Export is not yet complete'
      });
    }
    
    try {
      // Use the streamExportToResponse method to handle all storage types
      await ExportService.streamExportToResponse(id, res);
      
      // Response already sent by streamExportToResponse
      return;
    } catch (streamError) {
      console.error(`Error streaming export ${id}:`, streamError);
      
      // Fall back to the old method for backwards compatibility
      if (exportJob.storageType === 'buffer' && exportJob.result) {
        console.log(`Falling back to buffer download for export job ${id}`);
        
        // EXPLICIT CONTENT TYPE AND FILENAME LOGIC
        let contentType, filename;
        
        // If format is EXACTLY 'json', set JSON headers
        if (exportJob.format === 'json') {
          contentType = 'application/json';
          filename = exportJob.filename || `tasks_export_${new Date().toISOString().split('T')[0]}.json`;
          console.log(`JSON FORMAT: Setting content type: ${contentType}`);
        } 
        // Otherwise default to CSV
        else {
          contentType = 'text/csv';
          filename = exportJob.filename || `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
          console.log(`CSV FORMAT: Setting content type: ${contentType}`);
        }
        
        // Set headers for file download
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        
        // For JSON files, validate content
        if (contentType === 'application/json') {
          // Convert buffer to string
          const dataString = exportJob.result.toString('utf-8');
          
          // Try to parse it to make sure it's valid JSON
          try {
            JSON.parse(dataString);
            console.log('Successfully validated JSON data');
          } catch (e) {
            console.error('WARNING: Invalid JSON data, will attempt to fix');
            // If not valid JSON, try to create a valid JSON structure
            try {
              // Try to parse as CSV and convert to JSON
              const lines = dataString.split('\n');
              if (lines.length > 0) {
                const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
                const jsonData = [];
                
                for(let i = 1; i < lines.length; i++) {
                  if (lines[i].trim()) {
                    const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
                    const row = {};
                    
                    headers.forEach((header, index) => {
                      row[header] = values[index] || '';
                    });
                    
                    jsonData.push(row);
                  }
                }
                
                // Create new JSON buffer
                exportJob.result = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8');
                console.log('Successfully converted CSV to JSON');
              }
            } catch (conversionError) {
              console.error('Error converting to JSON:', conversionError);
            }
          }
        }
        
        // Send file data as Buffer with the proper headers already set
        res.send(exportJob.result);
        return;
      } else {
        // No fallback available
        return res.status(500).json({
          success: false,
          message: 'Error streaming export data',
          error: streamError.message
        });
      }
    }
  } catch (error) {
    console.error('Error in download endpoint:', error);
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