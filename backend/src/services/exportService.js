/**
 * @fileoverview Export service for background task exports
 * @module services/exportService
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Task from '../models/Task.js';
import ExportJob from '../models/ExportJob.js';
import { redisClient } from '../config/redis.js';
import jobQueue from './jobQueue.js';
import streamExportService from './streamExportService.js';
import { buildQueryFromFilters, buildSortFromFilters } from '../utils/queryBuilder.js';
import exportConfig from '../config/exportConfig.js';
import crypto from 'crypto';

class ExportService extends EventEmitter {
  constructor() {
    super();
    this.jobStateManager = null; // Will be set by socket handlers
    this.initializeJobProcessing();
  }

  /**
   * Set the job state manager for status broadcasting
   * @param {JobStateManager} jobStateManager - Job state manager instance
   */
  setJobStateManager(jobStateManager) {
    this.jobStateManager = jobStateManager;
  }

  /**
   * Initialize job processing
   * @private
   */
  initializeJobProcessing() {
    // Initialize job queue
    jobQueue.initialize();

    // Set up event listeners
    jobQueue.on('process-job', async (jobRequest) => {

      if (jobRequest.type === 'exportTasks') {
        await this.handleExportJobProcessing(jobRequest);
      }
    });

  }


  /**
   * Handle export job processing
   * @private
   * @param {Object} jobRequest - Job request object
   */
  async handleExportJobProcessing(jobRequest) {
    const { id: jobId, callback } = jobRequest;

    try {
      // Check if the job exists
      const job = await ExportJob.findById(jobId);
      if (!job) {
        throw new Error(`Export job ${jobId} not found`);
      }

      // Don't process paused or cancelled jobs
      if (job.status === 'paused') {
        callback({ paused: true, progress: { processedItems: job.processedItems } });
        return;
      }

      if (job.status === 'cancelled') {
        callback({ success: false, error: new Error('Export job was cancelled') });
        return;
      }

      // Update job status to processing through JobStateManager
      if (this.jobStateManager) {
        await this.jobStateManager.updateProgress(jobId, 0, 0, 0, 'job-processing');
      }

      // Check cache first (skip if refreshCache is true)
      const cacheKey = this.generateCacheKey(job);
      let cachedResult = null;
      
      if (job.refreshCache) {
        // Invalidate existing cache entry for this job
        await redisClient.del(cacheKey);
      } else {
        cachedResult = await redisClient.get(cacheKey);
      }

      if (cachedResult) {
        const cachedData = JSON.parse(cachedResult);

        // Restore temp file data from cache
        job.tempFilePath = cachedData.tempFilePath;
        job.filename = cachedData.filename;
        job.fileSize = cachedData.fileSize;
        job.storageType = 'tempFile';
        await job.save();

        if (this.jobStateManager) {
          await this.jobStateManager.completeJob(jobId, cachedData.filename, cachedData.totalItems);
        }

        callback({
          success: true,
          data: {
            jobId,
            status: 'completed',
            progress: 100,
            filename: cachedData.filename
          }
        });

        return;
      }

      const query = buildQueryFromFilters(job.filters);
      const totalCount = await Task.countDocuments(query);

      // Use streaming with temp file for all exports (simplified unified approach)
      const sort = buildSortFromFilters(job.filters);

      // Create progress tracking function for all exports
      const progressCallback = async (progress, processedItems, totalItems) => {
        try {
          // Check if job was cancelled or paused before updating progress
          const currentJob = await ExportJob.findById(job._id);
          if (currentJob && (currentJob.status === 'cancelled' || currentJob.status === 'paused')) {
            // Save progress for resume (offset-based approach)
            await ExportJob.findByIdAndUpdate(job._id, { 
              processedItems 
            });
            
            // Return status signal instead of throwing error
            return { stopped: true, reason: currentJob.status, processedItems };
          }
          
          // Update progress through JobStateManager if available
          if (this.jobStateManager) {
            this.jobStateManager.updateProgress(
              job._id.toString(),
              progress,
              processedItems,
              totalItems,
              'export-stream-progress'
            ).catch(error => {
              console.error('[ExportService] Error updating progress:', error);
            });
          }
        } catch (error) {
          if (error.message.includes('cancelled') || error.message.includes('paused')) {
            throw error;
          } else {
            console.error('[ExportService] Error in progress callback:', error);
          }
        }
      };

      // Check if job has existing temp file for resume
      const tempFilePath = (job.tempFilePath && fs.existsSync(job.tempFilePath)) 
        ? job.tempFilePath 
        : path.join(os.tmpdir(), `export_${Date.now()}.${job.format}`);

      // Stream data to file - append if resuming, otherwise create new
      const writeStream = fs.createWriteStream(tempFilePath, { 
        flags: (job.tempFilePath && fs.existsSync(job.tempFilePath)) ? 'a' : 'w' 
      });

      // Save temp file path immediately for resume capability
      if (!job.tempFilePath) {
        job.tempFilePath = tempFilePath;
        await job.save();
      }

      // Get resume information for streaming exports
      const resumeFromCount = job.processedItems || 0;
      
      // Determine if we're appending to existing file
      const isAppending = job.tempFilePath && fs.existsSync(job.tempFilePath);
      
      // For JSON files, prepare the existing file for appending
      if (isAppending && job.format === 'json') {
        await streamExportService.prepareJsonFileForAppend(job.tempFilePath);
      }
      
      // Create streams with offset-based resume capability
      const taskStream = streamExportService.createTaskStream(query, sort, resumeFromCount);
      const progressStream = streamExportService.createProgressStream(progressCallback, totalCount, resumeFromCount);
      const formatStream = job.format === 'json'
        ? streamExportService.createJsonTransform(isAppending)
        : streamExportService.createCsvTransform();

      // Wait for stream to finish
      const result = await new Promise((resolve, reject) => {
        const pipeline = taskStream
          .pipe(progressStream)
          .pipe(formatStream)
          .pipe(writeStream);
          
        // Store resolver so progressStream can trigger completion
        progressStream._pipelineResolver = resolve;
          
        pipeline.on('finish', () => resolve({ completed: true }));
        pipeline.on('error', (error) => {
          // For actual errors, reject normally
          reject(error);
        });
      });

      // Check if export was stopped (paused/cancelled)
      if (result.stopped) {
        if (result.reason === 'cancelled') {
          // Clean up temp file for cancelled exports
          try {
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
          } catch (cleanupError) {
            console.error('[ExportService] Error cleaning up temp file:', cleanupError);
          }
          
          callback({ success: false, error: new Error('Export cancelled') });
        } else if (result.reason === 'paused') {
          // Keep temp file for paused exports and signal pause with current progress
          callback({ 
            paused: true, 
            progress: { 
              processedItems: result.processedItems || job.processedItems
            } 
          });
        }
        return;
      }

      // Get file size
      const stats = fs.statSync(tempFilePath);
      const fileSize = stats.size;

      // Generate filename
      const filename = `tasks_export_${new Date().toISOString().split('T')[0]}.${job.format}`;

      // Update job with temp file info
      job.tempFilePath = tempFilePath;
      job.filename = filename;
      job.fileSize = fileSize;
      job.storageType = 'tempFile';
      await job.save();

      if (this.jobStateManager) {
        await this.jobStateManager.completeJob(jobId, filename, totalCount);
      }

      // Cache the temp file path and metadata
      await this.cacheTempFileResult(cacheKey, totalCount, tempFilePath, filename, fileSize);

      callback({
        success: true,
        data: {
          jobId,
          status: 'completed',
          progress: 100,
          filename
        }
      });
    } catch (error) {
      // Check if this is a cancellation or pause error
      if (error.message.includes('cancelled')) {
        // Update job status to cancelled through JobStateManager
        try {
          if (this.jobStateManager) {
            await this.jobStateManager.cancelJob(jobId, 'export-cancelled');
          }
        } catch (dbError) {
          console.error('[ExportService] Error setting job cancelled status in DB:', dbError);
        }

        // Return cancellation result
        callback({
          success: false,
          cancelled: true,
          error: {
            message: 'Export job was cancelled',
            stack: error.stack
          }
        });
      } else if (error.message.includes('paused')) {
        // Return pause result
        callback({
          success: false,
          paused: true,
          error: {
            message: 'Export job was paused',
            stack: error.stack
          }
        });
      } else {
        // Update job status to failed through JobStateManager
        try {
          if (this.jobStateManager) {
            await this.jobStateManager.failJob(jobId, error.message);
          }
        } catch (dbError) {
          console.error('[ExportService] Error setting job failed status in DB:', dbError);
        }

        // Fail the job in the queue
        callback({
          success: false,
          error: {
            message: error.message,
            stack: error.stack
          }
        });
      }
    }
  }

  /**
   * Create a new export job for background processing
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format ('csv' or 'json')
   * @param {Object} params.filters - Filter parameters
   * @param {string} [params.clientId] - Client socket ID for tracking
   * @param {boolean} [params.refreshCache] - Whether to bypass cache
   * @returns {Promise<Object>} Created export job
   */
  async createExportJob(params) {

    const format = (params.format || 'csv').toLowerCase();
    const validatedFormat = format === 'json' ? 'json' : 'csv';

    const { filters, clientId, refreshCache = false } = params;

    const query = buildQueryFromFilters(filters);

    const totalCount = await Task.countDocuments(query);

    // Create the export job
    const exportJob = new ExportJob({
      format: validatedFormat,
      filters,
      clientId,
      refreshCache,
      status: 'pending',
      totalItems: totalCount,
      processedItems: 0
    });

    await exportJob.save();

    // Add job to the queue for background processing
    await jobQueue.addJob(
      exportJob._id.toString(),
      'exportTasks',
      {
        format: validatedFormat,
        filters,
        clientId
      }
    );

    return exportJob;
  }


  /**
   * Generate a cache key for an export job based on its parameters
   * @param {Object} jobParams - Export job parameters
   * @returns {string} Cache key
   */
  generateCacheKey(jobParams) {
    const { format, filters } = jobParams;
    // Create a deterministic string from the job parameters
    const paramsString = JSON.stringify({
      format,
      filters: {
        // Basic filters
        status: filters.status || null,
        priority: filters.priority || null,
        sortBy: filters.sortBy || 'createdAt',
        sortOrder: filters.sortOrder || 'desc',

        // Advanced filters
        search: filters.search || null,
        createdAfter: filters.createdAfter || null,
        createdBefore: filters.createdBefore || null,
        completedAfter: filters.completedAfter || null,
        completedBefore: filters.completedBefore || null,
        estimatedTimeLt: filters.estimatedTimeLt || null,
        estimatedTimeGte: filters.estimatedTimeGte || null
      }
    });
    // Create a hash of the parameters string for a shorter key
    return `export:${crypto.createHash('md5').update(paramsString).digest('hex')}`;
  }

  /**
   * Get TTL for cache based on export size
   * @param {number} totalItems - Total number of items in export
   * @returns {number} TTL in seconds
   */
  getCacheTTL(totalItems) {
    return totalItems > 1000
      ? exportConfig.mediumExportCacheTTL
      : exportConfig.smallExportCacheTTL;
  }


  /**
   * Cache temp file path and metadata for future use
   * @private
   * @param {string} cacheKey - Cache key
   * @param {number} totalCount - Total items count
   * @param {string} tempFilePath - Path to temp file
   * @param {string} filename - Export filename
   * @param {number} fileSize - Size of the file in bytes
   * @returns {Promise<void>}
   */
  async cacheTempFileResult(cacheKey, totalCount, tempFilePath, filename, fileSize) {
    try {
      const cacheTTL = this.getCacheTTL(totalCount);

      const cacheData = {
        totalItems: totalCount,
        tempFilePath: tempFilePath,
        filename: filename,
        fileSize: fileSize,
        storageType: 'tempFile'
      };

      await redisClient.setex(cacheKey, cacheTTL, JSON.stringify(cacheData));
    } catch (cacheError) {
        console.error('[ExportService] Error caching temp file result:', cacheError);
    }
  }

  /**
   * Invalidate only export caches that would be affected by a task change
   * @param {Object} taskChange - Information about the task change
   * @param {Object} taskChange.oldTask - Task before change (for updates)
   * @param {Object} taskChange.newTask - Task after change
   * @param {string} taskChange.operation - 'create', 'update', or 'delete'
   * @returns {Promise<void>}
   */
  async invalidateAffectedCaches(taskChange) {
    try {
      const { oldTask, newTask, operation } = taskChange;
      const task = newTask || oldTask;

      // Get all possible cache keys that could be affected
      const affectedKeys = new Set();

      // For creates/deletes, any cache without specific filters could be affected
      if (operation === 'create' || operation === 'delete') {
        // Invalidate unfiltered caches (no status/priority filters)
        this.addAffectedCacheKeys(affectedKeys, {});
      }

      // For all operations, check filters that could match this task
      const taskStatuses = operation === 'update' && oldTask
        ? [oldTask.status, newTask?.status].filter(Boolean)
        : [task.status];

      const taskPriorities = operation === 'update' && oldTask
        ? [oldTask.priority, newTask?.priority].filter(Boolean)
        : [task.priority];

      // Add cache keys for status/priority combinations that could include this task
      for (const status of taskStatuses) {
        this.addAffectedCacheKeys(affectedKeys, { status });

        for (const priority of taskPriorities) {
          this.addAffectedCacheKeys(affectedKeys, { status, priority });
        }
      }

      for (const priority of taskPriorities) {
        this.addAffectedCacheKeys(affectedKeys, { priority });
      }

      // Invalidate all affected cache keys
      const invalidationPromises = Array.from(affectedKeys).map(async (cacheKey) => {
        try {
          const cachedData = await redisClient.get(cacheKey);
          if (cachedData) {
            try {
              const data = JSON.parse(cachedData);
              if (data.storageType === 'tempFile' && data.tempFilePath) {
                if (fs.existsSync(data.tempFilePath)) {
                  fs.unlinkSync(data.tempFilePath);
                }
              }
            } catch (parseError) {
              // Ignore parsing errors
            }
            await redisClient.del(cacheKey);
          }
        } catch (error) {
          console.error('[ExportService] Error invalidating cache key:', cacheKey, error);
        }
      });

      await Promise.all(invalidationPromises);
    } catch (error) {
      console.error('[ExportService] Error in selective cache invalidation:', error);
      // Non-critical operation, continue
    }
  }

  /**
   * Helper method to add affected cache keys for both CSV and JSON formats
   * @private
   * @param {Set} affectedKeys - Set to add cache keys to
   * @param {Object} filters - Filter parameters
   */
  addAffectedCacheKeys(affectedKeys, filters) {
    // Add cache keys for both formats with these filters
    for (const format of ['csv', 'json']) {
      const cacheKey = this.generateCacheKey({ format, filters });
      affectedKeys.add(cacheKey);
    }
  }

  /**
   * Stream an export directly to response
   * @param {string} jobId - Export job ID
   * @param {Object} res - Express response object
   * @returns {Promise<boolean>} True if streamed successfully
   */
  async streamExportToResponse(jobId, res) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }

    if (job.status !== 'completed') {
      throw new Error('Export is not completed yet');
    }

    try {
      // Make sure job has consistent count values
      const safeCount = Math.max(job.totalItems || 1, job.processedItems || 1);
      if (job.totalItems !== safeCount || job.processedItems !== safeCount) {
        job.totalItems = safeCount;
        job.processedItems = safeCount;
        job.progress = 100;
        await job.save();
      }

      // Serve from temp file
      if (!job.tempFilePath || !fs.existsSync(job.tempFilePath)) {
        throw new Error('Export file not found');
      }

      let contentType;
      if (job.format === 'json') {
        contentType = 'application/json';
      } else {
        contentType = 'text/csv';
      }

      const filename = job.filename || `tasks_export_${new Date().toISOString().split('T')[0]}.${job.format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

      // Stream the file to response
      const fileStream = fs.createReadStream(job.tempFilePath);
      fileStream.pipe(res);
      return true;
    } catch (error) {
      console.error('[ExportService] Error streaming export:', error);
      throw error;
    }
  }

  /**
   * Pause an export job (simplified - status check handles pause naturally)
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Export job
   */
  async pauseExportJob(jobId) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }

    // Pause is handled naturally through status checks in streaming

    return job;
  }

  /**
   * Resume an export job (simplified unified approach)
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Export job
   */
  async resumeExportJob(jobId) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }

    if (job.status === 'paused') {
      // Update job status to processing
      if (this.jobStateManager) {
        await this.jobStateManager.resumeJob(jobId, 'resume-export');
      }
      
      // Re-add the job to the queue for processing - it will detect resume state and continue from cursor
      await jobQueue.addJob(
        jobId,
        'exportTasks',
        {
          format: job.format,
          filters: job.filters,
          clientId: job.clientId
        }
      );
    }

    return job;
  }

  /**
   * Cancel an export job (only handles worker signaling and queue removal, state managed by JobStateManager)
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Export job
   */
  async cancelExportJob(jobId) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }

    // Cancellation is handled naturally through status checks in streaming

    // Remove from queue if pending
    if (job.status === 'pending') {
      await jobQueue.removeJob(jobId);
    }

    return job;
  }

  /**
   * Get an export job by ID
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Export job
   */
  async getExportJob(jobId) {
    return ExportJob.findById(jobId);
  }

  /**
   * Get export jobs for a client with fallback for undefined clientId
   * @param {string} clientId - Client socket ID
   * @returns {Promise<Array>} Export jobs
   */
  async getClientExportJobs(clientId) {
    if (!clientId) {
      // Fallback: return recent active jobs from last hour when clientId is undefined
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return ExportJob.find({
        $or: [
          { status: 'processing' },
          { status: 'paused' },
          { createdAt: { $gte: oneHourAgo } }
        ]
      }).sort({ createdAt: -1 }).limit(10);
    }
    return ExportJob.find({ clientId }).sort({ createdAt: -1 });
  }

  /**
   * Get recent export jobs with pagination
   * @param {number} [page=1] - Page number
   * @param {number} [limit=10] - Items per page
   * @returns {Promise<Object>} Paginated export jobs
   */
  async getExportHistory(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const jobs = await ExportJob.find({}, { result: 0 }) // Exclude result field to reduce response size
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ExportJob.countDocuments();

    return {
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

export default new ExportService();
