/**
 * @fileoverview Export service for task data export functionality
 * @module services/ExportService
 */

import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Transform } from 'stream';
import Task from '../models/Task.js';
import Export from '../models/Export.js';
import { redisClient } from '../config/redis.js';
import SocketBroadcastService from './socketBroadcastService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Service class for handling task data exports
 * @class ExportService
 */
class ExportService {
  /**
   * Export directory for generated files
   * @static
   * @type {string}
   */
  static EXPORT_DIR = path.join(__dirname, '../../exports');

  /**
   * Initialize export directory
   * @static
   * @async
   */
  static async initializeExportDir() {
    try {
      await fs.access(this.EXPORT_DIR);
    } catch {
      await fs.mkdir(this.EXPORT_DIR, { recursive: true });
    }
  }

  /**
   * Create CSV header row
   * @static
   * @returns {string} CSV header
   */
  static getCSVHeader() {
    return 'Title,Description,Status,Priority,Created At,Updated At,Completed At,Estimated Time (min),Actual Time (min),Time Efficiency\n';
  }

  /**
   * Convert task to CSV row
   * @static
   * @param {Object} task - Task object
   * @returns {string} CSV row
   */
  static taskToCSVRow(task) {
    const row = [
      `"${(task.title || '').replace(/"/g, '""')}"`,
      `"${(task.description || '').replace(/"/g, '""')}"`,
      task.status || '',
      task.priority || '',
      task.createdAt ? new Date(task.createdAt).toISOString() : '',
      task.updatedAt ? new Date(task.updatedAt).toISOString() : '',
      task.completedAt ? new Date(task.completedAt).toISOString() : '',
      task.estimatedTime || '',
      task.actualTime || '',
      this.calculateTimeEfficiency(task)
    ];
    return row.join(',') + '\n';
  }

  /**
   * Convert task to JSON object
   * @static
   * @param {Object} task - Task object
   * @returns {Object} JSON object
   */
  static taskToJSON(task) {
    return {
      id: task._id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      estimatedTime: task.estimatedTime,
      actualTime: task.actualTime,
      timeEfficiency: this.calculateTimeEfficiency(task)
    };
  }

  /**
   * Calculate time efficiency for a task
   * @static
   * @param {Object} task - Task object
   * @returns {string} Time efficiency indicator
   */
  static calculateTimeEfficiency(task) {
    if (!task.estimatedTime || !task.actualTime) {
      return 'N/A';
    }

    if (task.actualTime > task.estimatedTime) {
      return 'Over-estimated';
    } else if (task.actualTime < task.estimatedTime) {
      return 'Under-estimated';
    } else {
      return 'Accurate';
    }
  }

  /**
   * Create CSV transform stream
   * @static
   * @param {boolean} isFirstChunk - Whether this is the first chunk
   * @returns {Transform} Transform stream
   */
  static createCSVTransformStream(isFirstChunk = false) {
    let isFirst = isFirstChunk;

    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        try {
          if (isFirst) {
            this.push(ExportService.getCSVHeader());
            isFirst = false;
          }

          const csvRow = ExportService.taskToCSVRow(chunk);
          this.push(csvRow);
          callback();
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * Create JSON transform stream
   * @static
   * @param {boolean} isFirstChunk - Whether this is the first chunk
   * @returns {Transform} Transform stream
   */
  static createJSONTransformStream(isFirstChunk = false) {
    let isFirst = isFirstChunk;

    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        try {
          if (isFirst) {
            this.push('{\n');
            this.push('  "exportInfo": {\n');
            this.push(`    "generatedAt": "${new Date().toISOString()}",\n`);
            this.push('    "format": "json"\n');
            this.push('  },\n');
            this.push('  "tasks": [\n');
            isFirst = false;
          } else {
            this.push(',\n');
          }

          const jsonTask = ExportService.taskToJSON(chunk);
          this.push(
            '    ' + JSON.stringify(jsonTask, null, 2).replace(/\n/g, '\n    ')
          );
          callback();
        } catch (error) {
          callback(error);
        }
      },
      flush(callback) {
        try {
          this.push('\n  ]\n');
          this.push('}\n');
          callback();
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * Generate export using streams and cursors
   * @static
   * @async
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format ('csv' or 'json')
   * @param {Object} params.filters - Task filters
   * @param {Object} params.options - Export options
   * @param {string} params.filePath - File path to write to
   * @param {string} params.exportId - Export ID for progress updates
   * @returns {Promise<Object>} Export result with record count
   */
  static async generateExportStream(params) {
    const { format, filters, options, filePath, exportId } = params;

    let recordCount = 0;
    const batchSize = 1000; // Process in batches of 1000

    // Create write stream
    const writeStream = createWriteStream(filePath);

    // Create transform stream based on format
    const transformStream =
      format === 'csv'
        ? this.createCSVTransformStream(true)
        : this.createJSONTransformStream(true);

    // Pipe transform to write stream
    transformStream.pipe(writeStream);

    // Create MongoDB cursor with batch processing
    const cursor = await Task.advancedSearchCursor(filters, {
      ...options,
      batchSize
    });

    let batchCount = 0;

    // Process cursor in batches
    for await (const task of cursor) {
      recordCount++;
      batchCount++;

      // Send progress updates every 1000 records
      if (batchCount % 1000 === 0) {
        await SocketBroadcastService.broadcastExportProcessing(
          exportId,
          recordCount
        );
      }

      // Push task to transform stream
      transformStream.write(task);
    }

    // End the transform stream
    transformStream.end();

    // Wait for write stream to finish
    return new Promise((resolve, reject) => {
      writeStream.on('error', (error) => {
        reject(error);
      });

      writeStream.on('finish', () => {
        resolve({ recordCount });
      });
    });
  }

  /**
   * Check if export result is cached
   * @static
   * @async
   * @param {string} cacheKey - Cache key
   * @returns {Promise<Object|null>} Cached export data or null
   */
  static async getCachedExport(cacheKey) {
    try {
      const cached = await redisClient.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting cached export:', error);
      return null;
    }
  }

  /**
   * Cache export result
   * @static
   * @async
   * @param {string} cacheKey - Cache key
   * @param {Object} exportData - Export data to cache
   * @param {number} [ttl=3600] - Time to live in seconds
   */
  static async cacheExport(cacheKey, exportData, ttl = 3600) {
    try {
      await redisClient.setex(cacheKey, ttl, JSON.stringify(exportData));
    } catch (error) {
      console.error('Error caching export:', error);
    }
  }

  /**
   * Create export record and generate file
   * @static
   * @async
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format ('csv' or 'json')
   * @param {Object} params.filters - Task filters
   * @param {Object} params.options - Export options
   * @param {string} [params.exportId] - Existing export ID to update (optional)
   * @returns {Promise<Object>} Export record
   */
  static async createExport(params) {
    const { format, filters, options, exportId } = params;

    let exportRecord;

    if (exportId) {
      // Update existing export record
      exportRecord = await Export.findById(exportId);
      if (!exportRecord) {
        throw new Error('Export record not found');
      }

      // Update the export record with new data if needed
      exportRecord.format = format;
      exportRecord.filters = filters;
      exportRecord.options = options;
      exportRecord.cacheKey = exportRecord.generateCacheKey();
      await exportRecord.save();
    } else {
      // Create new export record
      exportRecord = new Export({
        format,
        filters,
        options
      });

      // Generate cache key
      exportRecord.cacheKey = exportRecord.generateCacheKey();
      await exportRecord.save();
    }

    try {
      // Check cache first
      const cached = await this.getCachedExport(exportRecord.cacheKey);
      if (cached) {
        exportRecord.filePath = cached.filePath;
        exportRecord.recordCount = cached.recordCount;
        exportRecord.completedAt = new Date();
        await exportRecord.save();
        return exportRecord;
      }

      // Status will be updated by QueueService

      // Broadcast fetching data
      await SocketBroadcastService.broadcastExportFetching(exportRecord._id);

      // Ensure export directory exists
      await this.initializeExportDir();

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileExtension = format === 'csv' ? 'csv' : 'json';
      const filename = `tasks_export_${timestamp}.${fileExtension}`;
      const filePath = path.join(this.EXPORT_DIR, filename);

      // Broadcast file generation status
      await SocketBroadcastService.broadcastExportFileGeneration(
        exportRecord._id
      );

      // Generate file using streams
      const result = await this.generateExportStream({
        format,
        filters,
        options,
        filePath,
        exportId: exportRecord._id
      });

      // Broadcast finalizing status
      await SocketBroadcastService.broadcastExportFinalizing(exportRecord._id);

      // Cache the result
      const cacheData = {
        filePath,
        recordCount: result.recordCount
      };
      await this.cacheExport(exportRecord.cacheKey, cacheData);

      // Update export record with completion data (status will be updated by QueueService)
      exportRecord.filePath = filePath;
      exportRecord.recordCount = result.recordCount;
      exportRecord.completedAt = new Date();
      await exportRecord.save();

      // Broadcast completion
      await SocketBroadcastService.broadcastExportCompleted(
        exportRecord._id,
        result.recordCount
      );

      return exportRecord;
    } catch (error) {
      console.error('Export error:', error);

      // Update export record with error data (status will be updated by QueueService)
      exportRecord.error = error.message;
      exportRecord.completedAt = new Date();
      await exportRecord.save();

      // Broadcast failure
      await SocketBroadcastService.broadcastExportFailed(
        exportRecord._id,
        error.message
      );

      throw error;
    }
  }

  /**
   * Get export history
   * @static
   * @async
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Array>} Export history
   */
  static async getExportHistory(options = {}) {
    return Export.findRecent(options);
  }

  /**
   * Get export by ID
   * @static
   * @async
   * @param {string} exportId - Export ID
   * @returns {Promise<Object|null>} Export record
   */
  static async getExportById(exportId) {
    return Export.findById(exportId);
  }

  /**
   * Download export file using streams for large files
   * @static
   * @async
   * @param {string} exportId - Export ID
   * @returns {Promise<Object>} File data
   */
  static async downloadExport(exportId) {
    const exportRecord = await Export.findById(exportId);

    if (!exportRecord) {
      throw new Error('Export not found');
    }

    if (exportRecord.status !== 'completed') {
      throw new Error(`Export is not ready. Status: ${exportRecord.status}`);
    }

    if (!exportRecord.filePath) {
      throw new Error('Export file not found');
    }

    try {
      const content = await fs.readFile(exportRecord.filePath, 'utf8');
      const filename = path.basename(exportRecord.filePath);

      return {
        content,
        filename,
        format: exportRecord.format,
        recordCount: exportRecord.recordCount
      };
    } catch (error) {
      throw new Error(`Failed to read export file: ${error.message}`);
    }
  }

  /**
   * Clean up old exports
   * @static
   * @async
   * @param {number} [daysOld=7] - Delete exports older than this many days
   * @returns {Promise<number>} Number of exports deleted
   */
  static async cleanupOldExports(daysOld = 7) {
    const deletedCount = await Export.cleanupOld(daysOld);

    // Also clean up old files
    try {
      const files = await fs.readdir(this.EXPORT_DIR);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      for (const file of files) {
        const filePath = path.join(this.EXPORT_DIR, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old export files:', error);
    }

    return deletedCount;
  }

  /**
   * Get export statistics
   * @static
   * @async
   * @returns {Promise<Object>} Export statistics
   */
  static async getExportStats() {
    const stats = await Export.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          processing: {
            $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] }
          },
          totalRecords: { $sum: '$recordCount' }
        }
      }
    ]);

    const formatStats = await Export.aggregate([
      {
        $group: {
          _id: '$format',
          count: { $sum: 1 }
        }
      }
    ]);

    const recentExports = await Export.findRecent({ limit: 5 });

    return {
      summary: stats[0] || {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        processing: 0,
        totalRecords: 0
      },
      byFormat: formatStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      recent: recentExports
    };
  }
}

export default ExportService;
