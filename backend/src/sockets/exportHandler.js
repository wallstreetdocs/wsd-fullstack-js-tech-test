/**
 * @fileoverview Socket.IO event handlers for export functionality
 * @module sockets/ExportHandler
 */

import { EventEmitter } from 'events';
import ExportService from '../services/exportService.js';
import jobQueue from '../services/jobQueue.js';
import workerPool from '../services/workerPool.js';

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
    this.setupJobQueueListeners();
    
    // Forward events from this handler to the ExportService
    this.on('job-completed', (completionData) => {
      // Forward to ExportService's job-completed event handlers
      ExportService.emit('job-completed', completionData);
    });
  }

  /**
   * Registers socket event handlers for client connection
   * @param {Object} socket - Socket.IO client connection
   */
  registerHandlers(socket) {
    // Handle export job requests
    socket.on('export:start', async (data) => {
      try {
        const { format, filters } = data;
        
        // Create a new export job
        const exportJob = await ExportService.createExportJob({
          format,
          filters,
          clientId: socket.id
        });
        
        // Send initial job info
        socket.emit('export:created', {
          jobId: exportJob._id,
          status: exportJob.status,
          progress: exportJob.progress
        });

        // SIMPLIFIED: We already have the actual count from when the job was created
        // Just use what we have in the database directly - no need to recalculate
        const totalCount = exportJob.totalItems;
        console.log(`[ExportHandler] Export job ${exportJob._id} has ${totalCount} items total`);
        
        // The count is already saved in the database, we don't need to re-save it
        
        // SIMPLIFIED: Send initial progress update with the actual count
        console.log(`[ExportHandler] Sending initial progress update for job ${exportJob._id} with ${totalCount} items`);
        
        // Create a simple, clear progress update
        const initialProgress = {
          jobId: exportJob._id,
          status: 'processing',
          progress: 0,           // Starting at 0%
          processedItems: 0,     // No items processed yet
          totalItems: totalCount // The REAL total from the database
        };
        
        // Send to the client and broadcast
        socket.emit('export:progress', initialProgress);
        this.io.emit('export:progress', initialProgress);
      } catch (error) {
        console.error('Error starting export job:', error);
        socket.emit('export:error', { message: 'Failed to start export job' });
      }
    });

    // Handle export job pause request
    socket.on('export:pause', async (data) => {
      try {
        const { jobId } = data;
        const job = await ExportService.pauseExportJob(jobId);
        
        socket.emit('export:paused', {
          jobId: job._id,
          status: job.status,
          progress: job.progress
        });
      } catch (error) {
        console.error('Error pausing export job:', error);
        socket.emit('export:error', { message: 'Failed to pause export job' });
      }
    });

    // Handle export job resume request
    socket.on('export:resume', async (data) => {
      try {
        const { jobId } = data;
        
        // Send initial resume notification
        socket.emit('export:resumed', { jobId });
        
        // Resume the job
        const job = await ExportService.resumeExportJob(jobId);
        
        // Get actual total items count
        const actualCount = await ExportService.estimateExportSize(job);
        
        // Always update the job with the real count
        job.totalItems = actualCount;
        await job.save();
        
        // Manually send immediate progress update to show it's processing again
        socket.emit('export:progress', {
          jobId: job._id,
          status: 'processing',
          progress: job.progress,
          processedItems: job.processedItems || 0,
          totalItems: actualCount
        });
      } catch (error) {
        console.error('Error resuming export job:', error);
        socket.emit('export:error', { message: 'Failed to resume export job' });
      }
    });
    
    // Handle export job cancel request
    socket.on('export:cancel', async (data) => {
      try {
        const { jobId } = data;
        
        // Send initial cancel notification
        socket.emit('export:cancelling', { jobId });
        
        // Cancel the job
        const job = await ExportService.cancelExportJob(jobId);
        
        // Send update with cancelled status
        socket.emit('export:cancelled', {
          jobId: job._id,
          status: job.status
        });
      } catch (error) {
        console.error('Error canceling export job:', error);
        socket.emit('export:error', { message: 'Failed to cancel export job' });
      }
    });

    // Handle export job download request
    socket.on('export:download', async (data) => {
      try {
        const { jobId } = data;
        const downloadData = await ExportService.getExportDownload(jobId);
        
        socket.emit('export:download-ready', {
          jobId,
          data: downloadData.content.toString('base64'),
          filename: downloadData.filename,
          format: downloadData.format
        });
      } catch (error) {
        console.error('Error preparing export download:', error);
        socket.emit('export:error', { message: 'Failed to prepare export download' });
      }
    });

    // Handle export job history request
    socket.on('export:get:history', async (data = {}) => {
      try {
        const { page = 1, limit = 10 } = data;
        const history = await ExportService.getExportHistory(page, limit);
        
        socket.emit('export:history', history);
      } catch (error) {
        console.error('Error fetching export history:', error);
        socket.emit('export:error', { message: 'Failed to fetch export history' });
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
        if (job.status === 'processing' && Date.now() - job.updatedAt > 30000) {
          console.log(`Detected stalled job ${jobId}, attempting to resume processing`);
          
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
          if (job.status === 'processing' && Date.now() - job.updatedAt > 30000) {
            console.log(`Job ${job._id} appears stalled, queueing for processing`);
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
    // Listen for job progress updates
    jobQueue.on('job-progress', async ({ id, progress, data }) => {
      try {
        // Get the job from the database to have complete information
        const job = await ExportService.getExportJob(id);
        
        if (job && job.clientId) {
          // SIMPLIFIED: Use the data from the database directly
          // The job object contains the correct totalItems that was set at creation time
          
          // Use processed items from the worker if available, otherwise from the job
          const processedItems = data?.processedItems || job.processedItems || 0;
          
          // ALWAYS use totalItems from the job record - it was set correctly at creation
          const totalItems = job.totalItems;
          
          const progressData = {
            jobId: job._id,
            status: job.status,
            progress: progress,
            processedItems: processedItems,
            totalItems: totalItems
          };
          
          console.log(`Sending progress update: ${job._id}, Status: ${job.status}, Progress: ${progress}%, Items: ${processedItems}/${totalItems}`);
          
          // Emit progress event to the specific client
          this.io.to(job.clientId).emit('export:progress', progressData);
          
          // Broadcast to all clients (for testing/debugging)
          this.io.emit('export:progress', progressData);
          
          // No progress notifications - only notify on completion
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
          
          // Always use same count for processed and total items at completion
          // This ensures UI shows 100% with matching numbers (e.g., 48/48 not 28/48)
          // Use the actual item count from the job
          const itemCount = job.totalItems || job.processedItems || 0;
          
          console.log(`[ExportHandler] Final progress update for job ${job._id}: ${itemCount}/${itemCount} items`);
          
          const finalProgressUpdate = {
            jobId: job._id.toString(),
            status: 'completed',
            progress: 100,
            processedItems: itemCount,
            totalItems: itemCount
          };
          
          // Also update the job in the database to ensure consistency
          job.processedItems = itemCount;
          job.totalItems = itemCount;
          job.progress = 100;
          await job.save();
          
          // Send final progress to all clients
          this.io.emit('export:progress', finalProgressUpdate);
          
          // Send to specific client if available
          if (job.clientId) {
            this.io.to(job.clientId).emit('export:progress', finalProgressUpdate);
          }
          
          // Create the completion message with the actual item count
          const completionMessage = {
            jobId: job._id.toString(),
            filename: job.filename || (data && data.filename),
            totalItems: job.totalItems || job.processedItems // Use the actual count from the job
          };
          
          console.log(`Broadcasting job-completed event to all clients: ${JSON.stringify(completionMessage)}`);
          
          // Broadcast to all clients
          this.io.emit('export:completed', completionMessage);
          
          // Also send to specific client if available
          if (job.clientId) {
            console.log(`Sending export-completed to client ${job.clientId}`);
            this.io.to(job.clientId).emit('export:completed', completionMessage);
          }
          
          // Broadcast notification
          this.notificationCallback(
            `Export completed: ${job.filename}`,
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
        
        if (job && job.clientId) {
          // Emit failure event to the specific client
          this.io.to(job.clientId).emit('export:failed', {
            jobId: job._id,
            error: job.error || error?.message || 'Unknown error'
          });
          
          // Broadcast notification
          this.notificationCallback(
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
            
            // Get the real totalItems from the job, if not available in progress data
            let processedItems = Math.max(progressData.processedItems || 0, 0);
            let totalItems = progressData.totalItems || job.totalItems || 0;
            
            // If we still don't have a real count, query for it
            if (totalItems <= 1 && job.filters) {
              try {
                // Get real count from database
                totalItems = await ExportService.estimateExportSize(job);
                
                // Update the job with the correct count
                job.totalItems = totalItems;
                await job.save();
              } catch (countError) {
                console.error('Error getting estimated count:', countError);
                // Fallback to a safe value
                totalItems = Math.max(job.totalItems || 1, 1);
              }
            }
            
            // Make sure the count is never zero
            totalItems = Math.max(totalItems, 1);
            
            // Create progress update with accurate counts
            const progressUpdate = {
              jobId: job._id,
              status: 'processing',
              progress: progressData.progress || 0,
              processedItems: processedItems,
              totalItems: totalItems
            };
            
            // Broadcast to specific client if clientId exists
            if (job.clientId) {
              this.io.to(job.clientId).emit('export:progress', progressUpdate);
            }
            
            // Broadcast to all clients (for testing/debugging)
            this.io.emit('export:progress', progressUpdate);
          }
        } catch (error) {
          console.error('Error handling worker progress update:', error);
        }
      }
    });
    
    // Listen for worker thread status updates
    workerPool.on('task-status', async (statusData) => {
      if (statusData && statusData.jobId) {
        try {
          const job = await ExportService.getExportJob(statusData.jobId);
          if (job) {
            console.log(`Broadcasting worker status update: Job ${statusData.jobId}, Status: ${statusData.status}`);
            
            // Get the real totalItems from the job, if not available in status data
            let processedItems = Math.max(statusData.processedItems || 0, 0);
            let totalItems = statusData.totalItems || job.totalItems || 0;
            
            // If we still don't have a real count, query for it
            if (totalItems <= 1 && job.filters) {
              try {
                // Get real count from database
                totalItems = await ExportService.estimateExportSize(job);
                
                // Update the job with the correct count
                job.totalItems = totalItems;
                await job.save();
              } catch (countError) {
                console.error('Error getting estimated count:', countError);
                // Fallback to a safe value
                totalItems = Math.max(job.totalItems || 1, 1);
              }
            }
            
            // Make sure the count is never zero
            totalItems = Math.max(totalItems, 1);
            
            // Create status update object with accurate counts
            const statusUpdate = {
              jobId: job._id,
              status: statusData.status,
              progress: statusData.progress || job.progress || 0,
              processedItems: processedItems,
              totalItems: totalItems
            };
            
            // Broadcast to specific client if clientId exists
            if (job.clientId) {
              this.io.to(job.clientId).emit('export:progress', statusUpdate);
              
              // For paused status, also emit a specific paused event
              if (statusData.status === 'paused') {
                this.io.to(job.clientId).emit('export:paused', {
                  jobId: job._id,
                  status: 'paused',
                  progress: statusUpdate.progress
                });
              }
            }
            
            // Broadcast to all clients (for testing/debugging)
            this.io.emit('export:progress', statusUpdate);
          }
        } catch (error) {
          console.error('Error handling worker status update:', error);
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
            
            // Get the real totalItems from the job, if not available in progress data
            let processedItems = Math.max(progressData.processedItems || 0, 0);
            let totalItems = progressData.totalItems || job.totalItems || 0;
            
            // If we still don't have a real count, query for it
            if (totalItems <= 1 && job.filters) {
              try {
                // Get real count from database
                totalItems = await ExportService.estimateExportSize(job);
                
                // Update the job with the correct count
                job.totalItems = totalItems;
                await job.save();
              } catch (countError) {
                console.error('Error getting estimated count:', countError);
                // Fallback to a safe value
                totalItems = Math.max(job.totalItems || 1, 1);
              }
            }
            
            // Make sure the count is never zero
            totalItems = Math.max(totalItems, 1);
            
            // Create progress update with accurate counts
            const progressUpdate = {
              jobId: job._id,
              status: 'processing',
              progress: progressData.progress || 0,
              processedItems: processedItems,
              totalItems: totalItems
            };
            
            // Broadcast to all clients
            this.io.emit('export:progress', progressUpdate);
            
            // Broadcast to specific client if clientId exists
            if (job.clientId) {
              this.io.to(job.clientId).emit('export:progress', progressUpdate);
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
          const clientMessage = {
            jobId: job._id.toString(),
            filename: filename,
            totalItems: job.totalItems || job.processedItems || 0 // Include the actual count
          };
          
          console.log(`Broadcasting export-completed with: ${JSON.stringify(clientMessage)}`);
          
          // Send to all clients (more reliable)
          this.io.emit('export:completed', clientMessage);
          
          // Also send to specific client if clientId exists
          if (job.clientId) {
            console.log(`Sending export-completed to specific client ${job.clientId}`);
            this.io.to(job.clientId).emit('export:completed', clientMessage);
          }
          
          // Broadcast notification
          this.notificationCallback(
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
        socket.emit('export:progress', {
          jobId: updatedJob._id,
          status: updatedJob.status,
          progress: updatedJob.progress,
          processedItems: updatedJob.processedItems,
          totalItems: updatedJob.totalItems
        });
        
        // If job completed, send completion notification
        if (updatedJob.status === 'completed') {
          socket.emit('export:completed', {
            jobId: updatedJob._id,
            filename: updatedJob.filename
          });
          
          // Broadcast notification about export completion
          this.notificationCallback(
            `Export completed: ${updatedJob.filename}`,
            'success'
          );
          
          // Trigger analytics update to refresh recent activity with the new export job
          this.analyticsUpdateCallback();
        }
        
        // If job failed, send error notification
        if (updatedJob.status === 'failed') {
          socket.emit('export:failed', {
            jobId: updatedJob._id,
            error: updatedJob.error
          });
          
          // Update analytics for failed exports too
          this.analyticsUpdateCallback();
        }
      };
      
      // Start processing in the background
      ExportService.processExportJob(job, progressCallback).catch((error) => {
        console.error('Error in background export processing:', error);
      });
    } catch (error) {
      console.error('Error processing export job:', error);
      socket.emit('export:error', { message: 'Failed to process export job' });
    }
  }
}

export default ExportHandler;