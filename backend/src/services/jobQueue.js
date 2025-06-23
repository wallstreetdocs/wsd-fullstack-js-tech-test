/**
 * @fileoverview Job queue system for managing background tasks
 * @module services/jobQueue
 */

import { EventEmitter } from 'events';
import { redisClient } from '../config/redis.js';

/**
 * A job queue system for managing background tasks
 * @extends EventEmitter
 */
class JobQueue extends EventEmitter {
  /**
   * Create a new job queue
   * @param {string} [queueName='export-jobs'] - Name of the queue
   */
  constructor(queueName = 'export-jobs') {
    super();
    this.queueName = queueName;
    this.processing = false;
    this.activeJobs = new Map(); // Track active jobs by ID
    this.jobStatusPrefix = `${queueName}:status:`;
    this.concurrentJobLimit = 5; // Max concurrent jobs
    this.initialized = false;
  }

  /**
   * Initialize the job queue
   */
  async initialize() {
    if (this.initialized) return;
    
    // Initialize the job queue system
    
    // Start processing jobs
    this.startProcessing();
    
    // Recover any pending jobs from a previous instance
    await this.recoverPendingJobs();
    
    this.initialized = true;
  }

  /**
   * Add a job to the queue
   * @param {string} jobId - Unique job identifier
   * @param {string} jobType - Type of job
   * @param {Object} jobData - Job payload data
   * @param {Object} [options] - Job options
   * @param {number} [options.priority=0] - Priority (higher number = higher priority)
   * @returns {Promise<void>}
   */
  async addJob(jobId, jobType, jobData, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const priority = options.priority || 0;
    const timestamp = Date.now();
    
    const jobInfo = {
      id: jobId,
      type: jobType,
      data: jobData,
      status: 'pending',
      priority,
      addedAt: timestamp,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3
    };
    
    // Store job details in Redis
    await redisClient.hset(
      `${this.jobStatusPrefix}${jobId}`, 
      {
        status: 'pending',
        progress: 0,
        addedAt: timestamp,
        priority,
        type: jobType,
        data: JSON.stringify(jobData)
      }
    );
    
    // Add to sorted set with priority and timestamp as score
    // Using compound score: priority * 10000000000 + timestamp
    // This ensures higher priority jobs come first, and within same priority, older jobs come first
    const score = priority * 10000000000 + timestamp;
    await redisClient.zadd(this.queueName, score, jobId);
    
    // Trigger processing if not already running
    if (!this.processing) {
      this.startProcessing();
    }
  }

  /**
   * Start processing jobs from the queue
   * @private
   */
  startProcessing() {
    if (this.processing) return;
    
    this.processing = true;
    
    // Start the processing loop
    this.processNextJob();
  }

  /**
   * Process the next job in the queue
   * @private
   */
  async processNextJob() {
    if (!this.processing) return;
    
    try {
      // Check if we're at the concurrent job limit
      if (this.activeJobs.size >= this.concurrentJobLimit) {
        // Wait a bit and check again
        setTimeout(() => this.processNextJob(), 500);
        return;
      }
      
      // Get the next job from the queue (without removing it)
      const nextJobs = await redisClient.zrange(this.queueName, 0, 0, 'WITHSCORES');
      
      if (!nextJobs || nextJobs.length === 0) {
        // No jobs in queue, wait and check again
        setTimeout(() => this.processNextJob(), 1000);
        return;
      }
      
      const jobId = nextJobs[0];
      
      // Get job details
      const jobDetails = await redisClient.hgetall(`${this.jobStatusPrefix}${jobId}`);
      
      if (!jobDetails) {
        // Job details not found, remove from queue
        await redisClient.zrem(this.queueName, jobId);
        // Continue processing
        this.processNextJob();
        return;
      }
      
      // Parse job data
      let jobData;
      try {
        jobData = JSON.parse(jobDetails.data);
      } catch (error) {
        // Remove job from queue
        await redisClient.zrem(this.queueName, jobId);
        await redisClient.del(`${this.jobStatusPrefix}${jobId}`);
        // Continue processing
        this.processNextJob();
        return;
      }
      
      // Remove job from queue
      await redisClient.zrem(this.queueName, jobId);
      
      // Update job status to 'processing'
      await redisClient.hset(`${this.jobStatusPrefix}${jobId}`, {
        status: 'processing',
        startedAt: Date.now()
      });
      
      // Add to active jobs
      this.activeJobs.set(jobId, {
        type: jobDetails.type,
        data: jobData
      });
      
      // Emit event for job processor to handle
      this.emit('process-job', {
        id: jobId,
        type: jobDetails.type,
        data: jobData,
        callback: (result) => this.handleJobCompletion(jobId, result)
      });
      
      // Continue processing next job immediately
      this.processNextJob();
    } catch (error) {
      // Wait and try again
      setTimeout(() => this.processNextJob(), 1000);
    }
  }

  /**
   * Handle job completion
   * @param {string} jobId - Job ID
   * @param {Object} result - Job result
   * @private
   */
  async handleJobCompletion(jobId, result) {
    try {
      const { success, error, data } = result;
      
      // Remove from active jobs
      this.activeJobs.delete(jobId);
      
      if (success) {
        // Update job status to 'completed'
        await redisClient.hset(`${this.jobStatusPrefix}${jobId}`, {
          status: 'completed',
          completedAt: Date.now(),
          result: JSON.stringify(data || {})
        });
        
        // Emit completion event
        this.emit('job-completed', { id: jobId, data });
      } else {
        // Update job status to 'failed'
        await redisClient.hset(`${this.jobStatusPrefix}${jobId}`, {
          status: 'failed',
          failedAt: Date.now(),
          error: error?.message || 'Unknown error'
        });
        
        // Emit failure event
        this.emit('job-failed', { id: jobId, error });
      }
      
      // Continue processing if not already doing so
      if (!this.processing) {
        this.startProcessing();
      }
    } catch (err) {
      // Handle error but continue processing
    }
  }

  /**
   * Update job progress
   * @param {string} jobId - Job ID
   * @param {number} progress - Progress percentage (0-100)
   * @param {Object} [data] - Additional progress data
   * @returns {Promise<void>}
   */
  async updateJobProgress(jobId, progress, data = {}) {
    try {
      // Update job status with progress
      await redisClient.hset(`${this.jobStatusPrefix}${jobId}`, {
        progress: Math.min(Math.max(0, progress), 100),
        ...data
      });
      
      // Emit progress event with additional logging
      console.log(`[JobQueue] Emitting progress event for job ${jobId}: ${progress}%`);
      
      // Make sure we include status in the event
      const progressEvent = { 
        id: jobId, 
        progress, 
        status: 'processing',
        ...data 
      };
      
      this.emit('job-progress', progressEvent);
    } catch (error) {
      // Error updating progress, non-critical
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status object
   */
  async getJobStatus(jobId) {
    try {
      const jobStatus = await redisClient.hgetall(`${this.jobStatusPrefix}${jobId}`);
      
      if (!jobStatus) {
        return { id: jobId, status: 'not_found' };
      }
      
      // Parse result if exists
      if (jobStatus.result) {
        try {
          jobStatus.result = JSON.parse(jobStatus.result);
        } catch (e) {
          // If parse fails, keep as string
        }
      }
      
      // Parse data if exists
      if (jobStatus.data) {
        try {
          jobStatus.data = JSON.parse(jobStatus.data);
        } catch (e) {
          // If parse fails, keep as string
        }
      }
      
      return { id: jobId, ...jobStatus };
    } catch (error) {
      return { id: jobId, status: 'error', error: error.message };
    }
  }

  /**
   * Pause job processing
   * @returns {Promise<void>}
   */
  async pause() {
    this.processing = false;
  }

  /**
   * Resume job processing
   * @returns {Promise<void>}
   */
  async resume() {
    if (!this.processing) {
      this.processing = true;
      this.processNextJob();
    }
  }

  /**
   * Recover pending jobs from previous instance
   * @private
   * @returns {Promise<void>}
   */
  async recoverPendingJobs() {
    try {
      // Find all jobs in processing state and reset them to pending
      const keys = await redisClient.keys(`${this.jobStatusPrefix}*`);
      
      for (const key of keys) {
        const jobStatus = await redisClient.hgetall(key);
        
        if (jobStatus && jobStatus.status === 'processing') {
          const jobId = key.replace(this.jobStatusPrefix, '');
          
          // Recover job from previous instance
          
          // Update status to pending
          await redisClient.hset(key, {
            status: 'pending',
            recoveredAt: Date.now()
          });
          
          // Parse job data
          let jobData = {};
          try {
            jobData = JSON.parse(jobStatus.data || '{}');
          } catch (e) {
            // Error parsing job data, continue with empty object
          }
          
          // Re-add to queue
          await this.addJob(jobId, jobStatus.type || 'unknown', jobData, {
            priority: parseInt(jobStatus.priority || '0')
          });
        }
      }
    } catch (error) {
      // Error in job recovery process, non-critical
    }
  }

  /**
   * Clean up completed and failed jobs older than the specified time
   * @param {number} [maxAge=86400000] - Maximum age in milliseconds (default: 24 hours)
   * @returns {Promise<number>} Number of jobs cleaned up
   */
  async cleanup(maxAge = 86400000) {
    try {
      const now = Date.now();
      const keys = await redisClient.keys(`${this.jobStatusPrefix}*`);
      let cleanedCount = 0;
      
      for (const key of keys) {
        const jobStatus = await redisClient.hgetall(key);
        
        if (!jobStatus) continue;
        
        if (['completed', 'failed'].includes(jobStatus.status)) {
          const completedAt = parseInt(jobStatus.completedAt || jobStatus.failedAt || '0');
          
          if (completedAt > 0 && (now - completedAt) > maxAge) {
            const jobId = key.replace(this.jobStatusPrefix, '');
            
            // Remove job status
            await redisClient.del(key);
            
            // Also remove from queue if somehow still there
            await redisClient.zrem(this.queueName, jobId);
            
            cleanedCount++;
          }
        }
      }
      
      // Cleanup complete
      return cleanedCount;
    } catch (error) {
      // Error in cleanup process, non-critical
      return 0;
    }
  }
}

// Create and export a singleton instance
const jobQueue = new JobQueue();
export default jobQueue;