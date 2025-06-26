/**
 * @fileoverview API routes for task management and analytics
 * @module routes/api
 */

import express from 'express';
import Task from '../models/Task.js';
import TaskExport from '../models/TaskExport.js'; // <-- Create this model if not exists
import AnalyticsService from '../services/analyticsService.js';
import { redisClient } from '../config/redis.js';
// import { json2csv } from 'json-2-csv';
import { StreamParser } from '@json2csv/plainjs';
import { AsyncParser } from '@json2csv/node';
import fs from 'fs';
import path from 'path';

import dayjs from 'dayjs';

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
      sortOrder = 'desc',
      dateRange
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

    // Date range filter
    if (dateRange) {
      // Example: "Mon Jun 09 2025 00:00:00 GMT+0600 (Bangladesh Standard Time),Sat Jun 14 2025 00:00:00 GMT+0600 (Bangladesh Standard Time)"
      const [start, end] = decodeURIComponent(dateRange).split(',');
      query.createdAt = {};
      if (start) query.createdAt.$gte = new Date(start);
      if (end) query.createdAt.$lte = new Date(end);
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

router.get('/tasks/export', async (req, res, next) => {
  // 1. Create export tracking entry
  const exportEntry = new TaskExport({
    requestedAt: new Date(),
    status: 'processing',
    format: req.query.format || 'csv',
    filters: req.query,
    completedAt: null,
    fileUrl: null,
    error: null
  });
  await exportEntry.save();

  try {
    // ── 1.  Extract & validate query params ──────────────────────────────
    const {
      format = 'csv',
      status,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateRange
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;

    if (dateRange) {
      const [startStr, endStr] = decodeURIComponent(dateRange).split(',');
      const start =
        startStr && dayjs(startStr).isValid() ? new Date(startStr) : null;
      const end = endStr && dayjs(endStr).isValid() ? new Date(endStr) : null;
      if (start || end) {
        query.createdAt = {};
        if (start) query.createdAt.$gte = start;
        if (end) query.createdAt.$lte = end;
      }
    }

    // ── 2.  Build cursor ─────────────────────────────────────────────────
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const cursor = Task.find(query).sort(sort).lean().cursor();

    // ── 3.  CSV export ──────────────────────────────────────────────────
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tasks.csv"');

      const fields = [
        '_id',
        'title',
        'description',
        'priority',
        'status',
        'createdAt',
        'updatedAt',
        'completedAt',
        'estimatedTime',
        'actualTime'
      ];

      res.write(fields.join(',') + '\n');

      for await (const doc of cursor) {
        const row = fields.map(field => {
          let val = doc[field];
          if (val === undefined || val === null) return '';
          val = String(val).replace(/"/g, '""');
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            val = `"${val}"`;
          }
          return val;
        }).join(',');
        res.write(row + '\n');
      }
      res.end();

      // Update export entry as completed
      exportEntry.status = 'completed';
      exportEntry.completedAt = new Date();
      await exportEntry.save();
      return;
    }

    // ── 4.  JSON export ─────────────────────────────────────────────────
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tasks.json"');

      res.write('[');
      let first = true;
      for await (const doc of cursor) {
        if (!first) res.write(',');
        res.write(JSON.stringify(doc));
        first = false;
      }
      res.write(']');
      res.end();

      // Update export entry as completed
      exportEntry.status = 'completed';
      exportEntry.completedAt = new Date();
      await exportEntry.save();
      return;
    }

    // ── 5.  Unsupported format ──────────────────────────────────────────
    exportEntry.status = 'failed';
    exportEntry.error = 'Unsupported export format';
    exportEntry.completedAt = new Date();
    await exportEntry.save();

    res
      .status(400)
      .json({ success: false, message: 'Unsupported export format' });
  } catch (err) {
    // Update export entry as failed
    exportEntry.status = 'failed';
    exportEntry.error = err.message;
    exportEntry.completedAt = new Date();
    await exportEntry.save();
    next(err);
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
 * GET /tasks/export - Export tasks in various formats (csv, json)
 * @name ExportTasks
 * @function
 * @param {string} req.query.format - Export format: 'csv' or 'json'
 * @param {string} [req.query.status] - Filter by task status
 * @param {string} [req.query.priority] - Filter by task priority
 * @param {string} [req.query.dateRange] - Date range filter
 * @returns {File} Downloadable file in requested format
 */

/**
 * GET /tasks/export/history - Get export history
 * @name GetExportHistory
 * @function
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=20] - Number of records per page
 * @returns {Object} Paginated export history
 */
router.get('/tasks/export/history', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const total = await TaskExport.countDocuments();
    const history = await TaskExport.find()
      .sort({ requestedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          page,
          limit,
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
 * GET /tasks/export/:id/download - Download a specific export by ID
 * @name DownloadExportById
 * @function
 * @param {string} req.params.id - Export entry ID
 * @returns {File} Downloadable export file (CSV or JSON)
 */
router.get('/tasks/export/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;
    const exportEntry = await TaskExport.findById(id).lean();

    if (!exportEntry) {
      return res.status(404).json({ success: false, message: 'Export entry not found' });
    }

    // Re-run the export with the same filters and format as the original request
    const {
      format = 'csv',
      status,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dateRange
    } = exportEntry.filters || {};

    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (dateRange) {
      const [startStr, endStr] = decodeURIComponent(dateRange).split(',');
      const start = startStr ? new Date(startStr) : null;
      const end = endStr ? new Date(endStr) : null;
      if (start || end) {
        query.createdAt = {};
        if (start) query.createdAt.$gte = start;
        if (end) query.createdAt.$lte = end;
      }
    }

    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const cursor = Task.find(query).sort(sort).lean().cursor();

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tasks.csv"');

      const fields = [
        '_id',
        'title',
        'description',
        'priority',
        'status',
        'createdAt',
        'updatedAt',
        'completedAt',
        'estimatedTime',
        'actualTime'
      ];

      res.write(fields.join(',') + '\n');

      for await (const doc of cursor) {
        const row = fields.map(field => {
          let val = doc[field];
          if (val === undefined || val === null) return '';
          val = String(val).replace(/"/g, '""');
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            val = `"${val}"`;
          }
          return val;
        }).join(',');
        res.write(row + '\n');
      }
      res.end();
      return;
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tasks.json"');

      res.write('[');
      let first = true;
      for await (const doc of cursor) {
        if (!first) res.write(',');
        res.write(JSON.stringify(doc));
        first = false;
      }
      res.write(']');
      res.end();
      return;
    }

    res.status(400).json({ success: false, message: 'Unsupported export format' });
  } catch (error) {
    next(error);
  }
});

export default router;
