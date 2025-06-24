/**
 * @fileoverview Enhanced task controller with export functionality
 * @module controllers/taskController
 */

import { find, countDocuments } from '../models/Task';
import { create, find as _find, countDocuments as _countDocuments } from '../models/ExportHistory';
import { get, setex, keys as _keys, del } from '../config/redis';
import { Parser } from 'json2csv';
import { createHash } from 'crypto';

/**
 * Enhanced task filtering with additional search capabilities
 * @async
 * @function getTasksWithAdvancedFiltering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTasksWithAdvancedFiltering = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      dateFrom,
      dateTo,
      createdBy,
      assignedTo,
      tags
    } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Priority filter
    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    // Text search across title and description
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.createdAt.$lte = new Date(dateTo);
      }
    }

    // User-based filtering
    if (createdBy) {
      filter.createdBy = createdBy;
    }

    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    // Tags filtering
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      filter.tags = { $in: tagArray };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with population
    const [tasks, total] = await Promise.all([
      find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .populate('assignedTo', 'name email')
        .lean(),
      countDocuments(filter)
    ]);

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    };

    res.json({
      success: true,
      data: {
        tasks,
        pagination,
        filters: {
          status,
          priority,
          search,
          dateFrom,
          dateTo,
          createdBy,
          assignedTo,
          tags
        }
      }
    });

  } catch (error) {
    console.error('Error in getTasksWithAdvancedFiltering:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
};

/**
 * Generate cache key for export requests
 * @function generateExportCacheKey
 * @param {Object} filters - Filter parameters
 * @param {string} format - Export format
 * @returns {string} Cache key
 */
const generateExportCacheKey = (filters, format) => {
  const filterString = JSON.stringify(filters);
  const hash = createHash('md5').update(filterString).digest('hex');
  return `export:${format}:${hash}`;
};

/**
 * Export tasks with specified filters and format
 * @async
 * @function exportTasks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const exportTasks = async (req, res) => {
  try {
    const {
      format = 'csv',
      status,
      priority,
      search,
      dateFrom,
      dateTo,
      createdBy,
      assignedTo,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Validate format
    if (!['csv', 'json'].includes(format.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid export format. Supported formats: csv, json'
      });
    }

    // Build filter object (same as getTasksWithAdvancedFiltering)
    const filter = {};

    if (status && status !== 'all') filter.status = status;
    if (priority && priority !== 'all') filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    if (createdBy) filter.createdBy = createdBy;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      filter.tags = { $in: tagArray };
    }

    // Generate cache key
    const cacheKey = generateExportCacheKey(filter, format);

    // Check cache first
    const cachedResult = await get(cacheKey);
    if (cachedResult) {
      const { data, filename, contentType } = JSON.parse(cachedResult);

      // Track export from cache
      await create({
        filters: filter,
        format,
        recordCount: data.length || (typeof data === 'string' ? data.split('\n').length - 1 : 0),
        fromCache: true,
        exportedAt: new Date()
      });

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(data);
    }

    // Emit real-time progress update
    const io = req.app.get('io');
    io.emit('export-progress', {
      stage: 'fetching',
      message: 'Fetching tasks...',
      progress: 25
    });

    // Fetch tasks
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const tasks = await find(filter)
      .sort(sort)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .lean();

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No tasks found matching the specified criteria'
      });
    }

    // Emit progress update
    io.emit('export-progress', {
      stage: 'processing',
      message: 'Processing data...',
      progress: 50
    });

    let exportData, filename, contentType;

    if (format.toLowerCase() === 'csv') {
      // Prepare data for CSV export
      const csvData = tasks.map(task => ({
        id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        tags: task.tags ? task.tags.join(', ') : '',
        createdBy: task.createdBy ? task.createdBy.name : '',
        assignedTo: task.assignedTo ? task.assignedTo.name : '',
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        dueDate: task.dueDate ? task.dueDate.toISOString() : ''
      }));

      const csvFields = [
        'id', 'title', 'description', 'status', 'priority', 'tags',
        'createdBy', 'assignedTo', 'createdAt', 'updatedAt', 'dueDate'
      ];

      const parser = new Parser({ fields: csvFields });
      exportData = parser.parse(csvData);
      filename = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
      contentType = 'text/csv';

    } else if (format.toLowerCase() === 'json') {
      exportData = JSON.stringify({
        exportedAt: new Date().toISOString(),
        totalRecords: tasks.length,
        filters: filter,
        tasks: tasks
      }, null, 2);
      filename = `tasks_export_${new Date().toISOString().split('T')[0]}.json`;
      contentType = 'application/json';
    }

    // Emit progress update
    io.emit('export-progress', {
      stage: 'caching',
      message: 'Caching results...',
      progress: 75
    });

    // Cache the result (expire in 1 hour)
    await setex(cacheKey, 3600, JSON.stringify({
      data: exportData,
      filename,
      contentType
    }));

    // Emit progress update
    io.emit('export-progress', {
      stage: 'complete',
      message: 'Export completed successfully!',
      progress: 100
    });

    // Track export in history
    const exportRecord = await create({
      filters: filter,
      format,
      recordCount: tasks.length,
      fromCache: false,
      exportedAt: new Date()
    });

    // Emit export completion with record ID
    io.emit('export-completed', {
      exportId: exportRecord._id,
      recordCount: tasks.length,
      format,
      filename
    });

    // Send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);

  } catch (error) {
    console.error('Error in exportTasks:', error);

    // Emit error event
    const io = req.app.get('io');
    io.emit('export-error', {
      message: 'Export failed',
      error: error.message
    });

    res.status(500).json({
      success: false,
      message: 'Failed to export tasks',
      error: error.message
    });
  }
};

/**
 * Get export history
 * @async
 * @function getExportHistory
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getExportHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [exports, total] = await Promise.all([
      _find()
        .sort({ exportedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      _countDocuments()
    ]);

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    };

    res.json({
      success: true,
      data: {
        exports,
        pagination
      }
    });

  } catch (error) {
    console.error('Error in getExportHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch export history',
      error: error.message
    });
  }
};

/**
 * Clear export cache
 * @async
 * @function clearExportCache
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const clearExportCache = async (req, res) => {
  try {
    const keys = await _keys('export:*');
    if (keys.length > 0) {
      await del(keys);
    }

    res.json({
      success: true,
      message: `Cleared ${keys.length} export cache entries`
    });

  } catch (error) {
    console.error('Error in clearExportCache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear export cache',
      error: error.message
    });
  }
};

export default {
  getTasksWithAdvancedFiltering,
  exportTasks,
  getExportHistory,
  clearExportCache
};
