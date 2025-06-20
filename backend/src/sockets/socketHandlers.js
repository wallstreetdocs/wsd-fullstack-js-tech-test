/**
 * @fileoverview Socket.IO event handlers for real-time communication
 * @module sockets/SocketHandlers
 */

import AnalyticsService from '../services/analyticsService.js';
import ExportService from '../services/exportService.js';
import jobQueue from '../services/jobQueue.js';
import workerPool from '../services/workerPool.js';

/**
 * Handles Socket.IO connections and real-time events
 * @class SocketHandlers
 */
class SocketHandlers {
  /**
   * Creates SocketHandlers instance and sets up event listeners
   * @param {Object} io - Socket.IO server instance
   */
  constructor(io) {
    this.io = io;
    this.exportJobs = new Map(); // Track active export jobs by socket ID
    this.setupEventHandlers();
    this.setupJobQueueListeners();
  }

  /**
   * Sets up Socket.IO event handlers for client connections
   * @private
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      socket.on('join-analytics', () => {
        socket.join('analytics');
        console.log(`📊 Client ${socket.id} joined analytics room`);
      });

      socket.on('request-analytics', async () => {
        try {
          const metrics = await AnalyticsService.getTaskMetrics();
          socket.emit('analytics-update', metrics);
        } catch (error) {
          console.error('Error sending analytics update:', error);
          socket.emit('analytics-error', { message: 'Failed to get analytics data' });
        }
      });

      // Handle export job requests
      socket.on('start-export', async (data) => {
        try {
          const { format, filters } = data;
          
          // Create a new export job
          const exportJob = await ExportService.createExportJob({
            format,
            filters,
            clientId: socket.id
          });
          
          // Send initial job info
          socket.emit('export-job-created', {
            jobId: exportJob._id,
            status: exportJob.status,
            progress: exportJob.progress
          });

          // Manually trigger an immediate progress update to transition from "pending"
          socket.emit('export-progress', {
            jobId: exportJob._id,
            status: 'processing',
            progress: 0,
            processedItems: 0,
            totalItems: 1 // Initial placeholder
          });
        } catch (error) {
          console.error('Error starting export job:', error);
          socket.emit('export-error', { message: 'Failed to start export job' });
        }
      });

      // Handle export job pause request
      socket.on('pause-export', async (data) => {
        try {
          const { jobId } = data;
          const job = await ExportService.pauseExportJob(jobId);
          
          socket.emit('export-job-paused', {
            jobId: job._id,
            status: job.status,
            progress: job.progress
          });
        } catch (error) {
          console.error('Error pausing export job:', error);
          socket.emit('export-error', { message: 'Failed to pause export job' });
        }
      });

      // Handle export job resume request
      socket.on('resume-export', async (data) => {
        try {
          const { jobId } = data;
          
          // Send initial resume notification
          socket.emit('export-job-resumed', { jobId });
          
          // Resume the job
          const job = await ExportService.resumeExportJob(jobId);
          
          // Manually send immediate progress update to show it's processing again
          socket.emit('export-progress', {
            jobId: job._id,
            status: 'processing',
            progress: job.progress,
            processedItems: job.processedItems || 0,
            totalItems: job.totalItems || 1
          });
        } catch (error) {
          console.error('Error resuming export job:', error);
          socket.emit('export-error', { message: 'Failed to resume export job' });
        }
      });

      // Handle export job download request
      socket.on('download-export', async (data) => {
        try {
          const { jobId } = data;
          const downloadData = await ExportService.getExportDownload(jobId);
          
          socket.emit('export-download-ready', {
            jobId,
            data: downloadData.content.toString('base64'),
            filename: downloadData.filename,
            format: downloadData.format
          });
        } catch (error) {
          console.error('Error preparing export download:', error);
          socket.emit('export-error', { message: 'Failed to prepare export download' });
        }
      });

      // Handle export job history request
      socket.on('get-export-history', async (data = {}) => {
        try {
          const { page = 1, limit = 10 } = data;
          const history = await ExportService.getExportHistory(page, limit);
          
          socket.emit('export-history', history);
        } catch (error) {
          console.error('Error fetching export history:', error);
          socket.emit('export-error', { message: 'Failed to fetch export history' });
        }
      });

      // Handle client export jobs request
      socket.on('get-client-exports', async () => {
        try {
          const jobs = await ExportService.getClientExportJobs(socket.id);
          
          socket.emit('client-exports', { jobs });
        } catch (error) {
          console.error('Error fetching client exports:', error);
          socket.emit('export-error', { message: 'Failed to fetch client exports' });
        }
      });
      
      // Check for in-progress exports on reconnection
      socket.on('reconnect-exports', async () => {
        try {
          const jobs = await ExportService.getClientExportJobs(socket.id);
          const activeJobs = jobs.filter(job => 
            job.status === 'processing' || job.status === 'paused');
          
          socket.emit('active-exports', { jobs: activeJobs });
        } catch (error) {
          console.error('Error reconnecting to exports:', error);
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        // Clean up any active exports for this client if needed
      });
    });
  }

  /**
   * Set up listeners for job queue events
   * @private
   */
  setupJobQueueListeners() {
    // Listen for job progress updates
    jobQueue.on('job-progress', async ({ id, progress, data }) => {
      try {
        // Get the job from the database to have complete information
        const job = await ExportService.getExportJob(id);
        
        if (job && job.clientId) {
          // Emit progress event to the specific client
          this.io.to(job.clientId).emit('export-progress', {
            jobId: job._id,
            status: job.status,
            progress: job.progress,
            processedItems: job.processedItems || 0,
            totalItems: job.totalItems || 1
          });
          
          // Send to all clients (for testing/debugging)
          this.io.emit('export-progress', {
            jobId: job._id,
            status: job.status,
            progress: job.progress,
            processedItems: job.processedItems || 0,
            totalItems: job.totalItems || 1
          });
          
          // Only broadcast occasional progress updates to avoid noise
          if (progress % 20 === 0) {
            this.broadcastNotification(
              `Export progress: ${progress}% complete`,
              'info'
            );
          }
        }
      } catch (error) {
        console.error('Error handling job progress event:', error);
      }
    });
    
    // Listen for job completion
    jobQueue.on('job-completed', async ({ id, data }) => {
      try {
        console.log(`JobQueue job-completed event received for ${id}`);
        
        // Get the complete job from the database
        const job = await ExportService.getExportJob(id);
        
        if (job) {
          console.log(`Job ${id} completed: ${job.filename}`);
          
          // Create the client message
          const completionMessage = {
            jobId: job._id.toString(),
            filename: job.filename || (data && data.filename)
          };
          
          console.log(`Broadcasting job-completed event to all clients: ${JSON.stringify(completionMessage)}`);
          
          // Broadcast to all clients
          this.io.emit('export-completed', completionMessage);
          
          // Also send to specific client if available
          if (job.clientId) {
            console.log(`Sending export-completed to client ${job.clientId}`);
            this.io.to(job.clientId).emit('export-completed', completionMessage);
          }
          
          // Broadcast notification
          this.broadcastNotification(
            `Export completed: ${job.filename}`,
            'success'
          );
          
          // Trigger analytics update
          this.broadcastAnalyticsUpdate();
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
        
        if (job && job.clientId) {
          // Emit failure event to the specific client
          this.io.to(job.clientId).emit('export-failed', {
            jobId: job._id,
            error: job.error || error?.message || 'Unknown error'
          });
          
          // Broadcast notification
          this.broadcastNotification(
            `Export failed: ${error?.message || 'Unknown error'}`,
            'error'
          );
        }
      } catch (err) {
        console.error('Error handling job failure event:', err);
      }
    });

    // Listen for worker thread events
    workerPool.on('task-progress', async (progressData) => {
      if (progressData && progressData.jobId) {
        try {
          const job = await ExportService.getExportJob(progressData.jobId);
          if (job) {
            console.log(`Broadcasting worker progress update: Job ${progressData.jobId}, Progress: ${progressData.progress}%`);
            
            // Broadcast to specific client if clientId exists
            if (job.clientId) {
              this.io.to(job.clientId).emit('export-progress', {
                jobId: job._id,
                status: 'processing',
                progress: progressData.progress || 0,
                processedItems: progressData.processedItems || 0,
                totalItems: progressData.totalItems || 1
              });
            }
            
            // Broadcast to all clients (for testing/debugging)
            this.io.emit('export-progress', {
              jobId: job._id,
              status: 'processing',
              progress: progressData.progress || 0,
              processedItems: progressData.processedItems || 0,
              totalItems: progressData.totalItems || 1
            });
          }
        } catch (error) {
          console.error('Error handling worker progress update:', error);
        }
      }
    });
    
    // Listen for ExportService progress events 
    ExportService.on('task-progress', async (progressData) => {
      if (progressData && progressData.jobId) {
        try {
          const job = await ExportService.getExportJob(progressData.jobId);
          if (job) {
            console.log(`Broadcasting ExportService progress: Job ${progressData.jobId}, Progress: ${progressData.progress}%`);
            
            // Broadcast to all clients
            this.io.emit('export-progress', {
              jobId: job._id,
              status: 'processing',
              progress: progressData.progress || 0,
              processedItems: progressData.processedItems || 0,
              totalItems: progressData.totalItems || 1
            });
            
            // Broadcast to specific client if clientId exists
            if (job.clientId) {
              this.io.to(job.clientId).emit('export-progress', {
                jobId: job._id,
                status: 'processing',
                progress: progressData.progress || 0,
                processedItems: progressData.processedItems || 0,
                totalItems: progressData.totalItems || 1
              });
            }
          }
        } catch (error) {
          console.error('Error handling ExportService progress update:', error);
        }
      }
    });
    
    // Listen for ExportService completion events
    ExportService.on('job-completed', async (completionData) => {
      try {
        const { jobId, filename, format } = completionData;
        
        console.log(`ExportService completed event for job ${jobId}, filename: ${filename}`);
        
        const job = await ExportService.getExportJob(jobId);
        if (job) {
          const completionData = {
            jobId: job._id,
            filename: filename,
            format: format
          };
          
          console.log(`Broadcasting export completed: ${JSON.stringify(completionData)}`);
          
          // Broadcast to all clients with the proper structure the frontend expects
          const clientMessage = {
            jobId: job._id.toString(),
            filename: filename
          };
          console.log(`Broadcasting export-completed with: ${JSON.stringify(clientMessage)}`);
          
          // Send to all clients (more reliable)
          this.io.emit('export-completed', clientMessage);
          
          // Also send to specific client if clientId exists
          if (job.clientId) {
            console.log(`Sending export-completed to specific client ${job.clientId}`);
            this.io.to(job.clientId).emit('export-completed', clientMessage);
          }
          
          // Broadcast notification
          this.broadcastNotification(
            `Export completed: ${filename}`,
            'success'
          );
        }
      } catch (error) {
        console.error('Error handling ExportService completion event:', error);
      }
    });
  }

  /**
   * Process an export job and send progress updates via socket
   * @param {Object} job - Export job to process
   * @param {Object} socket - Client socket
   * @returns {Promise<void>}
   */
  async processExportJob(job, socket) {
    try {
      // Progress update callback
      const progressCallback = (updatedJob) => {
        socket.emit('export-progress', {
          jobId: updatedJob._id,
          status: updatedJob.status,
          progress: updatedJob.progress,
          processedItems: updatedJob.processedItems,
          totalItems: updatedJob.totalItems
        });
        
        // If job completed, send completion notification
        if (updatedJob.status === 'completed') {
          socket.emit('export-completed', {
            jobId: updatedJob._id,
            filename: updatedJob.filename
          });
          
          // Broadcast notification about export completion
          this.broadcastNotification(
            `Export completed: ${updatedJob.filename}`,
            'success'
          );
          
          // Trigger analytics update to refresh recent activity with the new export job
          this.broadcastAnalyticsUpdate();
        }
        
        // If job failed, send error notification
        if (updatedJob.status === 'failed') {
          socket.emit('export-failed', {
            jobId: updatedJob._id,
            error: updatedJob.error
          });
          
          // Update analytics for failed exports too
          this.broadcastAnalyticsUpdate();
        }
      };
      
      // Start processing in the background
      ExportService.processExportJob(job, progressCallback).catch((error) => {
        console.error('Error in background export processing:', error);
      });
    } catch (error) {
      console.error('Error processing export job:', error);
      socket.emit('export-error', { message: 'Failed to process export job' });
    }
  }

  /**
   * Broadcasts analytics updates to all connected clients in analytics room
   * @async
   * @returns {Promise<void>}
   */
  async broadcastAnalyticsUpdate() {
    try {
      const metrics = await AnalyticsService.getTaskMetrics();
      this.io.to('analytics').emit('analytics-update', metrics);
    } catch (error) {
      console.error('Error broadcasting analytics update:', error);
    }
  }

  /**
   * Broadcasts task updates to all connected clients
   * @param {string} action - Action performed (created, updated, deleted)
   * @param {Object} task - Task data
   */
  broadcastTaskUpdate(action, task) {
    this.io.emit('task-update', {
      action,
      task,
      timestamp: new Date().toISOString()
    });

    this.broadcastAnalyticsUpdate();
  }

  /**
   * Broadcasts notifications to all connected clients
   * @param {string} message - Notification message
   * @param {string} [type='info'] - Notification type (info, warning, error)
   */
  broadcastNotification(message, type = 'info') {
    this.io.emit('notification', {
      message,
      type,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Checks metrics against thresholds and sends notifications if exceeded
   * @async
   * @param {Object} metrics - Analytics metrics object
   * @returns {Promise<void>}
   */
  async checkMetricThresholds(metrics) {
    if (metrics.completionRate < 50) {
      this.broadcastNotification(
        `⚠️ Task completion rate has dropped to ${metrics.completionRate}%`,
        'warning'
      );
    }

    if (metrics.tasksByStatus.pending > 20) {
      this.broadcastNotification(
        `📋 High number of pending tasks: ${metrics.tasksByStatus.pending}`,
        'info'
      );
    }

    if (metrics.tasksByPriority.high > 10) {
      this.broadcastNotification(
        `🔥 High priority tasks need attention: ${metrics.tasksByPriority.high}`,
        'warning'
      );
    }
  }
}

export default SocketHandlers;