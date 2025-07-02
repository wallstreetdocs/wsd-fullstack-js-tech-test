import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

describe('Job Queue Logic Tests', () => {
  let mockRedisClient;
  let mockExportJob;
  let jobQueue;

  beforeEach(() => {
    // Mock Redis client
    mockRedisClient = {
      hset: mock.fn(),
      hgetall: mock.fn(),
      zadd: mock.fn(),
      zpopmin: mock.fn(),
      del: mock.fn(),
      zrem: mock.fn(),
      scan: mock.fn(),
      keys: mock.fn(),
      multi: mock.fn(() => ({
        hset: mock.fn(),
        zadd: mock.fn(),
        zrem: mock.fn(),
        del: mock.fn(),
        exec: mock.fn()
      }))
    };

    // Mock ExportJob model
    mockExportJob = {
      findById: mock.fn()
    };

    // Mock job queue instance
    jobQueue = {
      queueName: 'export-jobs',
      processing: false,
      activeJobs: new Map(),
      jobStatusPrefix: 'export-jobs:status:',
      concurrentJobLimit: 5,
      initialized: false
    };
  });

  describe('Job Queue Management', () => {
    test('should add job to queue with correct priority scoring', async () => {
      const jobId = 'job123';
      const jobType = 'exportTasks';
      const jobData = { format: 'csv', filters: { status: 'completed' } };
      const options = { priority: 3 };

      const timestamp = 1640995200000; // Fixed timestamp for testing
      const expectedScore = options.priority * 10000000000 + timestamp;

      // Mock Redis operations
      mockRedisClient.hset.mock.mockImplementation(() => Promise.resolve());
      mockRedisClient.zadd.mock.mockImplementation(() => Promise.resolve());

      // Simulate addJob logic
      const addJob = async (jobId, jobType, jobData, options = {}) => {
        const priority = options.priority || 0;
        const timestamp = 1640995200000; // Fixed for testing
        
        // Store job details in Redis
        await mockRedisClient.hset(
          `${jobQueue.jobStatusPrefix}${jobId}`,
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
        const score = priority * 10000000000 + timestamp;
        await mockRedisClient.zadd(jobQueue.queueName, score, jobId);

        return { success: true, score };
      };

      const result = await addJob(jobId, jobType, jobData, options);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.score, expectedScore);
      assert.strictEqual(mockRedisClient.hset.mock.callCount(), 1);
      assert.strictEqual(mockRedisClient.zadd.mock.callCount(), 1);
    });

    test('should respect concurrent job limits', async () => {
      // Set up active jobs at the limit
      jobQueue.activeJobs.set('job1', { type: 'exportTasks' });
      jobQueue.activeJobs.set('job2', { type: 'exportTasks' });
      jobQueue.activeJobs.set('job3', { type: 'exportTasks' });
      jobQueue.activeJobs.set('job4', { type: 'exportTasks' });
      jobQueue.activeJobs.set('job5', { type: 'exportTasks' });

      // Simulate processNextJob logic with concurrency check
      const processNextJob = () => {
        if (jobQueue.activeJobs.size >= jobQueue.concurrentJobLimit) {
          return { shouldWait: true, reason: 'concurrent_limit_reached' };
        }
        return { shouldProcess: true };
      };

      const result = processNextJob();

      assert.strictEqual(result.shouldWait, true);
      assert.strictEqual(result.reason, 'concurrent_limit_reached');
      assert.strictEqual(jobQueue.activeJobs.size, 5);
    });

    test('should process jobs in priority order', async () => {
      // Mock queue with multiple jobs
      const queuedJobs = [
        { jobId: 'job1', score: 1 * 10000000000 + 1000 }, // Priority 1, timestamp 1000
        { jobId: 'job2', score: 3 * 10000000000 + 2000 }, // Priority 3, timestamp 2000
        { jobId: 'job3', score: 2 * 10000000000 + 1500 }, // Priority 2, timestamp 1500
        { jobId: 'job4', score: 3 * 10000000000 + 1800 }  // Priority 3, timestamp 1800
      ];

      // Sort by score (descending for highest priority first)
      queuedJobs.sort((a, b) => b.score - a.score);

      // Highest priority jobs should come first
      assert.strictEqual(queuedJobs[0].jobId, 'job2'); // Priority 3, later timestamp
      assert.strictEqual(queuedJobs[1].jobId, 'job4'); // Priority 3, earlier timestamp
      assert.strictEqual(queuedJobs[2].jobId, 'job3'); // Priority 2
      assert.strictEqual(queuedJobs[3].jobId, 'job1'); // Priority 1
    });

    test('should handle job completion correctly', async () => {
      const jobId = 'job123';
      const completedJobResult = {
        success: true,
        data: { filename: 'export.csv', totalItems: 100 }
      };

      // Mock Redis operations
      mockRedisClient.hset.mock.mockImplementation(() => Promise.resolve());

      // Simulate job completion handler
      const handleJobCompletion = async (jobId, result) => {
        const { success, error, data, paused, cancelled } = result;

        // Remove from active jobs
        jobQueue.activeJobs.delete(jobId);

        if (success) {
          // Update job status to 'completed'
          await mockRedisClient.hset(`${jobQueue.jobStatusPrefix}${jobId}`, {
            status: 'completed',
            completedAt: Date.now(),
            result: JSON.stringify(data || {})
          });

          return { handled: true, status: 'completed' };
        }

        return { handled: false };
      };

      // Add job to active jobs first
      jobQueue.activeJobs.set(jobId, { type: 'exportTasks' });
      
      const result = await handleJobCompletion(jobId, completedJobResult);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(jobQueue.activeJobs.size, 0);
      assert.strictEqual(mockRedisClient.hset.mock.callCount(), 1);
    });

    test('should handle job failures correctly', async () => {
      const jobId = 'job456';
      const failedJobResult = {
        success: false,
        error: { message: 'Processing failed' }
      };

      // Mock Redis operations
      mockRedisClient.hset.mock.mockImplementation(() => Promise.resolve());

      // Simulate job failure handler
      const handleJobCompletion = async (jobId, result) => {
        const { success, error } = result;

        // Remove from active jobs
        jobQueue.activeJobs.delete(jobId);

        if (!success && !result.paused && !result.cancelled) {
          // Update job status to 'failed'
          await mockRedisClient.hset(`${jobQueue.jobStatusPrefix}${jobId}`, {
            status: 'failed',
            failedAt: Date.now(),
            error: error?.message || 'Unknown error'
          });

          return { handled: true, status: 'failed' };
        }

        return { handled: false };
      };

      // Add job to active jobs first
      jobQueue.activeJobs.set(jobId, { type: 'exportTasks' });
      
      const result = await handleJobCompletion(jobId, failedJobResult);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.status, 'failed');
      assert.strictEqual(jobQueue.activeJobs.size, 0);
      assert.strictEqual(mockRedisClient.hset.mock.callCount(), 1);
    });

    test('should handle job pause correctly', async () => {
      const jobId = 'job789';
      const pausedJobResult = {
        paused: true,
        progress: { processedItems: 50 }
      };

      // Mock Redis operations
      mockRedisClient.hset.mock.mockImplementation(() => Promise.resolve());

      // Simulate job pause handler
      const handleJobCompletion = async (jobId, result) => {
        const { paused, progress } = result;

        // Remove from active jobs
        jobQueue.activeJobs.delete(jobId);

        if (paused) {
          // Update job status to 'paused'
          await mockRedisClient.hset(`${jobQueue.jobStatusPrefix}${jobId}`, {
            status: 'paused',
            pausedAt: Date.now(),
            progress: JSON.stringify(progress || {})
          });

          return { handled: true, status: 'paused' };
        }

        return { handled: false };
      };

      // Add job to active jobs first
      jobQueue.activeJobs.set(jobId, { type: 'exportTasks' });
      
      const result = await handleJobCompletion(jobId, pausedJobResult);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.status, 'paused');
      assert.strictEqual(jobQueue.activeJobs.size, 0);
      assert.strictEqual(mockRedisClient.hset.mock.callCount(), 1);
    });

    test('should handle job cancellation correctly', async () => {
      const jobId = 'job999';
      const cancelledJobResult = {
        cancelled: true,
        error: { message: 'Cancelled by user' }
      };

      // Mock Redis operations
      mockRedisClient.hset.mock.mockImplementation(() => Promise.resolve());

      // Simulate job cancellation handler
      const handleJobCompletion = async (jobId, result) => {
        const { cancelled, error } = result;

        // Remove from active jobs
        jobQueue.activeJobs.delete(jobId);

        if (cancelled) {
          // Update job status to 'cancelled'
          await mockRedisClient.hset(`${jobQueue.jobStatusPrefix}${jobId}`, {
            status: 'cancelled',
            cancelledAt: Date.now(),
            error: error?.message || 'Export cancelled'
          });

          return { handled: true, status: 'cancelled' };
        }

        return { handled: false };
      };

      // Add job to active jobs first
      jobQueue.activeJobs.set(jobId, { type: 'exportTasks' });
      
      const result = await handleJobCompletion(jobId, cancelledJobResult);

      assert.strictEqual(result.handled, true);
      assert.strictEqual(result.status, 'cancelled');
      assert.strictEqual(jobQueue.activeJobs.size, 0);
      assert.strictEqual(mockRedisClient.hset.mock.callCount(), 1);
    });

    test('should recover stale jobs after system restart', async () => {
      const staleJobs = [
        {
          key: 'export-jobs:status:job1',
          status: 'processing',
          type: 'exportTasks',
          priority: '1',
          data: '{"format":"csv"}'
        },
        {
          key: 'export-jobs:status:job2',
          status: 'processing',
          type: 'exportTasks',
          priority: '2',
          data: '{"format":"json"}'
        },
        {
          key: 'export-jobs:status:job3',
          status: 'completed',
          type: 'exportTasks',
          priority: '1',
          data: '{"format":"csv"}'
        }
      ];

      // Mock MongoDB export job lookups
      mockExportJob.findById.mock.mockImplementation((id) => {
        if (id === 'job1') return Promise.resolve({ status: 'processing' });
        if (id === 'job2') return Promise.resolve({ status: 'processing' });
        if (id === 'job3') return Promise.resolve({ status: 'completed' });
        return Promise.resolve(null);
      });

      // Mock Redis operations
      const multiMock = {
        hset: mock.fn(),
        zadd: mock.fn(),
        exec: mock.fn(() => Promise.resolve([]))
      };
      mockRedisClient.multi.mock.mockImplementation(() => multiMock);
      mockRedisClient.del.mock.mockImplementation(() => Promise.resolve());

      // Simulate job recovery logic
      const recoverJobs = async (jobs) => {
        let recoveredCount = 0;
        let cleanedCount = 0;

        for (const job of jobs) {
          const jobId = job.key.replace('export-jobs:status:', '');
          
          // Only recover jobs in processing state
          if (job.status !== 'processing') {
            continue;
          }

          // Check MongoDB first
          const existingJob = await mockExportJob.findById(jobId);
          if (existingJob && ['completed', 'failed', 'cancelled'].includes(existingJob.status)) {
            // Job is already finished in MongoDB, clean up Redis
            await mockRedisClient.del(job.key);
            cleanedCount++;
            continue;
          }

          // Recover the job by resetting to pending and re-queuing
          const timestamp = Date.now();
          const priority = parseInt(job.priority || '0');
          const score = priority * 10000000000 + timestamp;

          const multi = mockRedisClient.multi();
          multi.hset(job.key, {
            status: 'pending',
            recoveredAt: timestamp,
            updatedAt: timestamp
          });
          multi.zadd('export-jobs', score, jobId);
          await multi.exec();
          
          recoveredCount++;
        }

        return { recoveredCount, cleanedCount };
      };

      const result = await recoverJobs(staleJobs);

      assert.strictEqual(result.recoveredCount, 2); // job1 and job2
      assert.strictEqual(result.cleanedCount, 0); // job3 is not cleaned because it's not processing
      assert.strictEqual(mockExportJob.findById.mock.callCount(), 2);
    });

    test('should remove jobs from queue correctly', async () => {
      const jobId = 'job123';

      // Mock Redis transaction
      const multiMock = {
        zrem: mock.fn(),
        del: mock.fn(),
        exec: mock.fn(() => Promise.resolve([[null, 1], [null, 1]])) // Both operations successful
      };
      mockRedisClient.multi.mock.mockImplementation(() => multiMock);

      // Simulate job removal
      const removeJob = async (jobId) => {
        // Remove from active jobs if currently processing
        jobQueue.activeJobs.delete(jobId);

        // Remove from sorted set queue and job status in a transaction
        const multi = mockRedisClient.multi();
        multi.zrem(jobQueue.queueName, jobId);
        multi.del(`${jobQueue.jobStatusPrefix}${jobId}`);
        
        const results = await multi.exec();
        
        // Check if job was actually removed from the queue
        const removedFromQueue = results && results[0] && results[0][1] > 0;
        
        return removedFromQueue;
      };

      // Add job to active jobs first
      jobQueue.activeJobs.set(jobId, { type: 'exportTasks' });
      
      const result = await removeJob(jobId);

      assert.strictEqual(result, true);
      assert.strictEqual(jobQueue.activeJobs.size, 0);
      assert.strictEqual(multiMock.zrem.mock.callCount(), 1);
      assert.strictEqual(multiMock.del.mock.callCount(), 1);
    });

    test('should cleanup old completed and failed jobs', async () => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      const jobKeys = [
        'export-jobs:status:job1',
        'export-jobs:status:job2',
        'export-jobs:status:job3',
        'export-jobs:status:job4'
      ];

      const jobStatuses = [
        { status: 'completed', completedAt: (now - 25 * 60 * 60 * 1000).toString() }, // 25 hours old
        { status: 'completed', completedAt: (now - 1 * 60 * 60 * 1000).toString() },  // 1 hour old
        { status: 'failed', failedAt: (now - 26 * 60 * 60 * 1000).toString() },       // 26 hours old
        { status: 'processing', startedAt: (now - 2 * 60 * 60 * 1000).toString() }    // 2 hours old
      ];

      // Mock Redis operations
      mockRedisClient.keys.mock.mockImplementation(() => Promise.resolve(jobKeys));
      
      let getCallCount = 0;
      mockRedisClient.hgetall.mock.mockImplementation(() => {
        return Promise.resolve(jobStatuses[getCallCount++]);
      });

      mockRedisClient.del.mock.mockImplementation(() => Promise.resolve());
      mockRedisClient.zrem.mock.mockImplementation(() => Promise.resolve());

      // Simulate cleanup logic
      const cleanup = async (maxAge = 86400000) => {
        const now = Date.now();
        const keys = await mockRedisClient.keys(`${jobQueue.jobStatusPrefix}*`);
        let cleanedCount = 0;

        for (const key of keys) {
          const jobStatus = await mockRedisClient.hgetall(key);

          if (!jobStatus) continue;

          if (['completed', 'failed'].includes(jobStatus.status)) {
            const completedAt = parseInt(jobStatus.completedAt || jobStatus.failedAt || '0');

            if (completedAt > 0 && (now - completedAt) > maxAge) {
              const jobId = key.replace(jobQueue.jobStatusPrefix, '');

              // Remove job status
              await mockRedisClient.del(key);

              // Also remove from queue if somehow still there
              await mockRedisClient.zrem(jobQueue.queueName, jobId);

              cleanedCount++;
            }
          }
        }

        return cleanedCount;
      };

      const cleanedCount = await cleanup(maxAge);

      assert.strictEqual(cleanedCount, 2); // job1 and job3 should be cleaned
      assert.strictEqual(mockRedisClient.del.mock.callCount(), 2);
      assert.strictEqual(mockRedisClient.zrem.mock.callCount(), 2);
    });

    test('should get job status correctly', async () => {
      const jobId = 'job123';
      const jobStatus = {
        status: 'processing',
        progress: '50',
        type: 'exportTasks',
        data: '{"format":"csv","filters":{"status":"completed"}}',
        result: '{"filename":"export.csv","totalItems":100}'
      };

      // Mock Redis get operation
      mockRedisClient.hgetall.mock.mockImplementation(() => Promise.resolve(jobStatus));

      // Simulate getJobStatus logic
      const getJobStatus = async (jobId) => {
        const jobStatus = await mockRedisClient.hgetall(`${jobQueue.jobStatusPrefix}${jobId}`);

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
      };

      const result = await getJobStatus(jobId);

      assert.strictEqual(result.id, jobId);
      assert.strictEqual(result.status, 'processing');
      assert.strictEqual(result.progress, '50');
      assert.deepStrictEqual(result.result, { filename: 'export.csv', totalItems: 100 });
      assert.deepStrictEqual(result.data, { format: 'csv', filters: { status: 'completed' } });
    });
  });
});