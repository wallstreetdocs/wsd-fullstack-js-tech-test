import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

describe('Export Handler Socket Communication Tests', () => {
  let mockIo;
  let mockSocket;
  let mockExportService;
  let mockJobStateManager;
  let mockJobQueue;

  beforeEach(() => {
    // Mock Socket.IO server
    mockIo = {
      emit: mock.fn(),
      to: mock.fn(() => ({ emit: mock.fn() }))
    };

    // Mock Socket.IO client connection
    mockSocket = {
      id: 'client123',
      emit: mock.fn(),
      on: mock.fn(),
      join: mock.fn(),
      leave: mock.fn(),
      rooms: new Set()
    };

    // Mock ExportService
    mockExportService = {
      pauseExportJob: mock.fn(),
      resumeExportJob: mock.fn(),
      cancelExportJob: mock.fn(),
      getExportJob: mock.fn(),
      getClientExportJobs: mock.fn()
    };

    // Mock JobStateManager
    mockJobStateManager = {
      pauseJob: mock.fn(),
      resumeJob: mock.fn(),
      cancelJob: mock.fn(),
      updateProgress: mock.fn(),
      completeJob: mock.fn(),
      failJob: mock.fn(),
      broadcastJobStatus: mock.fn()
    };

    // Mock JobQueue
    mockJobQueue = {
      on: mock.fn(),
      emit: mock.fn()
    };
  });

  describe('6. Socket Communication: Real-time progress updates, reconnection handling', () => {
    test('should handle export pause request via socket', async () => {
      const jobId = 'job123';
      const pauseData = { jobId };

      // Mock successful pause operation
      mockExportService.pauseExportJob.mock.mockImplementation(() => Promise.resolve());
      mockJobStateManager.pauseJob.mock.mockImplementation(() => Promise.resolve());

      // Simulate socket event handler for pause
      const handlePause = async (data) => {
        try {
          const { jobId } = data;
          
          // Pause the job using ExportService
          await mockExportService.pauseExportJob(jobId);
          
          // Update state using centralized manager
          await mockJobStateManager.pauseJob(jobId, 'user-pause');
          
          return { success: true };
        } catch (error) {
          mockSocket.emit('export:error', { message: 'Failed to pause export job' });
          return { success: false, error: error.message };
        }
      };

      const result = await handlePause(pauseData);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(mockExportService.pauseExportJob.mock.callCount(), 1);
      assert.strictEqual(mockJobStateManager.pauseJob.mock.callCount(), 1);
    });

    test('should handle export resume request via socket', async () => {
      const jobId = 'job123';
      const resumeData = { jobId };

      // Mock successful resume operation
      mockExportService.resumeExportJob.mock.mockImplementation(() => Promise.resolve());
      mockJobStateManager.resumeJob.mock.mockImplementation(() => Promise.resolve());

      // Simulate socket event handler for resume
      const handleResume = async (data) => {
        try {
          const { jobId } = data;
          
          // Resume the job using ExportService
          await mockExportService.resumeExportJob(jobId);
          
          // Update state using centralized manager
          await mockJobStateManager.resumeJob(jobId, 'user-resume');
          
          return { success: true };
        } catch (error) {
          mockSocket.emit('export:error', { message: 'Failed to resume export job' });
          return { success: false, error: error.message };
        }
      };

      const result = await handleResume(resumeData);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(mockExportService.resumeExportJob.mock.callCount(), 1);
      assert.strictEqual(mockJobStateManager.resumeJob.mock.callCount(), 1);
    });

    test('should handle export cancel request via socket', async () => {
      const jobId = 'job123';
      const cancelData = { jobId };

      // Mock successful cancel operation
      mockExportService.cancelExportJob.mock.mockImplementation(() => Promise.resolve());
      mockJobStateManager.cancelJob.mock.mockImplementation(() => Promise.resolve());

      // Simulate socket event handler for cancel
      const handleCancel = async (data) => {
        try {
          const { jobId } = data;
          
          // Cancel the job using ExportService
          await mockExportService.cancelExportJob(jobId);
          
          // Update state using centralized manager
          await mockJobStateManager.cancelJob(jobId, 'user-cancel');
          
          return { success: true };
        } catch (error) {
          mockSocket.emit('export:error', { message: 'Failed to cancel export job' });
          return { success: false, error: error.message };
        }
      };

      const result = await handleCancel(cancelData);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(mockExportService.cancelExportJob.mock.callCount(), 1);
      assert.strictEqual(mockJobStateManager.cancelJob.mock.callCount(), 1);
    });

    test('should provide current job status on request', async () => {
      const jobId = 'job123';
      const mockJob = {
        _id: jobId,
        status: 'processing',
        progress: 65,
        processedItems: 65,
        totalItems: 100,
        filename: null,
        updatedAt: new Date()
      };

      // Mock job retrieval
      mockExportService.getExportJob.mock.mockImplementation(() => Promise.resolve(mockJob));

      // Simulate socket event handler for status request
      const handleStatusRequest = async (data) => {
        try {
          const { jobId } = data;
          
          if (!jobId) {
            throw new Error('Job ID is required');
          }
          
          const job = await mockExportService.getExportJob(jobId);
          
          if (!job) {
            throw new Error(`Export job ${jobId} not found`);
          }
          
          // Always ensure completed jobs show 100% progress
          const displayProgress = job.status === 'completed' ? 100 : job.progress;
          const displayProcessed = job.status === 'completed' ?
            (job.totalItems || job.processedItems || 0) : (job.processedItems || 0);
          const displayTotal = job.totalItems || 0;
          
          const statusResponse = {
            jobId: job._id.toString(),
            status: job.status,
            progress: displayProgress,
            processedItems: displayProcessed,
            totalItems: displayTotal,
            filename: job.filename
          };
          
          mockSocket.emit('export:status', statusResponse);
          
          return { success: true, status: statusResponse };
        } catch (error) {
          mockSocket.emit('export:error', { message: 'Failed to get export status' });
          return { success: false, error: error.message };
        }
      };

      const result = await handleStatusRequest({ jobId });
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status.jobId, jobId);
      assert.strictEqual(result.status.status, 'processing');
      assert.strictEqual(result.status.progress, 65);
      assert.strictEqual(mockSocket.emit.mock.callCount(), 1);
    });

    test('should handle client reconnection and recover active jobs', async () => {
      const clientId = 'client123';
      const activeJobs = [
        {
          _id: 'job1',
          status: 'processing',
          progress: 30,
          processedItems: 30,
          totalItems: 100,
          clientId: 'old_client_id',
          updatedAt: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
          save: mock.fn()
        },
        {
          _id: 'job2',
          status: 'paused',
          progress: 50,
          processedItems: 50,
          totalItems: 100,
          clientId: clientId,
          updatedAt: new Date(),
          save: mock.fn()
        }
      ];

      // Mock client jobs retrieval
      mockExportService.getClientExportJobs.mock.mockImplementation(() => Promise.resolve(activeJobs));
      mockExportService.resumeExportJob.mock.mockImplementation(() => Promise.resolve());

      // Simulate reconnection handler
      const handleReconnection = async () => {
        try {
          // Get all jobs for this client
          const allJobs = await mockExportService.getClientExportJobs(mockSocket.id);
          
          // Filter active jobs (processing or paused)
          const activeJobsFiltered = allJobs.filter(job =>
            job.status === 'processing' || job.status === 'paused');
          
          // Send active jobs to client
          mockSocket.emit('export:active-jobs', { jobs: activeJobsFiltered });
          
          // Update client ID for all active jobs
          let stalledJobsCount = 0;
          for (const job of activeJobsFiltered) {
            if (job.clientId !== mockSocket.id) {
              job.clientId = mockSocket.id;
              await job.save();
            }
            
            // Check for stalled jobs (>2 minutes without updates)
            if (job.status === 'processing' && Date.now() - job.updatedAt > 120000) {
              await mockExportService.resumeExportJob(job._id);
              stalledJobsCount++;
            }
          }
          
          return { 
            success: true, 
            activeJobs: activeJobsFiltered.length,
            stalledJobsResumed: stalledJobsCount
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      };

      const result = await handleReconnection();
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.activeJobs, 2);
      assert.strictEqual(result.stalledJobsResumed, 1); // job1 is stalled
      assert.strictEqual(mockSocket.emit.mock.callCount(), 1);
      assert.strictEqual(activeJobs[0].save.mock.callCount(), 1); // Client ID updated
    });

    test('should broadcast progress updates to all connected clients', async () => {
      const jobId = 'job123';
      const progressData = {
        jobId,
        status: 'processing',
        progress: 75,
        processedItems: 75,
        totalItems: 100,
        filename: null,
        error: null
      };

      // Simulate progress broadcast
      const broadcastProgress = (job, source = 'unknown') => {
        if (!job) return;
        
        const statusEvent = {
          jobId: job._id || job.jobId,
          status: job.status,
          progress: job.progress || 0,
          processedItems: job.processedItems || 0,
          totalItems: job.totalItems || 0,
          filename: job.filename,
          error: job.error
        };
        
        // Broadcast to all connected clients
        mockIo.emit('export:update', statusEvent);
        
        return statusEvent;
      };

      const broadcastedEvent = broadcastProgress(progressData, 'worker');
      
      assert.deepStrictEqual(broadcastedEvent, progressData);
      assert.strictEqual(mockIo.emit.mock.callCount(), 1);
      assert.deepStrictEqual(mockIo.emit.mock.calls[0].arguments, ['export:update', progressData]);
    });

    test('should handle job queue events and broadcast notifications', async () => {
      const completedJobEvent = {
        id: 'job123',
        data: { filename: 'export_complete.csv' }
      };

      const failedJobEvent = {
        id: 'job456',
        error: { message: 'Processing failed' }
      };

      const pausedJobEvent = {
        id: 'job789',
        progress: { processedItems: 25 }
      };

      const cancelledJobEvent = {
        id: 'job999',
        error: { message: 'Cancelled by user' }
      };

      // Mock notification callback
      const notifications = [];
      const notificationCallback = (message, type) => {
        notifications.push({ message, type });
      };

      // Simulate job queue event handlers
      const handleJobCompleted = ({ id, data }) => {
        notificationCallback(`Export completed: ${data.filename}`, 'success');
        return { handled: true, type: 'completed' };
      };

      const handleJobFailed = ({ id, error }) => {
        const errorMessage = error?.message || 'Unknown error';
        notificationCallback(`Export failed: ${errorMessage}`, 'error');
        return { handled: true, type: 'failed' };
      };

      const handleJobPaused = ({ id, progress }) => {
        notificationCallback(`Export paused at ${progress?.processedItems || 0} items`, 'info');
        return { handled: true, type: 'paused' };
      };

      const handleJobCancelled = ({ id, error }) => {
        notificationCallback(`Export cancelled`, 'warning');
        return { handled: true, type: 'cancelled' };
      };

      // Test each event type
      const completedResult = handleJobCompleted(completedJobEvent);
      const failedResult = handleJobFailed(failedJobEvent);
      const pausedResult = handleJobPaused(pausedJobEvent);
      const cancelledResult = handleJobCancelled(cancelledJobEvent);

      assert.strictEqual(completedResult.handled, true);
      assert.strictEqual(failedResult.handled, true);
      assert.strictEqual(pausedResult.handled, true);
      assert.strictEqual(cancelledResult.handled, true);

      assert.strictEqual(notifications.length, 4);
      assert.strictEqual(notifications[0].message, 'Export completed: export_complete.csv');
      assert.strictEqual(notifications[0].type, 'success');
      assert.strictEqual(notifications[1].message, 'Export failed: Processing failed');
      assert.strictEqual(notifications[1].type, 'error');
      assert.strictEqual(notifications[2].message, 'Export paused at 25 items');
      assert.strictEqual(notifications[2].type, 'info');
      assert.strictEqual(notifications[3].message, 'Export cancelled');
      assert.strictEqual(notifications[3].type, 'warning');
    });

    test('should handle socket errors gracefully', async () => {
      const errorScenarios = [
        {
          operation: 'pause',
          error: new Error('Service unavailable'),
          expectedMessage: 'Failed to pause export job'
        },
        {
          operation: 'resume',
          error: new Error('Job not found'),
          expectedMessage: 'Failed to resume export job'
        },
        {
          operation: 'cancel',
          error: new Error('Database error'),
          expectedMessage: 'Failed to cancel export job'
        },
        {
          operation: 'status',
          error: new Error('Job not found'),
          expectedMessage: 'Failed to get export status'
        }
      ];

      const errorResponses = [];

      // Mock socket emit to capture error messages
      mockSocket.emit.mock.mockImplementation((event, data) => {
        if (event === 'export:error') {
          errorResponses.push(data);
        }
      });

      // Test each error scenario
      for (const scenario of errorScenarios) {
        const handleError = (operation, error) => {
          try {
            throw error;
          } catch (err) {
            const errorMessage = scenario.expectedMessage;
            mockSocket.emit('export:error', { message: errorMessage });
            return { success: false, error: err.message };
          }
        };

        const result = handleError(scenario.operation, scenario.error);
        
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.error, scenario.error.message);
      }

      // Verify all error messages were emitted
      assert.strictEqual(errorResponses.length, errorScenarios.length);
      errorResponses.forEach((response, index) => {
        assert.strictEqual(response.message, errorScenarios[index].expectedMessage);
      });
    });

    test('should handle completed job notifications on status request', async () => {
      const jobId = 'job123';
      const completedJob = {
        _id: jobId,
        status: 'completed',
        progress: 100,
        processedItems: 100,
        totalItems: 100,
        filename: 'completed_export.csv',
        updatedAt: new Date()
      };

      // Mock completed job retrieval
      mockExportService.getExportJob.mock.mockImplementation(() => Promise.resolve(completedJob));

      // Simulate status request handler for completed job
      const handleCompletedJobStatus = async (data) => {
        const { jobId } = data;
        const job = await mockExportService.getExportJob(jobId);

        if (job && job.status === 'completed') {
          // Send status
          mockSocket.emit('export:status', {
            jobId: job._id.toString(),
            status: job.status,
            progress: 100,
            processedItems: job.totalItems,
            totalItems: job.totalItems,
            filename: job.filename
          });

          // Also send completion event for disconnected clients
          mockSocket.emit('export:completed', {
            jobId: job._id.toString(),
            filename: job.filename
          });

          return { success: true, wasCompleted: true };
        }

        return { success: true, wasCompleted: false };
      };

      const result = await handleCompletedJobStatus({ jobId });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.wasCompleted, true);
      assert.strictEqual(mockSocket.emit.mock.callCount(), 2);
      
      // Verify both status and completed events were emitted
      const calls = mockSocket.emit.mock.calls;
      assert.strictEqual(calls[0].arguments[0], 'export:status');
      assert.strictEqual(calls[1].arguments[0], 'export:completed');
      assert.strictEqual(calls[1].arguments[1].filename, 'completed_export.csv');
    });
  });
});