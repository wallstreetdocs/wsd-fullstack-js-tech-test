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
  
  // Use cursor for memory-efficient processing with real-time updates
  const cursor = Task.find(query).sort(sort).cursor();
  
  let processedTasks = [];
  let processed = 0;
  
  // Before processing tasks, send the initial progress update
  console.log(`[Worker] Starting export of ${totalCount} tasks for job ${jobId}`);
  parentPort.postMessage({
    type: 'progress',
    jobId,
    status: 'processing',
    progress: 0,
    processedItems: 0,
    totalItems: totalCount
  });
  
  // For small exports with few items, create artificial progress points to make it visible
  const progressPoints = Math.max(10, totalCount);
  const reportEveryNth = Math.max(1, Math.floor(totalCount / progressPoints));
  
  // Process each task individually for maximum progress granularity
  for (let task = await cursor.next(); task != null; task = await cursor.next()) {
    // Add task to processed list
    processedTasks.push(task);
    processed++;
    
    // Calculate real progress percentage - ensure it's at least 1% after processing starts
    const progress = processed === 1 ? 1 : Math.floor((processed / totalCount) * 100);
    
    // Send progress update for EVERY item or at specific intervals for large exports
    const shouldReport = processed === 1 || processed === totalCount || 
                        processed % reportEveryNth === 0 || progress % 10 === 0;
    
    if (shouldReport) {
      console.log(`[Worker] Export progress: ${progress}% (${processed}/${totalCount})`);
      parentPort.postMessage({
        type: 'progress',
        jobId,
        status: 'processing',
        progress,
        processedItems: processed,
        totalItems: totalCount
      });
      
      // Add a small delay to make progress updates more visible in the UI
      // This is only for development/demo purposes to simulate longer processing time
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Check for pause or cancellation from database
    if (jobId) {
      const ExportJob = (await import('../models/ExportJob.js')).default;
      const currentJob = await ExportJob.findById(jobId);
      
      if (currentJob) {
        // If cancelled, stop processing
        if (currentJob.cancelled) {
          throw new Error('Job cancelled by user');
        }
        
        // If paused, wait until resumed
        while (currentJob.paused) {
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Refresh job state from database by re-fetching
          const refreshedJob = await ExportJob.findById(jobId);
          if (!refreshedJob) {
            throw new Error('Job not found during pause check');
          }
          
          // Update current job reference
          Object.assign(currentJob, refreshedJob.toObject());
          
          // Check for cancellation during pause
          if (currentJob.cancelled) {
            throw new Error('Job cancelled while paused');
          }
        }
      }
    }
  }
  
  // Close cursor to free resources
  await cursor.close();
  
  // Generate file content (this might take time for large exports)
  console.log(`[Worker] Generating ${format} file for ${processed} tasks`);
  const fileContent = generateFileContent(processedTasks, format);
  
  // Clear processed tasks from memory to prevent accumulation
  processedTasks = null;
  
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

// Note: processTasks function removed since we now handle processing 
// directly in processExportTask for more granular updates

/**
 * Generate file content in the specified format
 * @param {Array} tasks - Tasks to include in the file
 * @param {string} format - File format (csv or json)
 * @returns {string} File content
 */
function generateFileContent(tasks, format) {
  console.log(`[Worker] Generating file content in format: ${format}`);
  if (format === 'csv') {
    console.log(`[Worker] Generating CSV content`);
    return generateCSV(tasks);
  } else if (format === 'json') {
    console.log(`[Worker] Generating JSON content`);
    return generateJSON(tasks);
  } else {
    throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Generate CSV content from tasks
 * @param {Array} tasks - Tasks to include in the CSV
 * @returns {string} CSV content
 */
function generateCSV(tasks) {
  // Create CSV content
  const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Created At', 'Updated At', 'Completed At'];
  const rows = [];
  
  // Process each task
  for (const task of tasks) {
    rows.push([
      task._id,
      task.title,
      task.description || '',
      task.status,
      task.priority,
      task.createdAt,
      task.updatedAt,
      task.completedAt || ''
    ]);
  }
  
  // Finalize CSV content
  return [
    headers.join(','), 
    ...rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    )
  ].join('\n');
}

/**
 * Generate JSON content from tasks
 * @param {Array} tasks - Tasks to include in the JSON
 * @returns {string} JSON content
 */
function generateJSON(tasks) {
  console.log('[Worker] JSON format requested, generating JSON string');
  return JSON.stringify(tasks, null, 2);
}

// Worker initialization complete