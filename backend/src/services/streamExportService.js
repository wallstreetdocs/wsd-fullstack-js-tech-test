/**
 * @fileoverview Stream-based export service for efficient task exports
 * @module services/streamExportService
 */

import { Transform } from 'stream';
import fs from 'fs';
import Task from '../models/Task.js';
import { buildQueryFromFilters, buildSortFromFilters } from '../utils/queryBuilder.js';

class StreamExportService {
  /**
   * Create a readable stream for task data
   * @param {Object} query - MongoDB query object
   * @param {Object} sort - MongoDB sort object
   * @param {number} skipCount - Number of items to skip for resume functionality
   * @returns {stream.Readable} MongoDB cursor as readable stream
   */
  createTaskStream(query, sort, skipCount = 0) {
    // Use offset-based resume for reliable pagination
    // More reliable for pause/resume scenarios than cursor-based approach
    return Task.find(query).sort(sort).skip(skipCount).cursor();
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
   * @param {boolean} isAppending - Whether we're appending to existing file
   * @returns {stream.Transform} Transform stream for JSON
   */
  createJsonTransform(isAppending = false) {
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
            isFirstChunk = false;
            if (isAppending) {
              // When appending, start with comma (assumes existing file ends with valid JSON)
              callback(null, ',' + taskJson);
            } else {
              // New file: start array with opening bracket
              callback(null, '[' + taskJson);
            }
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
        if (isFirstChunk && !isAppending) {
          // No tasks were processed in new file, send an empty array
          callback(null, '[]');
        } else {
          // Close the array
          callback(null, ']');
        }
      }
    });
  }

  /**
   * Prepare JSON file for appending by removing closing bracket
   * @param {string} filePath - Path to the JSON file
   * @returns {Promise<void>}
   */
  async prepareJsonFileForAppend(filePath) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 0) {
        // Read the last few bytes to find and remove the closing ']'
        const fd = fs.openSync(filePath, 'r+');
        const buffer = Buffer.alloc(10);
        const bytesRead = fs.readSync(fd, buffer, 0, 10, Math.max(0, stats.size - 10));
        
        const lastContent = buffer.slice(0, bytesRead).toString();
        const lastBracketIndex = lastContent.lastIndexOf(']');
        
        if (lastBracketIndex !== -1) {
          // Truncate the file to remove the closing bracket
          const truncatePosition = stats.size - (bytesRead - lastBracketIndex);
          fs.ftruncateSync(fd, truncatePosition);
        }
        
        fs.closeSync(fd);
      }
    } catch (error) {
      console.error('Error preparing JSON file for append:', error);
      // Non-critical error, continue with append
    }
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
    const safeTotal = totalCount || 0;

    return new Transform({
      objectMode: true,
      async transform(chunk, encoding, callback) {
        try {
          processedCount++;

          const progress = safeTotal > 0 ? Math.floor((processedCount / safeTotal) * 100) : 0;
          const shouldReport = progress >= lastReportedProgress + 1 || processedCount === 1 || processedCount === safeTotal;

          if (shouldReport) {
            try {
              const result = await progressCallback(progress, processedCount, safeTotal);
              
              // Check if job was stopped (paused/cancelled)
              if (result && result.stopped) {
                // Signal pipeline to stop with the reason and current progress
                if (this._pipelineResolver) {
                  this._pipelineResolver({ 
                    stopped: true, 
                    reason: result.reason,
                    processedItems: result.processedItems
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
          await progressCallback(100, processedCount, safeTotal);
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

}

export default new StreamExportService();
