/**
 * @fileoverview Centralized state management for export jobs
 * @module services/jobStateManager
 */

import ExportJob from '../models/ExportJob.js';

/**
 * Centralized manager for export job state updates
 * Ensures consistency and prevents race conditions
 */
class JobStateManager {
  constructor(io) {
    this.io = io;
    this.updateQueues = new Map(); // Queue system for job updates
    this.processingJobs = new Set(); // Track jobs currently being processed
    this.retryQueues = new Map(); // Retry queue for failed updates
    this.maxRetries = 3; // Maximum retry attempts
    this.baseRetryDelay = 1000; // Base retry delay in ms
  }

  /**
   * Queue an update for processing - ensures all updates are processed sequentially
   * @param {string} jobId - Export job ID
   * @param {Object} stateUpdate - State update object
   * @param {string} source - Source of the update
   * @returns {Promise<Object>} Updated job object
   */
  async updateJobState(jobId, stateUpdate, source = 'unknown') {
    return new Promise((resolve, reject) => {
      // Get or create queue for this job
      if (!this.updateQueues.has(jobId)) {
        this.updateQueues.set(jobId, []);
      }
      
      const queue = this.updateQueues.get(jobId);
      
      // Add update to queue
      queue.push({ stateUpdate, source, resolve, reject });
      
      // Process queue if not already processing
      if (!this.processingJobs.has(jobId)) {
        this.processUpdateQueue(jobId);
      }
    });
  }

  /**
   * Process all updates in queue for a specific job
   * @param {string} jobId - Export job ID
   */
  async processUpdateQueue(jobId) {
    this.processingJobs.add(jobId);
    
    try {
      const queue = this.updateQueues.get(jobId);
      if (!queue || queue.length === 0) {
        return;
      }
      
      while (queue.length > 0) {
        const { stateUpdate, source, resolve, reject, retryCount = 0 } = queue.shift();
        
        try {
          const result = await this.processStateUpdate(jobId, stateUpdate, source);
          resolve(result);
        } catch (error) {
          // Retry critical completion updates
          if (stateUpdate.status === 'completed' && retryCount < this.maxRetries) {
            console.log(`[JobStateManager] Retrying completion update for job ${jobId}, attempt ${retryCount + 1}/${this.maxRetries}`);
            
            const retryDelay = this.baseRetryDelay * Math.pow(2, retryCount); // Exponential backoff
            setTimeout(() => {
              // Add back to queue with incremented retry count
              queue.unshift({ stateUpdate, source, resolve, reject, retryCount: retryCount + 1 });
              if (!this.processingJobs.has(jobId)) {
                this.processUpdateQueue(jobId);
              }
            }, retryDelay);
            
            break; // Exit the current processing loop to allow retry
          } else {
            console.error(`[JobStateManager] Final failure for job ${jobId} after ${retryCount} retries:`, error);
            reject(error);
          }
        }
      }
    } finally {
      this.processingJobs.delete(jobId);
      // Clean up empty queue
      if (this.updateQueues.has(jobId) && this.updateQueues.get(jobId).length === 0) {
        this.updateQueues.delete(jobId);
      }
    }
  }

  /**
   * Actually process a single state update
   * @param {string} jobId - Export job ID
   * @param {Object} stateUpdate - State update object
   * @param {string} source - Source of the update
   * @returns {Promise<Object>} Updated job object
   */
  async processStateUpdate(jobId, stateUpdate, source) {
    try {
      // Get the job from database
      const job = await ExportJob.findById(jobId);
      if (!job) {
        console.error(`[JobStateManager] Job ${jobId} not found`);
        return null;
      }

      // Track what changed for logging
      const changes = [];
      
      // Update job fields atomically
      if (stateUpdate.status && stateUpdate.status !== job.status) {
        job.status = stateUpdate.status;
        changes.push(`status: ${job.status}`);
      }
      
      if (typeof stateUpdate.progress === 'number' && stateUpdate.progress !== job.progress) {
        job.progress = Math.min(100, Math.max(0, stateUpdate.progress));
        changes.push(`progress: ${job.progress}%`);
      }
      
      if (typeof stateUpdate.processedItems === 'number' && stateUpdate.processedItems !== job.processedItems) {
        job.processedItems = Math.max(0, stateUpdate.processedItems);
        changes.push(`processedItems: ${job.processedItems}`);
      }
      
      if (typeof stateUpdate.totalItems === 'number' && stateUpdate.totalItems !== job.totalItems) {
        job.totalItems = Math.max(0, stateUpdate.totalItems);
        changes.push(`totalItems: ${job.totalItems}`);
      }
      
      if (stateUpdate.filename && stateUpdate.filename !== job.filename) {
        job.filename = stateUpdate.filename;
        changes.push(`filename: ${job.filename}`);
      }
      
      if (stateUpdate.error && stateUpdate.error !== job.error) {
        job.error = stateUpdate.error;
        changes.push(`error: ${job.error}`);
      }

      // Update timestamp
      job.updatedAt = new Date();
      
      // Save to database
      await job.save();
      
      // Log the update
      if (changes.length > 0) {
        console.log(`[JobStateManager] Updated job ${jobId} from ${source}: ${changes.join(', ')}`);
      }
      
      // Create consistent progress event
      const progressEvent = {
        jobId: job._id.toString(),
        status: job.status,
        progress: job.progress || 0,
        processedItems: job.processedItems || 0,
        totalItems: job.totalItems || 0
      };
      
      // Add completion-specific fields
      if (job.status === 'completed' && job.filename) {
        progressEvent.filename = job.filename;
      }
      
      // Add error-specific fields
      if (job.status === 'failed' && job.error) {
        progressEvent.error = job.error;
      }
      
      // Broadcast to all clients - single event type for consistency
      this.io.emit('export:progress', progressEvent);
      console.log(`[JobStateManager] Broadcast progress event: ${JSON.stringify(progressEvent)}`);
      
      // Send specific completion event for completed jobs
      if (job.status === 'completed') {
        const completionEvent = {
          jobId: job._id.toString(),
          filename: job.filename,
          totalItems: job.totalItems || job.processedItems || 0
        };
        
        this.io.emit('export:completed', completionEvent);
        console.log(`[JobStateManager] Broadcast completion event: ${JSON.stringify(completionEvent)}`);
      }
      
      // Send specific failure event for failed jobs  
      if (job.status === 'failed') {
        const failureEvent = {
          jobId: job._id.toString(),
          error: job.error || 'Unknown error'
        };
        
        this.io.emit('export:failed', failureEvent);
        console.log(`[JobStateManager] Broadcast failure event: ${JSON.stringify(failureEvent)}`);
      }
      
      // Send specific cancellation event for cancelled jobs
      if (job.status === 'cancelled') {
        const cancellationEvent = {
          jobId: job._id.toString()
        };
        
        this.io.emit('export:cancelled', cancellationEvent);
        console.log(`[JobStateManager] Broadcast cancellation event: ${JSON.stringify(cancellationEvent)}`);
      }
      
      return job;
    } catch (error) {
      console.error(`[JobStateManager] Error updating job ${jobId} from ${source}:`, error);
      throw error;
    }
  }

  /**
   * Convenience method for updating progress
   * @param {string} jobId - Export job ID
   * @param {number} progress - Progress percentage
   * @param {number} processedItems - Processed items count
   * @param {number} totalItems - Total items count
   * @param {string} source - Source of the update
   * @returns {Promise<Object>} Updated job
   */
  async updateProgress(jobId, progress, processedItems, totalItems, source = 'worker') {
    return this.updateJobState(jobId, {
      status: 'processing',
      progress,
      processedItems,
      totalItems
    }, source);
  }

  /**
   * Convenience method for pausing a job
   * @param {string} jobId - Export job ID
   * @param {string} source - Source of the update
   * @returns {Promise<Object>} Updated job
   */
  async pauseJob(jobId, source = 'user') {
    return this.updateJobState(jobId, {
      status: 'paused'
    }, source);
  }

  /**
   * Convenience method for resuming a job
   * @param {string} jobId - Export job ID  
   * @param {string} source - Source of the update
   * @returns {Promise<Object>} Updated job
   */
  async resumeJob(jobId, source = 'user') {
    return this.updateJobState(jobId, {
      status: 'processing'
    }, source);
  }

  /**
   * Convenience method for cancelling a job
   * @param {string} jobId - Export job ID
   * @param {string} source - Source of the update
   * @returns {Promise<Object>} Updated job
   */
  async cancelJob(jobId, source = 'user') {
    return this.updateJobState(jobId, {
      status: 'cancelled'
    }, source);
  }

  /**
   * Convenience method for completing a job
   * @param {string} jobId - Export job ID
   * @param {string} filename - Generated filename
   * @param {number} totalItems - Final item count
   * @param {string} source - Source of the update
   * @returns {Promise<Object>} Updated job
   */
  async completeJob(jobId, filename, totalItems, source = 'worker') {
    return this.updateJobState(jobId, {
      status: 'completed',
      progress: 100,
      processedItems: totalItems,
      totalItems: totalItems,
      filename: filename
    }, source);
  }

  /**
   * Convenience method for failing a job
   * @param {string} jobId - Export job ID
   * @param {string} error - Error message
   * @param {string} source - Source of the update
   * @returns {Promise<Object>} Updated job
   */
  async failJob(jobId, error, source = 'worker') {
    return this.updateJobState(jobId, {
      status: 'failed',
      error: error
    }, source);
  }
}

export default JobStateManager;