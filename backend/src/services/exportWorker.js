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
import streamExportService from './streamExportService.js';

// Worker control flags
let shouldPause = false;
let shouldCancel = false;
let currentTaskId = null;

// Connect to MongoDB (needed for each worker)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/task-analytics';
mongoose.connect(MONGODB_URI)
  .then(() => {})
  .catch(err => {});


// Listen for messages from the main thread
parentPort.on('message', async (message) => {
  try {
    const { taskId, type, data } = message;
    
    // Handle control messages
    if (type === 'pause' && taskId === currentTaskId) {
      shouldPause = true;
      return;
    }
    
    if (type === 'cancel' && taskId === currentTaskId) {
      shouldCancel = true;
      return;
    }
    
    // Process the received task
    let result;
    
    if (type === 'exportTasks') {
      currentTaskId = taskId;
      shouldPause = false;
      shouldCancel = false;
      
      result = await processExportTask(data);
      
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
    // Check if this was a controlled pause/cancel
    if (error.message.includes('Job paused at')) {
      const [, processedStr, lastProcessedId] = error.message.match(/(\d+) items\|(.+)/) || [];
      const processed = parseInt(processedStr) || 0;
      parentPort.postMessage({
        taskId: message.taskId,
        success: false,
        paused: true,
        progress: {
          processedItems: processed,
          lastProcessedId: lastProcessedId || null
        }
      });
    } else {
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
  }
});


/**
 * Process an export task
 * @param {Object} data - Export task data
 * @returns {Object} Processing result
 */
async function processExportTask(data) {
  const { format, filters, jobId } = data;
  
  // Build query from filters using StreamExportService
  const query = streamExportService.buildQueryFromFilters(filters);
  
  // Handle resume from specific point
  if (filters._lastProcessedId) {
    // Resume from the last processed item (for consistent sorting)
    query._id = { $gt: filters._lastProcessedId };
  }
  
  // Set up sorting
  const sort = {};
  sort[filters.sortBy || 'createdAt'] = filters.sortOrder === 'desc' ? -1 : 1;
  
  // Get total count for progress tracking
  const totalCount = await Task.countDocuments(query);
  console.log(`[Worker] Found ${totalCount} tasks for export job ${jobId}`);
  
  // Send initial progress update with correct total
  parentPort.postMessage({
    type: 'job-progress',
    jobId,
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
  
  // Create format-specific transform stream using StreamExportService
  const formatTransform = format === 'csv' 
    ? streamExportService.createCsvTransform()
    : streamExportService.createJsonTransform();
  
  // Connect the transform to the write stream
  formatTransform.pipe(writeStream);
  
  // Use cursor for memory-efficient processing
  const cursor = Task.find(query).sort(sort).cursor();
  
  let processed = 0;
  let lastProcessedId = null;
  
  // Track base progress for resumed jobs
  const baseProgress = filters._resumeFromItem || 0;
  
  // Send initial progress update
  parentPort.postMessage({
    type: 'job-progress',
    jobId,
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
    lastProcessedId = task._id;
    
    // Calculate progress including base progress from previous runs
    const totalProcessed = baseProgress + processed;
    const totalItems = baseProgress + totalCount;
    const progress = totalItems > 0 ? Math.floor((totalProcessed / totalItems) * 100) : 100;
    
    // Send progress updates
    const shouldReport = processed === 1 || processed === totalCount || 
                        processed % reportEveryNth === 0;
    
    if (shouldReport) {
      console.log(`[Worker] Streaming progress: ${progress}% (${totalProcessed}/${totalItems})`);
      parentPort.postMessage({
        type: 'job-progress',
        jobId,
        progress,
        processedItems: totalProcessed,
        totalItems: totalItems
      });
    }
    
    // Check for job control (immediate response to signals)
    if (shouldCancel) {
      // Cleanup and throw error
      formatTransform.end();
      writeStream.end();
      fs.unlinkSync(tempFilePath);
      throw new Error('Job cancelled by user');
    }
    
    if (shouldPause && processed > 0) {
      // Save progress and gracefully exit
      formatTransform.end();
      writeStream.end();
      fs.unlinkSync(tempFilePath);
      throw new Error(`Job paused at ${baseProgress + processed} items|${lastProcessedId}`);
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


// Worker initialization complete