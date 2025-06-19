/**
 * @fileoverview Socket.IO event handlers for real-time communication
 * @module sockets/SocketHandlers
 */

import AnalyticsService from '../services/analyticsService.js';
import ExportService from '../services/exportService.js';

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
          
          // Start processing the job in the background
          this.processExportJob(exportJob, socket);
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
          const job = await ExportService.getExportJob(jobId);
          if (job && job.status === 'paused') {
            this.processExportJob(job, socket);
          }
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
        }
        
        // If job failed, send error notification
        if (updatedJob.status === 'failed') {
          socket.emit('export-failed', {
            jobId: updatedJob._id,
            error: updatedJob.error
          });
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
