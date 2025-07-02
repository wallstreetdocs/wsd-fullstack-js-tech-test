/**
 * @fileoverview Job queue system for managing background tasks
 * @module services/jobQueue
 */

import { EventEmitter } from 'events';
import { redisClient } from '../config/redis.js';
import ExportJob from '../models/ExportJob.js';

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

      // get and zrem essentially, so works like a lock
      const popped = await redisClient.zpopmin(this.queueName);

      if (!popped || popped.length < 2) {
        // No jobs in queue
        setTimeout(() => this.processNextJob(), 1000);
        return;
      }

      const jobId = popped[0]; // popped = [jobId, score]

      // Get job details
      const jobDetails = await redisClient.hgetall(`${this.jobStatusPrefix}${jobId}`);

      if (!jobDetails) {
        this.processNextJob();
        return;
      }

      // Parse job data
      let jobData;
      try {
        jobData = JSON.parse(jobDetails.data);
      } catch (error) {
        await redisClient.del(`${this.jobStatusPrefix}${jobId}`);
        // Continue processing
        this.processNextJob();
        return;
      }

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
      const { success, error, data, paused, progress, cancelled } = result;

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
      } else if (paused) {
        // Update job status to 'paused'
        await redisClient.hset(`${this.jobStatusPrefix}${jobId}`, {
          status: 'paused',
          pausedAt: Date.now(),
          progress: JSON.stringify(progress || {})
        });

        // Emit paused event
        this.emit('job-paused', { id: jobId, progress });
      } else if (cancelled) {
        // Update job status to 'cancelled'
        await redisClient.hset(`${this.jobStatusPrefix}${jobId}`, {
          status: 'cancelled',
          cancelledAt: Date.now(),
          error: error?.message || 'Export cancelled'
        });

        // Emit cancelled event
        this.emit('job-cancelled', { id: jobId, error });
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
  
    let recoveredCount = 0;
    let cleanedCount = 0;
    let cursor = '0';

    try {
      // Use SCAN instead of KEYS for non-blocking iteration - return in batches of 100
      do {
        const result = await redisClient.scan(cursor, 'MATCH', `${this.jobStatusPrefix}*`, 'COUNT', 100);

        cursor = result[0];
        const keys = result[1];

        for (const key of keys) {
          try {
            const wasRecovered = await this.recoverSingleJob(key);
            if (wasRecovered === 'recovered') {
              recoveredCount++;
            } else if (wasRecovered === 'cleaned') {
              cleanedCount++;
            }
          } catch (error) {
            console.error(`Failed to recover job ${key}:`, error.message);
          }
        }
      } while (cursor !== '0'); // scan until updated cursor is 0 meaning entire keyspace is scanned
    } catch (error) {
      console.error('Critical error in job recovery process:', error.message);
    }
  }

  /**
   * Recover a single job atomically using Redis transaction
   * @private
   * @param {string} key - Redis key for the job status
   * @returns {Promise<void>}
   */
  async recoverSingleJob(key) {
    const multi = redisClient.multi();

    // Get current job status
    const jobStatus = await redisClient.hgetall(key);

    // Only recover jobs in processing state
    if (!jobStatus || jobStatus.status !== 'processing') {
      return;
    }

    const jobId = key.replace(this.jobStatusPrefix, '');

    // Check MongoDB first - don't recover if already completed there
    try {
      const existingJob = await ExportJob.findById(jobId);
      if (existingJob && ['completed', 'failed', 'cancelled'].includes(existingJob.status)) {
        // Job is already finished in MongoDB, just clean up Redis
        await redisClient.del(key);
        return 'cleaned';
      }
    } catch (error) {
      console.warn(`Could not check MongoDB status for job ${jobId}:`, error.message);
    }

    const timestamp = Date.now();

    const priority = parseInt(jobStatus.priority || '0');
    const score = priority * 10000000000 + timestamp;

    // Atomic recovery: update status and re-add to queue
    multi.hset(key, {
      status: 'pending',
      recoveredAt: timestamp,
      updatedAt: timestamp
    });
    multi.zadd(this.queueName, score, jobId);

    await multi.exec();
    return 'recovered';
  }

  /**
   * Remove a job from the queue
   * @param {string} jobId - Job ID to remove
   * @returns {Promise<boolean>} True if job was removed, false if not found
   */
  async removeJob(jobId) {
    try {
      // Remove from active jobs if currently processing
      this.activeJobs.delete(jobId);

      // Remove from sorted set queue and job status in a transaction
      const multi = redisClient.multi();
      multi.zrem(this.queueName, jobId);
      multi.del(`${this.jobStatusPrefix}${jobId}`);
      
      const results = await multi.exec();
      
      // Check if job was actually removed from the queue (first operation result)
      const removedFromQueue = results && results[0] && results[0][1] > 0;
      
      return removedFromQueue;
    } catch (error) {
      return false;
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
