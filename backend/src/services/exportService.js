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
import workerPool from './workerPool.js';
import streamExportService from './streamExportService.js';
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
    console.log('[ExportService] JobStateManager connected');
  }

  /**
   * Initialize job processing
   * @private
   */
  initializeJobProcessing() {
    // Initialize job queue
    jobQueue.initialize();
    
    // Initialize worker pool if not already initialized
    if (!workerPool.initialized) {
      workerPool.initialize();
    }

    // Set up event listeners
    jobQueue.on('process-job', async (jobRequest) => {
      if (jobRequest.type === 'exportTasks') {
        await this.handleExportJobProcessing(jobRequest);
      }
    });

    // Set up worker progress event listener
    workerPool.on('task-progress', (message) => {
      if (message && message.jobId) {
        this.handleProgressUpdate(message);
      }
    });
  }

  /**
   * Handle progress updates from worker threads
   * @private
   * @param {Object} progressData - Progress data from worker
   */
  async handleProgressUpdate(progressData) {
    const { jobId, progress, processedItems, totalItems } = progressData;
    
    try {
      // Update job progress in database
      const job = await ExportJob.findById(jobId);
      if (job) {
        await job.updateProgress(processedItems, totalItems);
        
      } else {
        // Job not found - might have been deleted
        console.log(`[ExportService DEBUG] Progress update for non-existent job: ${jobId}`);
      }
    } catch (error) {
      // Error handling is done, no need to log
    }
  }

  /**
   * Handle export job processing
   * @private
   * @param {Object} jobRequest - Job request object
   */
  async handleExportJobProcessing(jobRequest) {
    const { id: jobId, data, callback } = jobRequest;
    
    try {
      // Check if the job exists and update its status
      const job = await ExportJob.findById(jobId);
      if (!job) {
        throw new Error(`Export job ${jobId} not found`);
      }
      
      // Update job status to processing
      job.status = 'processing';
      await job.save();
      
      // Check cache first
      const cacheKey = this.generateCacheKey(job);
      const cachedResult = await redisClient.get(cacheKey);
      
      // When we load from cache often times it's too fast
      // so for visuals we do some timeouts to artificially show progress
      if (cachedResult) {
        console.log("EVALDAS - CACHED RESULT")
        const cachedData = JSON.parse(cachedResult);
        
        // Small delay to simulate processing time for better UX
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Handle different cache storage types
        if (cachedData.storageType === 'tempFile') {
          // Temp file storage
          job.status = 'completed';
          job.progress = 100;
          job.totalItems = cachedData.totalItems;
          job.processedItems = cachedData.totalItems;
          job.tempFilePath = cachedData.tempFilePath;
          job.filename = cachedData.filename;
          job.fileSize = cachedData.fileSize;
          job.storageType = 'tempFile';
          await job.save();
        } else {
          // Standard buffer storage
          job.status = 'completed';
          job.progress = 100;
          job.totalItems = cachedData.totalItems;
          job.processedItems = cachedData.totalItems;
          job.result = Buffer.from(cachedData.result, 'base64');
          job.filename = cachedData.filename;
          job.storageType = 'buffer';
          await job.save();
        }
        
        // Job completion is handled by database state - no events needed
        
        // Complete the job in the queue
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
      
      // Check if this export will be too large for buffer storage
      const query = streamExportService.buildQueryFromFilters(job.filters);
      const totalCount = await Task.countDocuments(query);
      
      // Determine storage strategy based on estimated size
      const estimatedSize = this.estimateExportSize(totalCount, job.format);
      const useStreamingWithTempFile = estimatedSize > exportConfig.mediumExportThreshold;
      const sort = streamExportService.buildSortFromFilters(job.filters);
      
      // For very large exports, use streaming with temp file storage
      if (useStreamingWithTempFile) {
        console.log("EVALDAS - STREAMING WITH TEMP FILE")
        // Create progress tracking function for large exports
        const progressCallback = (progress, processedItems, totalItems) => {
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
        };
        
        // Create temp file path
        const tempFilePath = path.join(os.tmpdir(), `export_${Date.now()}.${job.format}`);
        
        // Stream data to file
        const writeStream = fs.createWriteStream(tempFilePath);
        
        // Create streams and pipe them
        const taskStream = streamExportService.createTaskStream(query, sort);
        const progressStream = streamExportService.createProgressStream(progressCallback, totalCount);
        const formatStream = job.format === 'json'
          ? streamExportService.createJsonTransform()
          : streamExportService.createCsvTransform();
        
        // Wait for stream to finish
        await new Promise((resolve, reject) => {
          taskStream
            .pipe(progressStream)
            .pipe(formatStream)
            .pipe(writeStream)
            .on('finish', resolve)
            .on('error', reject);
        });
        
        // Get file size
        const stats = fs.statSync(tempFilePath);
        const fileSize = stats.size;
        
        // Generate filename
        const filename = `tasks_export_${new Date().toISOString().split('T')[0]}.${job.format}`;
        
        // Update job with temp file info
        await job.completeWithTempFile(tempFilePath, filename, fileSize);
        
        // Cache the temp file path and metadata
        await this.cacheTempFileResult(cacheKey, totalCount, tempFilePath, filename, fileSize);
        
        // Job completion is handled by database state - no events needed
        
        // Complete the job in the queue
        callback({
          success: true,
          data: {
            jobId,
            status: 'completed',
            progress: 100,
            filename
          }
        });
      } else {
        console.log("EVALDAS - BUFFER RESULTS WORKER POOL")
        // For smaller exports, use the worker pool with buffer storage
        console.log(`[ExportService] Standard export (est. ${estimatedSize} bytes), using worker pool`);
        
        // Process the export in a worker thread
        const result = await workerPool.runTask('exportTasks', {
          format: job.format,
          filters: job.filters,
          jobId: job._id.toString()
        });
        
        // Update job with the result from worker
        const { totalCount, result: fileContent, filename, format } = result;
        console.log(`[ExportService] Worker returned format: ${format}, filename: ${filename}`);
        
        // Convert result to buffer if it's a string
        const resultBuffer = typeof fileContent === 'string' 
          ? Buffer.from(fileContent, 'utf-8') 
          : fileContent;
        
        // Complete the job
        job.status = 'completed';
        job.progress = 100;
        job.totalItems = totalCount;
        job.processedItems = totalCount;
        job.result = resultBuffer;
        job.filename = filename;
        job.storageType = 'buffer';
        job.fileSize = resultBuffer.length;
        await job.save();
        
        // Cache the result for future identical exports
        await this.cacheBufferResult(cacheKey, totalCount, resultBuffer, filename);
        
        // Job completion is handled by database state - no events needed
        
        // Complete the job in the queue
        callback({
          success: true,
          data: {
            jobId,
            status: 'completed',
            progress: 100,
            filename
          }
        });
      }
    } catch (error) {
      console.error('[ExportService] Error processing export job:', error);
      // Update job status to failed
      try {
        const job = await ExportJob.findById(jobId);
        if (job) {
          await job.fail(error);
        }
      } catch (dbError) {
        // Error handling for DB update failure
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

  /**
   * Create a new export job for background processing
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format ('csv' or 'json')
   * @param {Object} params.filters - Filter parameters
   * @param {string} [params.clientId] - Client socket ID for tracking
   * @returns {Promise<Object>} Created export job
   */
  async createExportJob(params) {
    // Normalize the format to lowercase and validate
    const format = (params.format || 'csv').toLowerCase();
    // Ensure format is one of the allowed values
    const validatedFormat = format === 'json' ? 'json' : 'csv';
    
    const { filters, clientId } = params;
    
    // Build query to get export size
    const query = streamExportService.buildQueryFromFilters(filters);
    
    // Get count of documents which match the query
    const totalCount = await Task.countDocuments(query);
    
    // Create the export job - all exports now use background processing
    const exportJob = new ExportJob({
      format: validatedFormat,
      filters,
      clientId,
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
   * Estimate the size of an export based on item count and format
   * @param {number} count - Number of items
   * @param {string} format - Export format
   * @returns {number} Estimated size in bytes
   */
  estimateExportSize(count, format) {
    // Average size per task in bytes (empirical estimates)
    const avgSizePerTask = format === 'json' ? 500 : 250;
    
    // Add overhead for format-specific wrappers
    const overhead = format === 'json' ? 50 : 100;
    
    return (count * avgSizePerTask) + overhead;
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
   * Cache export buffer result for future use
   * @private
   * @param {string} cacheKey - Cache key
   * @param {number} totalCount - Total items count
   * @param {Buffer} result - Export result buffer
   * @param {string} filename - Export filename
   * @returns {Promise<void>}
   */
  async cacheBufferResult(cacheKey, totalCount, result, filename) {
    try {
      const cacheTTL = this.getCacheTTL(totalCount);
      
      const cacheData = {
        totalItems: totalCount,
        result: result.toString('base64'),
        filename: filename,
        storageType: 'buffer'
      };
      
      await redisClient.setex(cacheKey, cacheTTL, JSON.stringify(cacheData));
    } catch (cacheError) {
      console.error('[ExportService] Error caching buffer result:', cacheError);
      // Non-critical operation, continue
    }
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
      // Non-critical operation, continue
    }
  }

  /**
   * Invalidate export cache for a specific format and filters
   * @param {Object} params - Export parameters
   * @returns {Promise<void>}
   */
  async invalidateExportCache(params) {
    try {
      const cacheKey = this.generateCacheKey(params);
      const cachedData = await redisClient.get(cacheKey);
      
      // If we have cached temp file data, delete the temp file
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
      }
      
      // Delete the cache entry
      await redisClient.del(cacheKey);
    } catch (error) {
      console.error('[ExportService] Error invalidating cache:', error);
      // Non-critical operation, continue
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
      
      // Determine how to serve the export based on storage type
      if (job.storageType === 'buffer' && job.result) {
        // Serve from buffer
        let contentType, filename;
        
        if (job.format === 'json') {
          contentType = 'application/json';
          filename = job.filename || `tasks_export_${new Date().toISOString().split('T')[0]}.json`;
        } else {
          contentType = 'text/csv';
          filename = job.filename || `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(job.result);
        return true;
      } else if (job.storageType === 'tempFile' && job.tempFilePath) {
        // Serve from temp file
        if (!fs.existsSync(job.tempFilePath)) {
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
      } else if (job.storageType === 'stream') {
        // Recreate the stream from the original query
        const query = streamExportService.buildQueryFromFilters(job.filters);
        const sort = streamExportService.buildSortFromFilters(job.filters);
        
        // Count total items to ensure accurate progress tracking
        const totalCount = await Task.countDocuments(query);
        const displayCount = Math.max(totalCount, 1);
        
        // Progress callback for stream recreation
        const progressCallback = (progress, processedItems, totalItems) => {
          // Update progress through JobStateManager if available
          if (this.jobStateManager && progress === 100) {
            this.jobStateManager.updateProgress(
              job._id.toString(),
              progress,
              processedItems,
              totalItems,
              'export-restream-progress'
            ).catch(error => {
              console.error('[ExportService] Error updating progress:', error);
            });
          }
        };
        
        // Stream to response
        await streamExportService.streamToResponse(
          res, query, sort, job.format, progressCallback
        );
        
        return true;
      } else {
        throw new Error('Export data not available');
      }
    } catch (error) {
      console.error('[ExportService] Error streaming export:', error);
      throw error;
    }
  }

  /**
   * Pause an export job (only handles worker signaling, state managed by JobStateManager)
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Export job
   */
  async pauseExportJob(jobId) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }
    
    if (job.status === 'processing') {
      // Signal the worker to pause - all jobs are now background jobs
      try {
        console.log(`[ExportService] Signaling worker to pause job ${jobId}`);
        await workerPool.controlWorker(jobId, 'pause');
      } catch (error) {
        console.error(`[ExportService] Error controlling worker for job ${jobId}:`, error);
        // Worker signaling failed but state will be updated by JobStateManager
      }
    }
    
    return job;
  }

  /**
   * Resume an export job (only handles worker signaling and queue management, state managed by JobStateManager)
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Export job
   */
  async resumeExportJob(jobId) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }
    
    if (job.status === 'paused') {
      // Try to signal the worker directly first - all jobs are now background jobs
      try {
        console.log(`[ExportService] Signaling worker to resume job ${jobId}`);
        const controlResult = await workerPool.controlWorker(jobId, 'resume');
        
        if (controlResult) {
          console.log(`[ExportService] Worker successfully resumed for job ${jobId}`);
          // If worker was successfully signaled, we don't need to re-queue
          return job;
        } else {
          console.warn(`[ExportService] Worker control failed for job ${jobId}, will try re-queueing`);
        }
      } catch (error) {
        console.error(`[ExportService] Error controlling worker for job ${jobId}:`, error);
        // Continue to re-queue as fallback
      }
      
      // If direct worker signaling failed, re-add the job to the queue
      console.log(`[ExportService] Re-queueing paused job ${jobId}`);
      await jobQueue.addJob(
        job._id.toString(),
        'exportTasks',
        {
          format: job.format,
          filters: job.filters,
          clientId: job.clientId
        },
        { priority: 10 } // Higher priority for resumed jobs
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
    
    if (job.status === 'processing' || job.status === 'paused') {
      // Signal the worker to cancel - all jobs are now background jobs
      try {
        console.log(`[ExportService] Signaling worker to cancel job ${jobId}`);
        const controlResult = await workerPool.controlWorker(jobId, 'cancel');
        
        if (controlResult) {
          console.log(`[ExportService] Worker successfully cancelled for job ${jobId}`);
        } else {
          console.warn(`[ExportService] Worker control failed for job ${jobId}, but state will be updated by JobStateManager`);
        }
      } catch (error) {
        console.error(`[ExportService] Error controlling worker for job ${jobId}:`, error);
        // Worker signaling failed but state will be updated by JobStateManager
      }
      
      // Remove job from queue if it exists there
      try {
        await jobQueue.removeJob(jobId);
      } catch (error) {
        console.error(`[ExportService] Error removing job ${jobId} from queue:`, error);
        // Non-critical operation, continue
      }
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
   * Get export jobs for a client
   * @param {string} clientId - Client socket ID
   * @returns {Promise<Array>} Export jobs
   */
  async getClientExportJobs(clientId) {
    return ExportJob.find({ clientId }).sort({ createdAt: -1 });
  }

  /**
   * Get download data for a completed export job
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Export data with content and filename
   */
  async getExportDownload(jobId) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }
    
    if (job.status !== 'completed') {
      throw new Error('Export is not completed yet');
    }
    
    // Use a simple filename generation with correct extension
    const filename = job.filename || `tasks_export_${new Date().toISOString().split('T')[0]}.${job.format}`;
    
    if (job.storageType === 'buffer' && job.result) {
      return {
        content: job.result,
        filename: filename,
        format: job.format,
        storageType: 'buffer'
      };
    } else if (job.storageType === 'tempFile' && job.tempFilePath) {
      return {
        tempFilePath: job.tempFilePath,
        filename: filename,
        format: job.format,
        fileSize: job.fileSize,
        storageType: 'tempFile'
      };
    } else if (job.storageType === 'stream') {
      return {
        filters: job.filters,
        filename: filename,
        format: job.format,
        storageType: 'stream'
      };
    } else {
      throw new Error('Export data not available');
    }
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