/**
 * @fileoverview Export service for generating task data in various formats
 * @module services/exportService
 */

import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import Task from '../models/Task.js';
import ExportHistory from '../models/ExportHistory.js';
import { buildTaskQuery, buildSortQuery } from './queryBuilderService.js';

/**
 * Export formats configuration
 *
 * To add new formats, simply add a new entry here:
 * excel: {
 *   extension: 'xlsx',
 *   mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 *   streamer: streamExcel
 * }
 */
const EXPORT_FORMATS = {
  csv: {
    extension: 'csv',
    mimeType: 'text/csv',
    streamer: streamCSV
  },
  json: {
    extension: 'json',
    mimeType: 'application/json',
    streamer: streamJSON
  }
};

/**
 * Export tasks to specified format using streaming with history tracking
 * @param {Object} filters - Query filters
 * @param {string} [format='csv'] - Export format (csv, json)
 * @param {Object} [requestInfo={}] - Request information for tracking
 * @param {Object} [socketHandlers=null] - Socket handlers for real-time updates
 * @param {boolean} [skipHistory=false] - Skip creating history record
 * @returns {Promise<Object>} Export result with file path and metadata
 */
export const exportTasks = async (filters = {}, format = 'csv', requestInfo = {}, socketHandlers = null, skipHistory = false) => {
  const startTime = Date.now();
  let exportRecord = null;

  // Validate format
  if (!EXPORT_FORMATS[format]) {
    throw new Error(`Unsupported export format: ${format}. Supported formats: ${Object.keys(EXPORT_FORMATS).join(', ')}`);
  }

  const formatConfig = EXPORT_FORMATS[format];

  // Build MongoDB query using existing query builder
  const query = buildTaskQuery(filters);
  const sort = buildSortQuery(filters);

  // Generate filename and file path
  const filename = generateFilename(format, filters);
  const filePath = await getFilePath(filename);

  try {
    // Get total count for history record
    const totalRecords = await Task.countDocuments(query);

    // Create export history record only if not skipping
    if (!skipHistory) {
      exportRecord = await ExportHistory.createExportRecord({
        filename,
        format,
        totalRecords,
        filters,
        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent
      });

      // Notify clients that export has started
      if (socketHandlers) {
        socketHandlers.broadcastExportUpdate('started', exportRecord.toObject());
      }
    }

    // Stream tasks directly to file
    const taskCount = await formatConfig.streamer(query, sort, filePath);

    // Get file size
    const stats = await fs.stat(filePath);
    const fileSizeBytes = stats.size;

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Mark export as completed only if we have a record
    if (exportRecord) {
      await exportRecord.markCompleted(fileSizeBytes, executionTime);

      // Notify clients that export has completed
      if (socketHandlers) {
        socketHandlers.broadcastExportUpdate('completed', exportRecord.toObject());
      }
    }

    return {
      success: true,
      filePath,
      filename,
      format,
      mimeType: formatConfig.mimeType,
      taskCount,
      appliedFilters: filters,
      generatedAt: new Date().toISOString(),
      processingTime: executionTime,
      exportId: exportRecord?._id || null,
      fileSizeBytes
    };
  } catch (error) {
    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Mark export as failed if we have a record
    if (exportRecord) {
      await exportRecord.markFailed(error.message, executionTime);
      // Notify clients that export has failed
      if (socketHandlers) {
        socketHandlers.broadcastExportUpdate('failed', exportRecord.toObject());
      }
    }

    throw error;
  }
};

/**
 * Stream CSV data directly to file
 * @param {Object} query - MongoDB query object
 * @param {Object} sort - MongoDB sort object
 * @param {string} filePath - Output file path
 * @returns {Promise<number>} Number of tasks processed
 */
async function streamCSV(query, sort, filePath) {
  const writeStream = createWriteStream(filePath, { encoding: 'utf8' });
  const cursor = Task.find(query).sort(sort).cursor();

  // Write CSV headers
  const headers = [
    'ID',
    'Title',
    'Description',
    'Status',
    'Priority',
    'Created At',
    'Updated At',
    'Completed At',
    'Estimated Time (min)',
    'Actual Time (min)',
    'Completion Time (min)'
  ];
  writeStream.write(headers.join(',') + '\n');

  let taskCount = 0;

  try {
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      const task = doc.toObject();

      // Add calculated completion time if available
      if (task.completedAt && task.createdAt) {
        task.completionTimeMinutes = Math.floor((new Date(task.completedAt) - new Date(task.createdAt)) / (1000 * 60));
      }

      // Create CSV row
      const row = [
        escapeCSVField(task._id.toString()),
        escapeCSVField(task.title || ''),
        escapeCSVField(task.description || ''),
        escapeCSVField(task.status || ''),
        escapeCSVField(task.priority || ''),
        escapeCSVField(task.createdAt ? new Date(task.createdAt).toISOString() : ''),
        escapeCSVField(task.updatedAt ? new Date(task.updatedAt).toISOString() : ''),
        escapeCSVField(task.completedAt ? new Date(task.completedAt).toISOString() : ''),
        task.estimatedTime || '',
        task.actualTime || '',
        task.completionTimeMinutes || ''
      ];

      writeStream.write(row.join(',') + '\n');
      taskCount++;
    }
  } finally {
    writeStream.end();
  }

  return taskCount;
}

/**
 * Stream JSON data directly to file
 * @param {Object} query - MongoDB query object
 * @param {Object} sort - MongoDB sort object
 * @param {string} filePath - Output file path
 * @returns {Promise<number>} Number of tasks processed
 */
async function streamJSON(query, sort, filePath) {
  const writeStream = createWriteStream(filePath, { encoding: 'utf8' });
  const cursor = Task.find(query).sort(sort).cursor();

  // Start JSON structure
  writeStream.write('{\n');
  writeStream.write('  "metadata": {\n');
  writeStream.write(`    "exportedAt": "${new Date().toISOString()}",\n`);
  writeStream.write('    "format": "json"\n');
  writeStream.write('  },\n');
  writeStream.write('  "tasks": [\n');

  let taskCount = 0;
  let isFirst = true;

  try {
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      const task = doc.toObject();

      // Add calculated completion time if available
      if (task.completedAt && task.createdAt) {
        task.completionTimeMinutes = Math.floor((new Date(task.completedAt) - new Date(task.createdAt)) / (1000 * 60));
      }

      // Format task data for JSON
      const taskData = {
        id: task._id.toString(),
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt,
        estimatedTime: task.estimatedTime,
        actualTime: task.actualTime,
        completionTimeMinutes: task.completionTimeMinutes
      };

      // Add comma before each task except the first
      if (!isFirst) {
        writeStream.write(',\n');
      }

      writeStream.write('    ' + JSON.stringify(taskData));
      taskCount++;
      isFirst = false;
    }
  } finally {
    // Close JSON structure
    writeStream.write('\n  ],\n');
    writeStream.write(`  "totalTasks": ${taskCount}\n`);
    writeStream.write('}\n');
    writeStream.end();
  }

  return taskCount;
}

/**
 * Escape CSV field to handle special characters
 * @param {string} field - Field value to escape
 * @returns {string} Escaped CSV field
 */
const escapeCSVField = (field) => {
  const str = String(field);

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};

/**
 * Generate filename for export file
 * @param {string} format - Export format
 * @param {Object} filters - Applied filters
 * @returns {string} Generated filename
 */
const generateFilename = (format, filters) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = EXPORT_FORMATS[format].extension;

  // Generate unique ID for filename
  const uniqueId = Math.random().toString(36).substring(2, 8);

  // Create descriptive filename based on filters
  let filterDesc = '';
  if (filters.status) {
    filterDesc += `-${Array.isArray(filters.status) ? filters.status.join('-') : filters.status}`;
  }
  if (filters.priority) {
    filterDesc += `-${Array.isArray(filters.priority) ? filters.priority.join('-') : filters.priority}`;
  }
  if (filters.createdWithin) {
    filterDesc += `-${filters.createdWithin}`;
  }

  return `tasks-export${filterDesc}-${timestamp}-${uniqueId}.${extension}`;
};

/**
 * Get file path and ensure exports directory exists
 * @param {string} filename - File name
 * @returns {Promise<string>} File path
 */
const getFilePath = async (filename) => {
  // Create exports directory if it doesn't exist
  const exportsDir = path.join(process.cwd(), 'exports');

  try {
    await fs.access(exportsDir);
  } catch {
    await fs.mkdir(exportsDir, { recursive: true });
  }

  return path.join(exportsDir, filename);
};

/**
 * Get export history with filtering and pagination
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Export history with pagination
 */
export const getExportHistory = async (options = {}) => {
  const {
    page = 1,
    limit = 10,
    status,
    format,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    dateFrom,
    dateTo
  } = options;

  // Build query filters
  const query = {};

  if (status) {
    query.status = Array.isArray(status) ? { $in: status } : status;
  }

  if (format) {
    query.format = Array.isArray(format) ? { $in: format } : format;
  }

  // Date range filtering
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) {
      query.createdAt.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      query.createdAt.$lte = new Date(dateTo);
    }
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Execute queries
  const [exports, totalCount] = await Promise.all([
    ExportHistory.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    ExportHistory.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: {
      exports,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  };
};

