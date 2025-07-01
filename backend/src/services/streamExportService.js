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
   * @param {number} skipItems - Number of items to skip for resume functionality
   * @returns {stream.Readable} MongoDB cursor as readable stream
   */
  createTaskStream(query, sort, skipItems = 0) {
    // Use MongoDB cursor as a readable stream, with skip for resume functionality
    let mongoQuery = Task.find(query).sort(sort);
    if (skipItems > 0) {
      mongoQuery = mongoQuery.skip(skipItems);
    }
    return mongoQuery.cursor();
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
    let processedCount = resumeFromCount; // Start from resume point
    let lastReportedProgress = 0;
    let streamDestroyed = false;
    // We'll handle division by zero safely in the transform function
    const safeTotal = totalCount || 0; // Use actual count, even if zero

    // Send initial progress update with resume progress
    setTimeout(async () => {
      if (streamDestroyed) return; // Don't call if stream was already destroyed
      try {
        const initialProgress = safeTotal > 0 ? Math.floor((resumeFromCount / safeTotal) * 100) : 0;
        await progressCallback(initialProgress, resumeFromCount, safeTotal);
      } catch (error) {
        // Handle cancellation and pause errors in initial progress callback
        if (error.message.includes('cancelled') || error.message.includes('paused')) {
          streamDestroyed = true;
        }
      }
    }, 0);

    return new Transform({
      objectMode: true,
      async transform(chunk, encoding, callback) {
        try {
          // Check if stream was destroyed (cancelled)
          if (streamDestroyed) {
            // End the stream gracefully instead of throwing
            this.destroy(new Error('Export job was cancelled'));
            return;
          }

          // Increment counter
          processedCount++;

          // Calculate progress percentage - handle division by zero safely
          const progress = safeTotal > 0 ? Math.floor((processedCount / safeTotal) * 100) : 0;

          // Report progress more frequently - now every 1% for better UX
          const shouldReport =
            progress >= lastReportedProgress + 1 || // Every 1% (increased frequency)
            processedCount === 1 || // First item
            processedCount === safeTotal || // Last item
            processedCount % 5 === 0; // Every 5 items for all exports

          if (shouldReport) {
            try {
              await progressCallback(progress, processedCount, safeTotal);
              lastReportedProgress = progress;
            } catch (progressError) {
              // If progress callback throws (e.g., job cancelled or paused), stop processing
              if (progressError.message.includes('cancelled') || progressError.message.includes('paused')) {
                streamDestroyed = true;
                this.destroy(progressError);
                return;
              }
              // For other progress errors, log but continue
              console.error('[StreamExportService] Progress callback error:', progressError);
            }
          }

          // Pass the chunk through unchanged
          callback(null, chunk);
        } catch (error) {
          callback(error);
        }
      },
      async flush(callback) {
        // Make sure we send a final progress update
        try {
          if (processedCount > 0) {
            await progressCallback(100, processedCount, safeTotal);
          } else {
            // Handle edge case of empty result sets
            await progressCallback(100, 0, 0);
          }
          callback();
        } catch (progressError) {
          // If progress callback throws (e.g., job cancelled), stop processing
          if (progressError.message.includes('cancelled')) {
            return callback(progressError);
          }
          // For other progress errors, log but continue
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
