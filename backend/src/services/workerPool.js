/**
 * @fileoverview Worker thread pool for handling CPU-intensive tasks
 * @module services/workerPool
 */

import { Worker } from 'worker_threads';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';

// Calculate current directory to resolve worker script path
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Worker thread pool for handling CPU-intensive tasks
 * @extends EventEmitter
 */
class WorkerPool extends EventEmitter {
  /**
   * Creates a worker thread pool
   * @param {number} [numThreads] - Number of worker threads to create (defaults to CPU count)
   */
  constructor(numThreads = os.cpus().length) {
    super();
    this.workers = [];
    this.queue = [];
    this.activeWorkers = new Map(); // Track which workers are busy
    this.taskWorkerMap = new Map(); // Track taskId -> worker mapping for direct messaging
    this.numThreads = numThreads;
    this.initialized = false;
    this.isShuttingDown = false;
  }

  /**
   * Initialize the worker pool
   */
  initialize() {
    if (this.initialized || this.isShuttingDown) return;

    // Initialize the worker threads

    for (let i = 0; i < this.numThreads; i++) {
      this.addNewWorker(i);
    }

    this.initialized = true;
  }

  /**
   * Add a new worker to the pool
   * @private
   * @param {number} index - Index in the workers array (optional)
   * @returns {Worker} The created worker
   */
  addNewWorker(index = -1) {
    try {
      const worker = new Worker(path.resolve(__dirname, './exportWorker.js'));
      const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store worker ID for debugging
      worker.workerId = workerId;

      // Handle messages from worker
      worker.on('message', (message) => {
        // Special handling for job progress updates
        if (message && message.type === 'job-progress') {
          console.log(`[WorkerPool] Received job progress update from worker ${workerId}:`,
            `jobId=${message.jobId}, progress=${message.progress}%, items=${message.processedItems}/${message.totalItems}`);

          this.emit('job-progress', message);
          return;
        }

        // Handle other messages
        this.handleWorkerMessage(worker, message);
      });

      // Handle worker errors
      worker.on('error', (error) => this.handleWorkerError(worker, error));

      // Handle worker exit
      worker.on('exit', (code) => this.handleWorkerExit(worker, code));

      // Add worker to pool
      if (index >= 0 && index < this.workers.length) {
        this.workers[index] = worker;
      } else {
        this.workers.push(worker);
      }

      this.emit('worker-added', { workerId });
      return worker;
    } catch (error) {
      this.emit('worker-creation-error', { error });
      throw error;
    }
  }

  /**
   * Handle messages from worker threads
   * @private
   * @param {Worker} worker - Worker that sent the message
   * @param {Object} message - Message data
   */
  handleWorkerMessage(worker, message) {

    // Handle job progress updates
    if (message.type === 'job-progress') {
      this.emit('job-progress', message);
      return;
    }

    // Handle status updates
    if (message.type === 'status-update') {
      this.emit('task-status', message);
      return;
    }

    // Handle task completion/failure
    const taskId = this.activeWorkers.get(worker);
    if (taskId !== undefined) {
      // Find and complete the task with the result
      const taskIndex = this.queue.findIndex(task => task.id === taskId);
      if (taskIndex !== -1) {
        const task = this.queue[taskIndex];
        this.queue.splice(taskIndex, 1); // Remove from queue

        if (message.success) {
          task.resolve(message.result); // Resolve the promise with the result
          this.emit('task-completed', { taskId, workerId: worker.workerId });
        } else if (message.paused) {
          // Handle paused task - resolve with pause indicator
          task.resolve({ paused: true, progress: message.progress });
          this.emit('task-paused', {
            taskId,
            workerId: worker.workerId,
            progress: message.progress
          });
        } else {
          task.reject(new Error(message.error?.message || 'Unknown error'));
          this.emit('task-failed', {
            taskId,
            workerId: worker.workerId,
            error: message.error
          });
        }
      }

      // Mark worker as free
      this.activeWorkers.delete(worker);
      this.taskWorkerMap.delete(taskId);

      // Process next task if available
      if (!this.isShuttingDown) {
        this.processNextTask();
      }
    }
  }

  /**
   * Handle worker errors
   * @private
   * @param {Worker} worker - Worker that experienced an error
   * @param {Error} error - Error object
   */
  handleWorkerError(worker, error) {
    this.emit('worker-error', {
      workerId: worker.workerId,
      error
    });

    this.failWorkerTask(worker, error);
    this.replaceWorker(worker);
  }

  /**
   * Handle worker exits
   * @private
   * @param {Worker} worker - Worker that exited
   * @param {number} code - Exit code
   */
  handleWorkerExit(worker, code) {
    this.emit('worker-exit', {
      workerId: worker.workerId,
      code
    });

    this.failWorkerTask(worker, new Error('Worker terminated unexpectedly'));
    this.replaceWorker(worker);
  }

  /**
   * Fail any active task for a worker and clean up
   * @private
   * @param {Worker} worker - Worker that failed
   * @param {Error} error - Error that caused the failure
   */
  failWorkerTask(worker, error) {
    const taskId = this.activeWorkers.get(worker);
    if (taskId !== undefined) {
      const taskIndex = this.queue.findIndex(task => task.id === taskId);
      if (taskIndex !== -1) {
        const task = this.queue[taskIndex];
        this.queue.splice(taskIndex, 1);
        task.reject(error);

        this.emit('task-failed', {
          taskId,
          workerId: worker.workerId,
          error
        });
      }

      this.activeWorkers.delete(worker);
      this.taskWorkerMap.delete(taskId);

      if (!this.isShuttingDown) {
        this.processNextTask();
      }
    }
  }

  /**
   * Replace a worker with a new one
   * @private
   * @param {Worker} worker - Worker to replace
   */
  replaceWorker(worker) {
    if (this.isShuttingDown) return;

    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      try {
        worker.terminate();
      } catch (e) {
        // Ignore termination errors
      }

      try {
        this.addNewWorker(index);
      } catch (error) {
        // Failed to replace worker, but continue operation
      }
    }
  }

  /**
   * Add a task to the worker pool
   * @param {string} taskType - Type of task to execute
   * @param {Object} taskData - Data for the task
   * @returns {Promise<any>} - Result of the task execution
   */
  runTask(taskType, taskData) {
    if (this.isShuttingDown) {
      return Promise.reject(new Error('Worker pool is shutting down'));
    }

    if (!this.initialized) {
      this.initialize();
    }

    return new Promise((resolve, reject) => {
      // Create a unique ID for this task
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Add task to queue
      this.queue.push({
        id: taskId,
        type: taskType,
        data: taskData,
        resolve,
        reject,
        queued: true, // Flag to indicate the task is in queue but not yet assigned
        addedAt: Date.now() // For tracking how long tasks wait in queue
      });

      this.emit('task-queued', {
        taskId,
        type: taskType,
        queueLength: this.queue.length
      });

      // Try to process it immediately
      this.processNextTask();
    });
  }

  /**
   * Process the next task in the queue if a worker is available
   * @private
   */
  processNextTask() {
    if (this.isShuttingDown) return;

    // Find the next queued task
    const taskIndex = this.queue.findIndex(task => task.queued);
    if (taskIndex === -1) return; // No queued tasks

    // Find an available worker
    const availableWorker = this.workers.find(worker => !this.activeWorkers.has(worker));
    if (!availableWorker) return; // No available workers

    // Get and mark the task as not queued
    const task = this.queue[taskIndex];
    task.queued = false;
    task.startedAt = Date.now(); // Track when task started execution

    // Mark this worker as busy with this task
    this.activeWorkers.set(availableWorker, task.id);
    this.taskWorkerMap.set(task.id, availableWorker);

    this.emit('task-started', {
      taskId: task.id,
      workerId: availableWorker.workerId,
      waitTime: task.startedAt - task.addedAt
    });

    // Send the task to the worker
    try {
      availableWorker.postMessage({
        taskId: task.id,
        type: task.type,
        data: task.data
      });
    } catch (error) {
      console.error('Error sending task to worker:', error);

      // Handle error sending task to worker
      this.activeWorkers.delete(availableWorker);
      this.taskWorkerMap.delete(task.id);
      task.queued = true; // Re-queue the task

      this.replaceWorker(availableWorker);

      // Try another worker for this task
      setTimeout(() => this.processNextTask(), 100);
    }
  }

  /**
   * Send pause signal to worker handling specific task
   * @param {string} taskId - ID of the task to pause
   * @returns {boolean} - True if signal was sent, false if task/worker not found
   */
  pauseTask(taskId) {
    const worker = this.taskWorkerMap.get(taskId);
    if (worker) {
      try {
        worker.postMessage({ type: 'pause', taskId });
        return true;
      } catch (error) {
        console.error(`Error sending pause signal to worker for task ${taskId}:`, error);
        return false;
      }
    }
    return false;
  }

  /**
   * Send cancel signal to worker handling specific task
   * @param {string} taskId - ID of the task to cancel
   * @returns {boolean} - True if signal was sent, false if task/worker not found
   */
  cancelTask(taskId) {
    const worker = this.taskWorkerMap.get(taskId);
    if (worker) {
      try {
        worker.postMessage({ type: 'cancel', taskId });
        return true;
      } catch (error) {
        console.error(`Error sending cancel signal to worker for task ${taskId}:`, error);
        return false;
      }
    }
    return false;
  }

  /**
   * Get current worker pool status
   * @returns {Object} Status information about the worker pool
   */
  getStatus() {
    return {
      initialized: this.initialized,
      totalWorkers: this.workers.length,
      activeWorkers: this.activeWorkers.size,
      queueLength: this.queue.length,
      isShuttingDown: this.isShuttingDown
    };
  }

  /**
   * Shut down all workers in the pool
   */
  async shutdown() {
    if (this.isShuttingDown) return;

    // Begin worker pool shutdown process
    this.isShuttingDown = true;

    // Reject all queued tasks
    this.queue.forEach(task => {
      if (task.reject) {
        task.reject(new Error('Worker pool shutting down'));
      }
    });
    this.queue = [];

    // Terminate all workers
    const terminationPromises = this.workers.map(worker => {
      return new Promise(resolve => {
        worker.once('exit', () => resolve());
        try {
          worker.terminate();
        } catch (error) {
          // Log termination error but continue shutdown
          resolve();
        }
      });
    });

    await Promise.all(terminationPromises);
    this.workers = [];
    this.activeWorkers.clear();
    this.taskWorkerMap.clear();
    this.initialized = false;

    this.emit('shutdown-complete');
  }
}

// Create and export a singleton instance
const workerPool = new WorkerPool();
export default workerPool;
