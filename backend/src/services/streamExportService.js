/**
 * @fileoverview Stream-based export service for efficient task exports
 * @module services/streamExportService
 */

import { Readable, Transform } from 'stream';
import Task from '../models/Task.js';
import exportConfig from '../config/exportConfig.js';

class StreamExportService {
  /**
   * Create a readable stream for task data
   * @param {Object} query - MongoDB query object
   * @param {Object} sort - MongoDB sort object
   * @returns {stream.Readable} MongoDB cursor as readable stream
   */
  createTaskStream(query, sort) {
    // Use MongoDB cursor as a readable stream
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
          
          // Start the array if first chunk
          const prefix = isFirstChunk ? '[' : '';
          isFirstChunk = false;
          
          // Format the JSON for this task
          const taskJson = JSON.stringify(task);
          
          // Add comma for all but the first chunk
          const separator = prefix ? '' : ',';
          
          // Return combined data
          callback(null, prefix + separator + taskJson);
        } catch (error) {
          callback(error);
        }
      },
      flush(callback) {
        // Called when there are no more tasks
        if (isFirstChunk) {
          // No tasks were processed, send an empty array
          callback(null, '[]');
        } else {
          // Close the array
          callback(null, ']');
        }
        
        console.log(`JSON transform processed ${tasksProcessed} tasks`);
      }
    });
  }

  /**
   * Create a progress tracking transform stream
   * @param {Function} progressCallback - Callback for progress updates
   * @param {number} totalCount - Total number of items to process
   * @returns {stream.Transform} Transform stream that tracks progress
   */
  createProgressStream(progressCallback, totalCount) {
    let processedCount = 0;
    let lastReportedProgress = 0;
    // We'll handle division by zero safely in the transform function
    const safeTotal = totalCount || 0; // Use actual count, even if zero
    
    // Always send an initial progress update with 0% but correct total
    setTimeout(() => {
      progressCallback(0, 0, safeTotal);
    }, 0);
    
    return new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        try {
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
            progressCallback(progress, processedCount, safeTotal);
            lastReportedProgress = progress;
          }
          
          // Pass the chunk through unchanged
          callback(null, chunk);
        } catch (error) {
          callback(error);
        }
      },
      flush(callback) {
        // Make sure we send a final progress update
        if (processedCount > 0) {
          progressCallback(100, processedCount, safeTotal);
        } else {
          // Handle edge case of empty result sets
          progressCallback(100, 0, 0);
        }
        callback();
      }
    });
  }

  /**
   * Stream tasks directly to response
   * @param {Object} res - Express response object
   * @param {Object} query - MongoDB query object
   * @param {Object} sort - MongoDB sort object
   * @param {string} format - Export format ('csv' or 'json')
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<void>}
   */
  async streamToResponse(res, query, sort, format, progressCallback) {
    try {
      // Count total tasks for progress tracking
      const totalCount = await this.countTasks(query);
      
      // Set appropriate headers
      const filename = `tasks_export_${new Date().toISOString().split('T')[0]}.${format}`;
      const contentType = format === 'json' ? 'application/json' : 'text/csv';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      // Create task stream
      const taskStream = this.createTaskStream(query, sort);
      
      // Create progress tracking stream
      const progressStream = this.createProgressStream(progressCallback, totalCount);
      
      // Create format-specific transform stream
      const formatStream = format === 'json' 
        ? this.createJsonTransform() 
        : this.createCsvTransform();
      
      // Pipe everything together to the response
      taskStream
        .pipe(progressStream)
        .pipe(formatStream)
        .pipe(res);
      
      // Handle errors and cleanup
      taskStream.on('error', (error) => {
        console.error('Error in task stream:', error);
        taskStream.close?.();
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Error processing export stream' });
        }
      });
      
      // Ensure cursor is closed when response ends
      res.on('close', () => {
        taskStream.close?.();
      });
      
      // Return the filename for reference
      return { filename, totalCount };
    } catch (error) {
      console.error('Error in streamToResponse:', error);
      throw error;
    }
  }

  /**
   * Stream tasks to a buffer for storage
   * @param {Object} query - MongoDB query object
   * @param {Object} sort - MongoDB sort object
   * @param {string} format - Export format ('csv' or 'json')
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<Object>} Buffer and metadata
   */
  async streamToBuffer(query, sort, format, progressCallback) {
    try {
      // Count total tasks for progress tracking
      const totalCount = await this.countTasks(query);
      
      // Create filename with correct extension
      const filename = `tasks_export_${new Date().toISOString().split('T')[0]}.${format}`;
      
      // Create task stream
      const taskStream = this.createTaskStream(query, sort);
      
      // Create progress tracking stream
      const progressStream = this.createProgressStream(progressCallback, totalCount);
      
      // Create format-specific transform stream
      const formatStream = format === 'json'
        ? this.createJsonTransform()
        : this.createCsvTransform();
      
      // Create a promise that resolves with the buffer
      return new Promise((resolve, reject) => {
        // Collect chunks in an array
        const chunks = [];
        
        // Pipe the streams together
        taskStream
          .pipe(progressStream)
          .pipe(formatStream)
          .on('data', (chunk) => {
            // Convert chunk to buffer if it's a string
            if (typeof chunk === 'string') {
              chunks.push(Buffer.from(chunk, 'utf-8'));
            } else {
              chunks.push(chunk);
            }
          })
          .on('error', (error) => {
            taskStream.close?.();
            reject(error);
          })
          .on('end', () => {
            taskStream.close?.();
            // Combine chunks into a single buffer
            const buffer = Buffer.concat(chunks);
            resolve({ buffer, filename, totalCount });
          });
      });
    } catch (error) {
      console.error('Error in streamToBuffer:', error);
      throw error;
    }
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
    
    // Text search in title or description - optimized for performance
    if (filters.search) {
      // Use text index if available, otherwise use optimized regex
      const searchTerm = filters.search.trim();
      if (searchTerm.length > 2) {
        query.$or = [
          { title: { $regex: `^${searchTerm}`, $options: 'i' } },
          { description: { $regex: `^${searchTerm}`, $options: 'i' } }
        ];
      } else {
        // For short terms, use exact match to avoid performance issues
        query.$or = [
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } }
        ];
      }
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

  /**
   * Count total tasks matching the query
   * @param {Object} query - MongoDB query object
   * @returns {Promise<number>} Total count of matching tasks
   */
  async countTasks(query) {
    try {
      return await Task.countDocuments(query);
    } catch (error) {
      console.error('Error counting tasks:', error);
      throw error;
    }
  }
}

export default new StreamExportService();