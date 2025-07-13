/**
 * @fileoverview Async export service for background task processing
 * @module services/asyncExportService
 */

import { exportTasks } from './exportService.js';
import ExportCacheService from './exportCacheService.js';

/**
 * Simple in-memory job queue
 */
const jobQueue = [];
let isProcessing = false;

/**
 * Create export job with 2-level cache checking
 * @param {Object} filters - Query filters
 * @param {string} format - Export format
 * @param {Object} requestInfo - Request information
 * @returns {Promise<Object>} Job info with cache result or job ID
 */
export const createExportJob = async (filters = {}, format = 'csv', requestInfo = {}) => {
  try {
    console.log(`🔍 Checking cache for export request: ${format}`);

    // Check 2-level cache first
    const cacheResult = await ExportCacheService.lookupCache(filters, format);

    if (cacheResult) {
      console.log(`✅ Cache HIT from ${cacheResult.source}: ${cacheResult.filename}`);

      return {
        jobId: cacheResult.id || 'cached',
        status: 'completed',
        filename: cacheResult.filename,
        totalRecords: cacheResult.totalRecords,
        fileSizeBytes: cacheResult.fileSizeBytes,
        executionTimeMs: cacheResult.executionTimeMs,
        cached: true,
        cacheSource: cacheResult.source,
        message: `Export retrieved from ${cacheResult.source} cache`
      };
    }

    console.log('❌ Cache MISS - Creating new export job');

    // Generate cache key for this request
    const dataTimestamp = await ExportCacheService.getDataFreshnessTimestamp(filters);
    const cacheKey = ExportCacheService.generateCacheKey(filters, format, dataTimestamp);

    // Create export history record with cache key
    const exportRecord = await ExportCacheService.createDatabaseCacheRecord(
      cacheKey,
      {
        filename: `processing-${Date.now()}.${format}`,
        format,
        totalRecords: 0
      },
      filters
    );

    // Add to job queue
    jobQueue.push({
      id: exportRecord._id.toString(),
      exportRecord,
      filters,
      format,
      requestInfo,
      cacheKey
    });

    // Start processing if not already running
    if (!isProcessing) {
      processJobs();
    }

    return {
      jobId: exportRecord._id.toString(),
      status: 'pending',
      cached: false,
      message: 'Export job created and queued for processing'
    };
  } catch (error) {
    console.error('Error creating export job:', error);
    throw error;
  }
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
 * Process a single export job with cache updates
 * @param {Object} job - Job to process
 */
async function processExportJob(job) {
  const { exportRecord, filters, format, requestInfo, cacheKey } = job;
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
    const executionTime = Date.now() - startTime;

    // Update the export record with final data
    await exportRecord.markCompleted(result.fileSizeBytes, executionTime);

    // Update filename and total records
    exportRecord.filename = result.filename;
    exportRecord.totalRecords = result.taskCount;
    await exportRecord.save();

    // Update cache with completion data
    if (cacheKey) {
      await ExportCacheService.updateDatabaseCacheRecord(cacheKey, {
        fileSizeBytes: result.fileSizeBytes,
        executionTimeMs: executionTime
      });

      // Set Redis cache for faster future access
      await ExportCacheService.setRedisCache(cacheKey, {
        filename: result.filename,
        format: format,
        totalRecords: result.taskCount,
        fileSizeBytes: result.fileSizeBytes,
        executionTimeMs: executionTime
      });
    }

    // Broadcast completion
    if (global.socketHandlers) {
      global.socketHandlers.broadcastExportUpdate('completed', {
        jobId: exportRecord._id.toString(),
        status: 'completed',
        filename: result.filename,
        taskCount: result.taskCount
      });
    }

    console.log(`✅ Export completed and cached: ${result.filename}`);

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

    console.error(`❌ Export failed: ${error.message}`);
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

