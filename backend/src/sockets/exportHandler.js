/**
 * @fileoverview Socket.IO event handlers for export functionality
 * @module sockets/ExportHandler
 */

import { EventEmitter } from 'events';
import ExportService from '../services/exportService.js';
import jobQueue from '../services/jobQueue.js';
import workerPool from '../services/workerPool.js';
import JobStateManager from '../services/jobStateManager.js';

/**
 * Handles Socket.IO connections and events for export operations
 * @class ExportHandler
 * @extends EventEmitter
 */
class ExportHandler extends EventEmitter {
  /**
   * Creates ExportHandler instance and sets up event listeners
   * @param {Object} io - Socket.IO server instance
   * @param {Function} notificationCallback - Function to broadcast notifications
   * @param {Function} analyticsUpdateCallback - Function to trigger analytics updates
   */
  constructor(io, notificationCallback, analyticsUpdateCallback) {
    super();
    this.io = io;
    this.notificationCallback = notificationCallback;
    this.analyticsUpdateCallback = analyticsUpdateCallback;
    this.jobStateManager = new JobStateManager(io);
    this.setupJobQueueListeners();

    // Simplified event handling - no forwarding needed
  }

  /**
   * Registers socket event handlers for client connection
   * @param {Object} socket - Socket.IO client connection
   */
  registerHandlers(socket) {

    // Handle export job pause request
    socket.on('export:pause', async (data) => {
      try {
        const { jobId } = data;

        // Pause the job using ExportService (handles worker signaling)
        await ExportService.pauseExportJob(jobId);

        // Update state using centralized manager (handles DB update and broadcasts)
        await this.jobStateManager.pauseJob(jobId, 'user-pause');
      } catch (error) {
        console.error('Error pausing export job:', error);
        socket.emit('export:error', { message: 'Failed to pause export job' });
      }
    });

    // Handle export job resume request
    socket.on('export:resume', async (data) => {
      try {
        const { jobId } = data;

        // Resume the job using ExportService (handles worker signaling and queue management)
        await ExportService.resumeExportJob(jobId);

        // Update state using centralized manager (handles DB update and broadcasts)
        await this.jobStateManager.resumeJob(jobId, 'user-resume');
      } catch (error) {
        console.error('Error resuming export job:', error);
        socket.emit('export:error', { message: 'Failed to resume export job' });
      }
    });

    // Handle export job cancel request
    socket.on('export:cancel', async (data) => {
      try {
        const { jobId } = data;

        // Cancel the job using ExportService (handles worker signaling and queue removal)
        await ExportService.cancelExportJob(jobId);

        // Update state using centralized manager (handles DB update and broadcasts)
        await this.jobStateManager.cancelJob(jobId, 'user-cancel');
      } catch (error) {
        console.error('Error canceling export job:', error);
        socket.emit('export:error', { message: 'Failed to cancel export job' });
      }
    });

    // Handle client export jobs request
    socket.on('export:get:client-jobs', async () => {
      try {
        const jobs = await ExportService.getClientExportJobs(socket.id);

        socket.emit('export:client-jobs', { jobs });
      } catch (error) {
        console.error('Error fetching client exports:', error);
        socket.emit('export:error', { message: 'Failed to fetch client exports' });
      }
    });

    // Handle single export status request
    socket.on('export:get:status', async (data) => {
      try {
        const { jobId } = data;

        if (!jobId) {
          throw new Error('Job ID is required');
        }

        // Get the current status of the job
        const job = await ExportService.getExportJob(jobId);

        if (!job) {
          throw new Error(`Export job ${jobId} not found`);
        }

        // Always ensure completed jobs show 100% progress
        const displayProgress = job.status === 'completed' ? 100 : job.progress;

        // For completed jobs, ensure processed = total for 100% display
        const displayProcessed = job.status === 'completed' ?
          (job.totalItems || job.processedItems || 0) : (job.processedItems || 0);

        // Use the actual totalItems from the job
        const displayTotal = job.totalItems || 0;

        console.log(`[ExportHandler] Sending job status: ${job._id}, status=${job.status}, items=${displayProcessed}/${displayTotal}`);

        // Send back the job status
        socket.emit('export:status', {
          jobId: job._id.toString(),
          status: job.status,
          progress: displayProgress,
          processedItems: displayProcessed,
          totalItems: displayTotal,
          filename: job.filename
        });

        // If the job was completed while client was disconnected, also send the completed event
        if (job.status === 'completed') {
          socket.emit('export:completed', {
            jobId: job._id.toString(),
            filename: job.filename
          });
        }

        // If the job was in progress but stalled, attempt to resume it
        // Increased timeout to 2 minutes to reduce false positives
        if (job.status === 'processing' && Date.now() - job.updatedAt > 120000) {
          console.log(`Detected stalled job ${jobId} (>2min), attempting to resume processing`);

          // Ensure client ID is up to date in case of reconnection
          job.clientId = socket.id;
          await job.save();

          // Update to processing if it wasn't
          if (job.status !== 'processing') {
            await job.resume();
          }

          // Re-queue the job if needed
          await ExportService.resumeExportJob(jobId);
        }
      } catch (error) {
        console.error('Error getting export status:', error);
        socket.emit('export:error', { message: 'Failed to get export status' });
      }
    });

    // Check for in-progress exports on reconnection
    socket.on('export:reconnect', async () => {
      try {
        // Get all jobs for this client
        const allJobs = await ExportService.getClientExportJobs(socket.id);

        // Filter active jobs (processing or paused)
        const activeJobs = allJobs.filter(job =>
          job.status === 'processing' || job.status === 'paused');

        // Send active jobs to client
        socket.emit('export:active-jobs', { jobs: activeJobs });

        // Update client ID for all active jobs to ensure they're associated with the new socket connection
        for (const job of activeJobs) {
          if (job.clientId !== socket.id) {
            job.clientId = socket.id;
            await job.save();
            console.log(`Updated client ID for job ${job._id} to ${socket.id}`);
          }

          // If any jobs were processing during disconnect, they might need to be resumed
          // Increased timeout to 2 minutes to reduce false positives
          if (job.status === 'processing' && Date.now() - job.updatedAt > 120000) {
            console.log(`Job ${job._id} appears stalled (>2min), queueing for processing`);
            await ExportService.resumeExportJob(job._id);
          }
        }
      } catch (error) {
        console.error('Error reconnecting to exports:', error);
      }
    });
  }

  /**
   * Set up listeners for job queue events
   * @private
   */
  setupJobQueueListeners() {
    // Listen for job completion
    jobQueue.on('job-completed', async ({ id, data }) => {
      try {
        console.log(`JobQueue job-completed event received for ${id}`);

        // Get the complete job from the database
        const job = await ExportService.getExportJob(id);

        if (job) {
          console.log(`Job ${id} completed: ${job.filename}`);

          // Get the filename from data or job
          const filename = job.filename || (data && data.filename);
          const totalItems = job.totalItems || job.processedItems || 0;

          // Use centralized state manager for completion
          await this.jobStateManager.completeJob(id, filename, totalItems, 'job-queue');

          // Broadcast notification
          this.notificationCallback(
            `Export completed: ${filename}`,
            'success'
          );

          // Trigger analytics update
          this.analyticsUpdateCallback();
        } else {
          console.error(`Job ${id} not found for completion event`);
        }
      } catch (error) {
        console.error('Error handling job completion event:', error);
      }
    });

    // Listen for job failure
    jobQueue.on('job-failed', async ({ id, error }) => {
      try {
        // Get the job from the database
        const job = await ExportService.getExportJob(id);

        if (job) {
          const errorMessage = job.error || error?.message || 'Unknown error';

          // Use centralized state manager for failure
          await this.jobStateManager.failJob(id, errorMessage, 'job-queue');

          // Broadcast notification
          this.notificationCallback(
            `Export failed: ${errorMessage}`,
            'error'
          );
        }
      } catch (err) {
        console.error('Error handling job failure event:', err);
      }
    });

    // Listen for job pause
    jobQueue.on('job-paused', async ({ id, progress }) => {
      try {
        // Use centralized state manager for paused job
        await this.jobStateManager.pauseJobWithProgress(id, progress, 'job-queue');

        // Broadcast notification
        this.notificationCallback(
          `Export paused at ${progress?.processedItems || 0} items`,
          'info'
        );
      } catch (err) {
        console.error('Error handling job pause event:', err);
      }
    });

    // Listen for worker thread events
    workerPool.on('task-progress', async (progressData) => {
      if (progressData && progressData.jobId) {
        try {
          // Use centralized state manager for all progress updates
          await this.jobStateManager.updateProgress(
            progressData.jobId,
            progressData.progress || 0,
            progressData.processedItems || 0,
            progressData.totalItems || 0,
            'worker-progress'
          );
        } catch (error) {
          console.error('Error handling worker progress update:', error);
        }
      }
    });
  }
}

export default ExportHandler;
