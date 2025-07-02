/**
 * @fileoverview Stream-based export service for efficient task exports
 * @module services/streamExportService
 */

import { Transform } from 'stream';
import Task from '../models/Task.js';

class StreamExportService {
  /**
   * Create a readable stream for task data
   * @param {Object} query - MongoDB query object
   * @param {Object} sort - MongoDB sort object
   * @param {string|null} lastProcessedId - ID of last processed task for resume functionality
   * @returns {stream.Readable} MongoDB cursor as readable stream
   */
  createTaskStream(query, sort, lastProcessedId = null) {
    // Use cursor-based resume for reliable pagination
    if (lastProcessedId) {
      query._id = { $gt: lastProcessedId };
    }
    return Task.find(query).sort(sort).cursor();
  }

  /**
   * Create a transform stream for CSV formatting
   * @returns {stream.Transform} Transform stream for CSV
   */
  createCsvTransform() {
    // Create headers first
    const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Created At', 'Updated At', 'Completed At'];
    let isFirstChunk = true;

    return new Transform({
      objectMode: true,
      transform(task, encoding, callback) {
        try {
          // If first chunk, add headers
          const headerRow = isFirstChunk ? headers.join(',') + '\n' : '';
          isFirstChunk = false;

          // Format row data
          const row = [
            task._id,
            task.title || '',
            task.description || '',
            task.status || '',
            task.priority || '',
            task.createdAt || '',
            task.updatedAt || '',
            task.completedAt || ''
          ]
            .map(cell => `"${String(cell).replace(/"/g, '""')}"`)
            .join(',');

          // Return combined data
          callback(null, headerRow + row + '\n');
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * Create a transform stream for JSON formatting
   * @returns {stream.Transform} Transform stream for JSON
   */
  createJsonTransform() {
    let isFirstChunk = true;
    let tasksProcessed = 0;

    return new Transform({
      objectMode: true,
      transform(task, encoding, callback) {
        try {
          tasksProcessed++;

          // Format the JSON for this task
          const taskJson = JSON.stringify(task);

          if (isFirstChunk) {
            // First chunk: start array with opening bracket
            isFirstChunk = false;
            callback(null, '[' + taskJson);
          } else {
            // Subsequent chunks: add comma before the task
            callback(null, ',' + taskJson);
          }
        } catch (error) {
          callback(error);
        }
      },
      flush(callback) {
        // Called when there are no more tasks
        if (isFirstChunk) {
          // No tasks were processed, send an empty array
          console.log(`JSON transform processed ${tasksProcessed} tasks`);
          callback(null, '[]');
        } else {
          // Close the array
          console.log(`JSON transform processed ${tasksProcessed} tasks`);
          callback(null, ']');
        }
      }
    });
  }

  /**
   * Create a progress tracking transform stream
   * @param {Function} progressCallback - Callback for progress updates
   * @param {number} totalCount - Total number of items to process
   * @param {number} resumeFromCount - Number of items already processed (for resume)
   * @returns {stream.Transform} Transform stream that tracks progress
   */
  createProgressStream(progressCallback, totalCount, resumeFromCount = 0) {
    let processedCount = resumeFromCount;
    let lastReportedProgress = 0;
    let lastTaskId = null;
    const safeTotal = totalCount || 0;

    return new Transform({
      objectMode: true,
      async transform(chunk, encoding, callback) {
        try {
          processedCount++;
          lastTaskId = chunk._id; // Track cursor position

          const progress = safeTotal > 0 ? Math.floor((processedCount / safeTotal) * 100) : 0;
          const shouldReport = progress >= lastReportedProgress + 1 || processedCount === 1 || processedCount === safeTotal;

          if (shouldReport) {
            try {
              const result = await progressCallback(progress, processedCount, safeTotal, lastTaskId);
              
              // Check if job was stopped (paused/cancelled)
              if (result && result.stopped) {
                console.log(`[StreamExportService] Export ${result.reason}, stopping pipeline`);
                // Signal pipeline to stop with the reason and current progress
                if (this._pipelineResolver) {
                  this._pipelineResolver({ 
                    stopped: true, 
                    reason: result.reason,
                    processedItems: result.processedItems,
                    lastProcessedId: result.lastTaskId
                  });
                }
                return;
              }
              
              lastReportedProgress = progress;
            } catch (progressError) {
              console.error('[StreamExportService] Progress callback error:', progressError);
            }
          }

          callback(null, chunk);
        } catch (error) {
          callback(error);
        }
      },
      async flush(callback) {
        try {
          await progressCallback(100, processedCount, safeTotal, lastTaskId);
          callback();
        } catch (progressError) {
          if (progressError.message.includes('cancelled') || progressError.message.includes('paused')) {
            return callback(progressError);
          }
          console.error('[StreamExportService] Final progress callback error:', progressError);
          callback();
        }
      }
    });
  }

  /**
   * Build a MongoDB query from filter parameters
   * @param {Object} filters - Filter parameters
   * @returns {Object} MongoDB query object
   */
  buildQueryFromFilters(filters) {
    const query = {};

    // Basic filters
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;

    // Text search in title or description
    // Performant alternative would be to implement Mongo indexes for tasks and use that for search
    // But I didn't want to mess with Task Model
    if (filters.search) {
      const searchTerm = filters.search.trim();
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Date range filters
    if (filters.createdAfter || filters.createdBefore) {
      query.createdAt = {};
      if (filters.createdAfter) query.createdAt.$gte = new Date(filters.createdAfter);
      if (filters.createdBefore) query.createdAt.$lte = new Date(filters.createdBefore);
    }

    // Completed date range filters
    if (filters.completedAfter || filters.completedBefore) {
      query.completedAt = {};
      if (filters.completedAfter) query.completedAt.$gte = new Date(filters.completedAfter);
      if (filters.completedBefore) query.completedAt.$lte = new Date(filters.completedBefore);
    }

    // Estimated time filters
    if (filters.estimatedTimeLt || filters.estimatedTimeGte) {
      query.estimatedTime = {};
      if (filters.estimatedTimeLt) query.estimatedTime.$lt = parseInt(filters.estimatedTimeLt);
      if (filters.estimatedTimeGte) query.estimatedTime.$gte = parseInt(filters.estimatedTimeGte);
    }

    return query;
  }

  /**
   * Build a MongoDB sort object from filter parameters
   * @param {Object} filters - Filter parameters
   * @returns {Object} MongoDB sort object
   */
  buildSortFromFilters(filters) {
    const sort = {};
    sort[filters.sortBy || 'createdAt'] = filters.sortOrder === 'asc' ? 1 : -1;
    return sort;
  }
}

export default new StreamExportService();
