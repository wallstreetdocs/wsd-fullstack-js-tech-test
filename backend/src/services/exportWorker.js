/**
 * @fileoverview Worker thread for processing export jobs
 * @module services/exportWorker
 */

import { parentPort } from 'worker_threads';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createWriteStream } from 'fs';
import { Transform } from 'stream';
import os from 'os';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Models (need to import them here since this is a separate thread)
import Task from '../models/Task.js';

// Connect to MongoDB (needed for each worker)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/task-analytics';
mongoose.connect(MONGODB_URI)
  .then(() => {})
  .catch(err => {});

// State for tracking job status
const jobStates = new Map();

// Listen for messages from the main thread
parentPort.on('message', async (message) => {
  try {
    const { taskId, type, data, control } = message;
    
    // Handle control messages
    if (control) {
      handleControlMessage(control);
      return;
    }
    
    // Process the received task
    let result;
    
    if (type === 'exportTasks') {
      // Initialize job state for tracking pause status
      if (data.jobId) {
        jobStates.set(data.jobId, { 
          paused: false,
          cancelled: false 
        });
      }
      
      result = await processExportTask(data);
      
      // Clean up job state after completion
      if (data.jobId) {
        jobStates.delete(data.jobId);
      }
    } else {
      throw new Error(`Unknown task type: ${type}`);
    }
    
    // Send the result back to the main thread
    parentPort.postMessage({
      taskId,
      success: true,
      result
    });
  } catch (error) {
    // Send error back to main thread
    parentPort.postMessage({
      taskId: message.taskId,
      success: false,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
});

/**
 * Handle control messages for job control (pause, resume, cancel)
 * @param {Object} control - Control message data
 */
function handleControlMessage(control) {
  const { action, jobId } = control;
  
  if (!jobId || !jobStates.has(jobId)) {
    console.log(`[Worker] Control message for unknown job: ${jobId}`);
    return;
  }
  
  const jobState = jobStates.get(jobId);
  
  switch (action) {
    case 'pause':
      console.log(`[Worker] Pausing job ${jobId}`);
      jobState.paused = true;
      jobStates.set(jobId, jobState);
      
      // Acknowledge the pause command
      parentPort.postMessage({
        type: 'control-ack',
        jobId,
        action: 'pause',
        status: 'acknowledged'
      });
      break;
      
    case 'resume':
      console.log(`[Worker] Resuming job ${jobId}`);
      jobState.paused = false;
      jobStates.set(jobId, jobState);
      
      // Acknowledge the resume command
      parentPort.postMessage({
        type: 'control-ack',
        jobId,
        action: 'resume',
        status: 'acknowledged'
      });
      break;
      
    case 'cancel':
      console.log(`[Worker] Cancelling job ${jobId}`);
      jobState.cancelled = true;
      jobStates.set(jobId, jobState);
      
      // Acknowledge the cancel command
      parentPort.postMessage({
        type: 'control-ack',
        jobId,
        action: 'cancel',
        status: 'acknowledged'
      });
      break;
      
    default:
      console.log(`[Worker] Unknown control action: ${action}`);
  }
}

/**
 * Process an export task
 * @param {Object} data - Export task data
 * @returns {Object} Processing result
 */
async function processExportTask(data) {
  const { format, filters, jobId } = data;
  
  // Build query from filters
  const query = buildQueryFromFilters(filters);
  
  // Set up sorting
  const sort = {};
  sort[filters.sortBy || 'createdAt'] = filters.sortOrder === 'desc' ? -1 : 1;
  
  // Get total count for progress tracking
  const totalCount = await Task.countDocuments(query);
  console.log(`[Worker] Found ${totalCount} tasks for export job ${jobId}`);
  
  // Send initial progress update with correct total
  parentPort.postMessage({
    type: 'progress',
    jobId,
    status: 'processing',
    progress: 0,
    processedItems: 0,
    totalItems: totalCount
  });
  
  // Create a temporary file for streaming output
  const tempDir = os.tmpdir();
  const tempFilename = `export_${jobId}_${Date.now()}.tmp`;
  const tempFilePath = path.join(tempDir, tempFilename);
  
  console.log(`[Worker] Starting streaming export of ${totalCount} tasks to ${tempFilePath}`);
  
  // Create write stream to temporary file
  const writeStream = createWriteStream(tempFilePath, { encoding: 'utf8' });
  
  // Create format-specific transform stream
  const formatTransform = createFormatTransform(format);
  
  // Connect the transform to the write stream
  formatTransform.pipe(writeStream);
  
  // Use cursor for memory-efficient processing
  const cursor = Task.find(query).sort(sort).cursor();
  
  let processed = 0;
  
  // Send initial progress update
  parentPort.postMessage({
    type: 'progress',
    jobId,
    status: 'processing',
    progress: 0,
    processedItems: 0,
    totalItems: totalCount
  });
  
  // Progress reporting configuration
  const reportEveryNth = Math.max(1, Math.floor(totalCount / 100)); // Report every 1%
  
  // Process each task with streaming
  for (let task = await cursor.next(); task != null; task = await cursor.next()) {
    // Stream task directly to file (no memory accumulation)
    formatTransform.write(task);
    processed++;
    
    // Calculate progress
    const progress = totalCount > 0 ? Math.floor((processed / totalCount) * 100) : 100;
    
    // Send progress updates
    const shouldReport = processed === 1 || processed === totalCount || 
                        processed % reportEveryNth === 0;
    
    if (shouldReport) {
      console.log(`[Worker] Streaming progress: ${progress}% (${processed}/${totalCount})`);
      parentPort.postMessage({
        type: 'progress',
        jobId,
        status: 'processing',
        progress,
        processedItems: processed,
        totalItems: totalCount
      });
    }
    
    // Check for job control (pause/cancel)
    if (jobId && processed % 10 === 0) { // Check every 10 items to reduce DB calls
      const ExportJob = (await import('../models/ExportJob.js')).default;
      const currentJob = await ExportJob.findById(jobId);
      
      if (currentJob) {
        if (currentJob.cancelled) {
          // Cleanup and throw error
          formatTransform.end();
          writeStream.end();
          fs.unlinkSync(tempFilePath);
          throw new Error('Job cancelled by user');
        }
        
        // Handle pause
        while (currentJob.paused) {
          await new Promise(resolve => setTimeout(resolve, 100));
          const refreshedJob = await ExportJob.findById(jobId);
          if (!refreshedJob) throw new Error('Job not found during pause check');
          Object.assign(currentJob, refreshedJob.toObject());
          if (currentJob.cancelled) {
            formatTransform.end();
            writeStream.end();
            fs.unlinkSync(tempFilePath);
            throw new Error('Job cancelled while paused');
          }
        }
      }
    }
  }
  
  // Close cursor and finish streaming
  await cursor.close();
  formatTransform.end();
  
  // Wait for file writing to complete
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
  
  // Read the completed file content
  console.log(`[Worker] Reading completed export file: ${tempFilePath}`);
  const fileContent = fs.readFileSync(tempFilePath, 'utf8');
  
  // Clean up temporary file
  fs.unlinkSync(tempFilePath);
  
  // Validate format and create filename
  let actualFormat = format;
  if (format !== 'json' && format !== 'csv') {
    console.log(`[Worker] Invalid format provided: ${format}, defaulting to csv`);
    actualFormat = 'csv';
  }
  
  const filename = `tasks_export_${new Date().toISOString().split('T')[0]}.${actualFormat}`;
  
  // Send final progress update
  console.log(`[Worker] Export complete: ${filename}`);
  
  return {
    totalCount,
    processedCount: processed,
    result: fileContent,
    filename,
    format: actualFormat
  };
  
  // Important: This ensures we're explicitly sending the correct format back
}

/**
 * Build database query from job filters
 * @param {Object} filters - Filter parameters
 * @returns {Object} MongoDB query object
 */
function buildQueryFromFilters(filters) {
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
 * Create a format-specific transform stream for streaming exports
 * @param {string} format - Export format (csv or json)
 * @returns {Transform} Transform stream for the specified format
 */
function createFormatTransform(format) {
  if (format === 'csv') {
    return createCsvTransform();
  } else if (format === 'json') {
    return createJsonTransform();
  } else {
    throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Create a CSV transform stream
 * @returns {Transform} CSV transform stream
 */
function createCsvTransform() {
  const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Created At', 'Updated At', 'Completed At'];
  let isFirstRow = true;

  return new Transform({
    objectMode: true,
    transform(task, encoding, callback) {
      try {
        // Add headers on first row
        const headerRow = isFirstRow ? headers.join(',') + '\n' : '';
        isFirstRow = false;

        // Format task data
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

        callback(null, headerRow + row + '\n');
      } catch (error) {
        callback(error);
      }
    }
  });
}

/**
 * Create a JSON transform stream
 * @returns {Transform} JSON transform stream
 */
function createJsonTransform() {
  let isFirstTask = true;

  return new Transform({
    objectMode: true,
    transform(task, encoding, callback) {
      try {
        // Start array on first task
        const prefix = isFirstTask ? '[' : '';
        isFirstTask = false;

        // Format task as JSON
        const taskJson = JSON.stringify(task);
        
        // Add comma separator for all but first task
        const separator = prefix ? '' : ',';

        callback(null, prefix + separator + taskJson);
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      // Close JSON array
      if (isFirstTask) {
        // No tasks processed
        callback(null, '[]');
      } else {
        callback(null, ']');
      }
    }
  });
}

// Worker initialization complete