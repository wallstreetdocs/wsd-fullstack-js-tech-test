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

// Listen for messages from the main thread
parentPort.on('message', async (message) => {
  try {
    const { taskId, type, data } = message;
    
    // Process the received task
    
    let result;
    
    if (type === 'exportTasks') {
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
  
  // Get all tasks matching the query
  const tasks = await Task.find(query).sort(sort).exec();
  
  
  // Process tasks and track progress
  const processedTasks = await processTasks(tasks, jobId);
  
  // Generate file content
  const fileContent = generateFileContent(processedTasks, format);
  
  // Create filename
  const filename = `tasks_export_${new Date().toISOString().split('T')[0]}.${format}`;
  
  return {
    totalCount,
    processedCount: processedTasks.length,
    result: fileContent,
    filename,
    format
  };
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
  
  // Text search in title or description
  if (filters.search) {
    query.$or = [
      { title: { $regex: filters.search, $options: 'i' } },
      { description: { $regex: filters.search, $options: 'i' } }
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
 * Process tasks and report progress
 * @param {Array} tasks - Tasks to process
 * @param {string} jobId - Export job ID
 * @returns {Array} Processed tasks
 */
async function processTasks(tasks, jobId) {
  const totalCount = tasks.length;
  // Make smaller chunks to update progress more frequently - every 5% or at least 1 item
  const chunkSize = Math.max(Math.floor(tasks.length / 20), 1);
  
  // Process tasks in chunks with progress tracking
  for (let i = 0; i < tasks.length; i += chunkSize) {
    // Calculate progress
    const currentProgress = Math.min(i + chunkSize, tasks.length);
    const progressPercent = Math.floor((currentProgress / totalCount) * 100);
    
    
    // Report progress back to main thread
    parentPort.postMessage({
      type: 'progress',
      jobId,
      progress: progressPercent,
      processedItems: currentProgress,
      totalItems: totalCount
    });
    
    // Progress reported to main thread via postMessage
    
    // In a real implementation, we might need to check if the job was paused or cancelled
    // For now, we'll just continue processing all tasks
  }
  
  return tasks;
}

/**
 * Generate file content in the specified format
 * @param {Array} tasks - Tasks to include in the file
 * @param {string} format - File format (csv or json)
 * @returns {string} File content
 */
function generateFileContent(tasks, format) {
  if (format === 'csv') {
    return generateCSV(tasks);
  } else if (format === 'json') {
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
  return JSON.stringify(tasks, null, 2);
}

// Worker initialization complete