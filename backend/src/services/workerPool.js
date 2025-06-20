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
    this.numThreads = numThreads;
    this.initialized = false;
    this.workerErrorCount = new Map(); // Track error count per worker
    this.maxErrors = 3; // Maximum errors before replacing a worker
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
    
    // Periodically check worker health
    this.healthCheckInterval = setInterval(() => this.checkWorkerHealth(), 60000);
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
      this.workerErrorCount.set(workerId, 0);
      
      // Handle messages from worker
      worker.on('message', (message) => {
        // Special handling for progress updates
        if (message && message.type === 'progress') {
          this.emit('task-progress', message);
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
    // Reset error count on successful message
    if (worker.workerId && message.success !== false) {
      this.workerErrorCount.set(worker.workerId, 0);
    }
    
    // Handle progress updates
    if (message.type === 'progress') {
      this.emit('task-progress', message);
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
    
    // Increment error count for this worker
    if (worker.workerId) {
      const currentCount = this.workerErrorCount.get(worker.workerId) || 0;
      this.workerErrorCount.set(worker.workerId, currentCount + 1);
    }
    
    this.emit('worker-error', { 
      workerId: worker.workerId,
      error 
    });
    
    // Get the task that this worker was processing
    const taskId = this.activeWorkers.get(worker);
    if (taskId !== undefined) {
      // Find and reject the task with the error
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
      
      // Mark worker as free
      this.activeWorkers.delete(worker);
      
      // Process next task if available
      if (!this.isShuttingDown) {
        this.processNextTask();
      }
    }
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
    
    // Clean up error tracking
    if (worker.workerId) {
      this.workerErrorCount.delete(worker.workerId);
    }
    
    // Replace the worker if not shutting down
    if (!this.isShuttingDown) {
      const index = this.workers.indexOf(worker);
      if (index !== -1) {
        try {
          const newWorker = this.addNewWorker(index);
          
          // If the worker was processing a task, mark it as failed
          const taskId = this.activeWorkers.get(worker);
          if (taskId !== undefined) {
            const taskIndex = this.queue.findIndex(task => task.id === taskId);
            if (taskIndex !== -1) {
              const task = this.queue[taskIndex];
              this.queue.splice(taskIndex, 1);
              task.reject(new Error('Worker terminated unexpectedly'));
              
              this.emit('task-failed', { 
                taskId, 
                workerId: worker.workerId,
                error: new Error('Worker terminated unexpectedly')
              });
            }
            
            // Clean up the mapping
            this.activeWorkers.delete(worker);
          }
        } catch (error) {
          // Failed to replace worker, but continue operation
        }
      }
    }
  }

  /**
   * Check health of all workers and replace if needed
   * @private
   */
  checkWorkerHealth() {
    if (this.isShuttingDown) return;
    
    this.workers.forEach((worker, index) => {
      if (worker.workerId) {
        const errorCount = this.workerErrorCount.get(worker.workerId) || 0;
        
        // Replace workers with too many errors
        if (errorCount >= this.maxErrors) {
          
          // Terminate the problematic worker
          try {
            worker.terminate();
          } catch (e) {
            // Error handling when terminating worker
          }
          
          // Create a replacement
          try {
            this.addNewWorker(index);
          } catch (error) {
            // Non-critical error when replacing worker
          }
        }
      }
    });
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
      task.queued = true; // Re-queue the task
      
      // Increment error count for this worker
      if (availableWorker.workerId) {
        const currentCount = this.workerErrorCount.get(availableWorker.workerId) || 0;
        this.workerErrorCount.set(availableWorker.workerId, currentCount + 1);
        
        // If too many errors, replace the worker
        if (currentCount + 1 >= this.maxErrors) {
          const index = this.workers.indexOf(availableWorker);
          if (index !== -1) {
            try {
              console.warn(`Replacing problematic worker ${availableWorker.workerId}`);
              availableWorker.terminate();
              this.addNewWorker(index);
            } catch (e) {
              console.error('Error replacing worker:', e);
            }
          }
        }
      }
      
      // Try another worker for this task
      setTimeout(() => this.processNextTask(), 100);
    }
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
    
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
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
    this.workerErrorCount.clear();
    this.initialized = false;
    
    this.emit('shutdown-complete');
  }
}

// Create and export a singleton instance
const workerPool = new WorkerPool();
export default workerPool;