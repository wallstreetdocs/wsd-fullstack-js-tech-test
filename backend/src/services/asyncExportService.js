/**
 * @fileoverview Async export service for background task processing
 * @module services/asyncExportService
 */

import ExportHistory from '../models/ExportHistory.js';
import { exportTasks } from './exportService.js';

/**
 * Simple in-memory job queue
 */
const jobQueue = [];
let isProcessing = false;

/**
 * Create export job and return immediately
 * @param {Object} filters - Query filters
 * @param {string} format - Export format
 * @param {Object} requestInfo - Request information
 * @returns {Promise<Object>} Job info with ID
 */
export const createExportJob = async (filters = {}, format = 'csv', requestInfo = {}) => {
  // Create export history record
  const exportRecord = await ExportHistory.createExportRecord({
    filename: `processing-${Date.now()}.${format}`, // Temporary filename
    format,
    totalRecords: 0, // Will be updated during processing
    filters,
    ipAddress: requestInfo.ipAddress,
    userAgent: requestInfo.userAgent
  });

  // Add to job queue
  jobQueue.push({
    id: exportRecord._id.toString(),
    exportRecord,
    filters,
    format,
    requestInfo
  });

  // Start processing if not already running
  if (!isProcessing) {
    processJobs();
  }

  return {
    jobId: exportRecord._id.toString(),
    status: 'pending',
    message: 'Export job created and queued for processing'
  };
};

/**
 * Process jobs in the queue
 */
async function processJobs() {
  if (isProcessing || jobQueue.length === 0) {
    return;
  }

  isProcessing = true;

  while (jobQueue.length > 0) {
    const job = jobQueue.shift();

    try {
      await processExportJob(job);
    } catch (error) {
      console.error('Job processing failed:', error);
      // Job will be marked as failed within processExportJob
    }
  }

  isProcessing = false;
}

/**
 * Process a single export job
 * @param {Object} job - Job to process
 */
async function processExportJob(job) {
  const { exportRecord, filters, format, requestInfo } = job;
  const startTime = Date.now();

  try {
    // Mark as processing
    await exportRecord.markProcessing();

    // Broadcast processing started
    if (global.socketHandlers) {
      global.socketHandlers.broadcastExportUpdate('started', {
        jobId: exportRecord._id.toString(),
        status: 'processing',
        filename: exportRecord.filename
      });
    }

    // Call the original export function (without history creation since we already have it)
    const result = await exportTasksForJob(filters, format, requestInfo);

    // Update the export record with final data
    await exportRecord.markCompleted(result.fileSizeBytes, Date.now() - startTime);

    // Update filename
    exportRecord.filename = result.filename;
    exportRecord.totalRecords = result.taskCount;
    await exportRecord.save();

    // Broadcast completion
    if (global.socketHandlers) {
      global.socketHandlers.broadcastExportUpdate('completed', {
        jobId: exportRecord._id.toString(),
        status: 'completed',
        filename: result.filename,
        taskCount: result.taskCount
      });
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;

    // Mark as failed
    await exportRecord.markFailed(error.message, executionTime);

    // Broadcast failure
    if (global.socketHandlers) {
      global.socketHandlers.broadcastExportUpdate('failed', {
        jobId: exportRecord._id.toString(),
        status: 'failed',
        filename: exportRecord.filename,
        error: error.message
      });
    }

    throw error;
  }
}

/**
 * Export tasks without creating history (for job processing)
 * @param {Object} filters - Query filters
 * @param {string} format - Export format
 * @param {Object} requestInfo - Request information
 * @returns {Promise<Object>} Export result
 */
async function exportTasksForJob(filters, format, requestInfo) {
  // Use the original export function but without history tracking
  // We'll need to modify this to not create duplicate history
  return await exportTasks(filters, format, requestInfo, null, true); // skipHistory = true
}

