/**
 * @fileoverview Export service for background task exports
 * @module services/exportService
 */

import Task from '../models/Task.js';
import ExportJob from '../models/ExportJob.js';
import { redisClient } from '../config/redis.js';
import fileGeneratorService from './fileGeneratorService.js';
import crypto from 'crypto';

class ExportService {
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
   * Process an export job in the background
   * @param {Object} job - Export job object
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<Object>} Completed export job
   */
  async processExportJob(job, progressCallback) {
    try {
      console.log(`Starting export job processing: ${job._id}, format: ${job.format}`);
      
      // Update job status to processing
      job.status = 'processing';
      await job.save();
      
      // Fetch the job again to ensure we have the latest state
      job = await ExportJob.findById(job._id);
      
      // Notify of job start
      if (progressCallback) {
        progressCallback(job);
      }
      
      // Check cache first
      const cacheKey = this.generateCacheKey(job);
      console.log(`🔍 Checking cache with key: ${cacheKey}`);
      const cachedResult = await redisClient.get(cacheKey);
      
      if (cachedResult) {
        console.log(`🎯 CACHE HIT! Using cached export result for job ${job._id}`);
        const cachedData = JSON.parse(cachedResult);
        
        // Update job with cached result
        job.status = 'completed';
        job.progress = 100;
        job.totalItems = cachedData.totalItems;
        job.processedItems = cachedData.totalItems;
        job.result = Buffer.from(cachedData.result, 'base64');
        job.filename = cachedData.filename;
        await job.save();
        
        // Send final progress update
        if (progressCallback) {
          const completedJob = await ExportJob.findById(job._id);
          progressCallback(completedJob);
        }
        
        return job;
      }
      
      // Prepare database query from filters
      const query = this.buildQueryFromFilters(job.filters);
      
      // Set up sorting
      const sort = {};
      sort[job.filters.sortBy || 'createdAt'] = job.filters.sortOrder === 'desc' ? -1 : 1;
      
      // Get total count for progress tracking
      const totalCount = await Task.countDocuments(query);
      job.totalItems = totalCount;
      await job.save();
      
      console.log(`Export job ${job._id} found ${totalCount} tasks to process`);
      
      // Get all tasks matching the query
      const tasks = await Task.find(query).sort(sort).exec();
      
      // Process in chunks to update progress
      const chunkSize = Math.max(Math.floor(tasks.length / 10), 1); // Update progress ~10 times
      
      // Process tasks in chunks with progress tracking
      const processedTasks = await this.processTasksInChunks(
        tasks, 
        chunkSize, 
        job, 
        progressCallback
      );
      
      // If processing was interrupted (e.g., paused), return the job as is
      if (job.status === 'paused') {
        return job;
      }
      
      // Generate the file using the dedicated file generator service
      const { result, filename } = fileGeneratorService.generateFile(processedTasks, job.format);
      
      // Complete the job
      job.status = 'completed';
      job.progress = 100;
      job.result = result;
      job.filename = filename;
      await job.save();
      
      // Cache the result for future identical exports
      await this.cacheExportResult(cacheKey, totalCount, result, filename);
      
      console.log(`Export job ${job._id} completed successfully, file: ${filename}`);
      
      // Final progress update
      if (progressCallback) {
        // Get a fresh copy for the final update
        const completedJob = await ExportJob.findById(job._id);
        progressCallback(completedJob);
      }
      
      return job;
    } catch (error) {
      console.error('Error processing export job:', error);
      await job.fail(error);
      
      if (progressCallback) {
        progressCallback(job);
      }
      
      throw error;
    }
  }

  /**
   * Build database query from job filters
   * @private
   * @param {Object} filters - Filter parameters
   * @returns {Object} MongoDB query object
   */
  buildQueryFromFilters(filters) {
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
   * Process tasks in chunks with progress tracking
   * @private
   * @param {Array} tasks - Tasks to process
   * @param {number} chunkSize - Size of each chunk
   * @param {Object} job - Export job
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<Array>} Processed tasks
   */
  async processTasksInChunks(tasks, chunkSize, job, progressCallback) {
    const totalCount = tasks.length;
    
    // Process tasks in chunks to update progress
    for (let i = 0; i < tasks.length; i += chunkSize) {
      // Update progress calculation
      const currentProgress = Math.min(i + chunkSize, tasks.length);
      job.processedItems = currentProgress;
      job.totalItems = totalCount;
      job.progress = Math.floor((currentProgress / totalCount) * 100);
      job.status = 'processing'; // Ensure status stays as processing
      await job.save();
      
      console.log(`Export job ${job._id} progress: ${job.progress}% (${currentProgress}/${totalCount})`);
      
      // Send progress update
      if (progressCallback) {
        // Get a fresh copy to ensure we have the latest state
        const updatedJob = await ExportJob.findById(job._id);
        progressCallback(updatedJob);
      }
      
      // Check if job has been paused or cancelled
      const refreshedJob = await ExportJob.findById(job._id);
      if (refreshedJob.status === 'paused') {
        console.log(`Export job ${job._id} was paused, exiting early`);
        job.status = 'paused';
        return tasks.slice(0, i); // Return processed tasks so far
      }
    }
    
    return tasks;
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
      console.log(`💾 Caching export result with key: ${cacheKey}, TTL: ${cacheTTL}s`);
      
      const cacheData = {
        totalItems: totalCount,
        result: result.toString('base64'), // Store buffer as base64 string
        filename: filename
      };
      
      await redisClient.setex(cacheKey, cacheTTL, JSON.stringify(cacheData));
      console.log(`Cached export result for key ${cacheKey} with TTL ${cacheTTL}s`);
    } catch (cacheError) {
      // Log but don't fail if caching fails
      console.error('Error caching export result:', cacheError);
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
      console.log(`🗑️ Invalidated export cache for key ${cacheKey}`);
    } catch (error) {
      console.error('Error invalidating export cache:', error);
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
    }
    
    return job;
  }

  /**
   * Resume an export job
   * @param {string} jobId - Export job ID
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<Object>} Resumed export job
   */
  async resumeExportJob(jobId, progressCallback) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }
    
    if (job.status === 'paused') {
      await job.resume();
      return this.processExportJob(job, progressCallback);
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