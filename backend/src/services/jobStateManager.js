/**
 * @fileoverview Centralized state management for export jobs
 * @module services/jobStateManager
 */

import ExportJob from '../models/ExportJob.js';

/**
 * Simplified manager for export job state broadcasts
 * Single responsibility: broadcast job status to connected clients
 */
class JobStateManager {
  constructor(io) {
    this.io = io;
  }

  /**
   * Broadcast job status to all connected clients
   * @param {Object} job - Export job object
   * @param {string} source - Source of the update
   */
  broadcastJobStatus(job, source = 'unknown') {
    if (!job) return;
    
    console.log(`[JobStateManager] Broadcasting job status: ${job._id}, status=${job.status}, source=${source}`);
    
    // Create single status event with all needed data
    const statusEvent = {
      jobId: job._id.toString(),
      status: job.status,
      progress: job.progress || 0,
      processedItems: job.processedItems || 0,
      totalItems: job.totalItems || 0,
      filename: job.filename,
      error: job.error
    };
    
    // Single broadcast event for all status updates
    this.io.emit('export:status', statusEvent);
    
    // Additional completion event for backward compatibility
    if (job.status === 'completed') {
      this.io.emit('export:completed', {
        jobId: job._id.toString(),
        filename: job.filename,
        totalItems: job.totalItems || job.processedItems || 0
      });
    }
  }



  /**
   * Broadcast job progress update
   * @param {string} jobId - Export job ID
   * @param {number} progress - Progress percentage
   * @param {number} processedItems - Processed items count
   * @param {number} totalItems - Total items count
   * @param {string} source - Source of the update
   */
  async updateProgress(jobId, progress, processedItems, totalItems, source = 'worker') {
    const job = await ExportJob.findById(jobId);
    if (job) {
      // Update job in database
      job.status = 'processing';
      job.progress = Math.min(100, Math.max(0, progress));
      job.processedItems = Math.max(0, processedItems);
      job.totalItems = Math.max(0, totalItems);
      job.updatedAt = new Date();
      await job.save();
      
      // Broadcast the updated status
      this.broadcastJobStatus(job, source);
    }
  }

  /**
   * Pause a job and broadcast status
   * @param {string} jobId - Export job ID
   * @param {string} source - Source of the update
   */
  async pauseJob(jobId, source = 'user') {
    const job = await ExportJob.findById(jobId);
    if (job) {
      job.status = 'paused';
      job.updatedAt = new Date();
      await job.save();
      this.broadcastJobStatus(job, source);
    }
  }

  /**
   * Mark job as paused with progress information
   * @param {string} jobId - Export job ID
   * @param {Object} progress - Progress information
   * @param {string} source - Source of the update
   */
  async pauseJobWithProgress(jobId, progress, source = 'worker') {
    const job = await ExportJob.findById(jobId);
    if (job) {
      job.status = 'paused';
      job.processedItems = progress.processedItems || job.processedItems;
      job.lastProcessedId = progress.lastProcessedId || job.lastProcessedId;
      job.updatedAt = new Date();
      await job.save();
      this.broadcastJobStatus(job, source);
    }
  }

  /**
   * Resume a job and broadcast status
   * @param {string} jobId - Export job ID  
   * @param {string} source - Source of the update
   */
  async resumeJob(jobId, source = 'user') {
    const job = await ExportJob.findById(jobId);
    if (job) {
      job.status = 'processing';
      job.updatedAt = new Date();
      await job.save();
      this.broadcastJobStatus(job, source);
    }
  }

  /**
   * Cancel a job and broadcast status
   * @param {string} jobId - Export job ID
   * @param {string} source - Source of the update
   */
  async cancelJob(jobId, source = 'user') {
    const job = await ExportJob.findById(jobId);
    if (job) {
      job.status = 'cancelled';
      job.updatedAt = new Date();
      await job.save();
      this.broadcastJobStatus(job, source);
    }
  }

  /**
   * Complete a job and broadcast status
   * @param {string} jobId - Export job ID
   * @param {string} filename - Generated filename
   * @param {number} totalItems - Final item count
   * @param {string} source - Source of the update
   */
  async completeJob(jobId, filename, totalItems, source = 'worker') {
    const job = await ExportJob.findById(jobId);
    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.processedItems = totalItems;
      job.totalItems = totalItems;
      job.filename = filename;
      job.updatedAt = new Date();
      await job.save();
      this.broadcastJobStatus(job, source);
    }
  }

  /**
   * Fail a job and broadcast status
   * @param {string} jobId - Export job ID
   * @param {string} error - Error message
   * @param {string} source - Source of the update
   */
  async failJob(jobId, error, source = 'worker') {
    const job = await ExportJob.findById(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.updatedAt = new Date();
      await job.save();
      this.broadcastJobStatus(job, source);
    }
  }
}

export default JobStateManager;