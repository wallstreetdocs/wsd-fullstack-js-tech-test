/**
 * @fileoverview Export service for background task exports
 * @module services/exportService
 */

import { EventEmitter } from 'events';
import Task from '../models/Task.js';
import ExportJob from '../models/ExportJob.js';
import { redisClient } from '../config/redis.js';
import jobQueue from './jobQueue.js';
import workerPool from './workerPool.js';
import crypto from 'crypto';

class ExportService extends EventEmitter {
  constructor() {
    super();
    this.initializeJobProcessing();
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

    jobQueue.on('job-completed', ({ id, data }) => {
      // Job completed, events will handle notifications
    });

    jobQueue.on('job-failed', ({ id, error }) => {
      // Job failed, events will handle error notifications
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
        
        // Update job progress in queue
        await jobQueue.updateJobProgress(jobId, progress, {
          processedItems,
          totalItems
        });
        
      } else {
        // Job not found - might have been deleted
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
      
      if (cachedResult) {
        const cachedData = JSON.parse(cachedResult);
        
        // Send a progress update first to show it's working
        this.emit('task-progress', {
          jobId: job._id.toString(),
          progress: 50,
          processedItems: Math.floor(cachedData.totalItems / 2),
          totalItems: cachedData.totalItems
        });
        
        // Small delay to ensure updates are seen
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update job with cached result
        job.status = 'completed';
        job.progress = 100;
        job.totalItems = cachedData.totalItems;
        job.processedItems = cachedData.totalItems;
        job.result = Buffer.from(cachedData.result, 'base64');
        job.filename = cachedData.filename;
        await job.save();
        
        // Send final progress update
        this.emit('task-progress', {
          jobId: job._id.toString(),
          progress: 100,
          processedItems: cachedData.totalItems,
          totalItems: cachedData.totalItems
        });
        
        // Emit completion event via the job queue for real-time updates
        jobQueue.emit('job-completed', { 
          id: job._id.toString(), 
          data: { 
            filename: cachedData.filename, 
            format: job.format 
          } 
        });
        
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
      
      // Process the export in a worker thread
      const result = await workerPool.runTask('exportTasks', {
        format: job.format,
        filters: job.filters,
        jobId: job._id.toString()
      });
      
      // Update job with the result from worker
      const { totalCount, result: fileContent, filename } = result;
      
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
      await job.save();
      
      // Cache the result for future identical exports
      await this.cacheExportResult(cacheKey, totalCount, resultBuffer, filename);
      
      // Emit completion event via the job queue for real-time updates
      jobQueue.emit('job-completed', { 
        id: job._id.toString(), 
        data: { 
          filename, 
          format: job.format 
        } 
      });
      
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
    } catch (error) {
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
   * Create a new export job
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format ('csv' or 'json')
   * @param {Object} params.filters - Filter parameters
   * @param {string} [params.clientId] - Client socket ID for tracking
   * @returns {Promise<Object>} Created export job
   */
  async createExportJob(params) {
    const { format, filters, clientId } = params;
    
    // Create a new export job
    const exportJob = new ExportJob({
      format,
      filters,
      clientId,
      status: 'pending'
    });
    
    await exportJob.save();
    
    // Add job to the queue
    await jobQueue.addJob(
      exportJob._id.toString(),
      'exportTasks',
      {
        format,
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
    // 1 hour for standard exports, 24 hours for large exports
    return totalItems > 1000 ? 86400 : 3600;
  }

  /**
   * Cache export result for future use
   * @private
   * @param {string} cacheKey - Cache key
   * @param {number} totalCount - Total items count
   * @param {Buffer} result - Export result buffer
   * @param {string} filename - Export filename
   * @returns {Promise<void>}
   */
  async cacheExportResult(cacheKey, totalCount, result, filename) {
    try {
      const cacheTTL = this.getCacheTTL(totalCount);
      
      const cacheData = {
        totalItems: totalCount,
        result: result.toString('base64'), // Store buffer as base64 string
        filename: filename
      };
      
      await redisClient.setex(cacheKey, cacheTTL, JSON.stringify(cacheData));
    } catch (cacheError) {
      // Log but don't fail if caching fails - non-critical operation
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
      await redisClient.del(cacheKey);
    } catch (error) {
      // Error handling for cache invalidation - non-critical
    }
  }

  /**
   * Pause an export job
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Updated export job
   */
  async pauseExportJob(jobId) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }
    
    if (job.status === 'processing') {
      await job.pause();
      
      // Pause the job in the queue (for future processing)
      // In a real implementation, we'd need to signal the worker to pause
      // For now, the job will continue processing but won't update the DB
    }
    
    return job;
  }

  /**
   * Resume an export job
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Resumed export job
   */
  async resumeExportJob(jobId) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }
    
    if (job.status === 'paused') {
      await job.resume();
      
      // Re-add the job to the queue
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
    
    return {
      content: job.result,
      filename: job.filename,
      format: job.format
    };
  }

  /**
   * Get recent export jobs with pagination
   * @param {number} [page=1] - Page number
   * @param {number} [limit=10] - Items per page
   * @returns {Promise<Object>} Paginated export jobs
   */
  async getExportHistory(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const jobs = await ExportJob.find()
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