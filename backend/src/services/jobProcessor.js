/**
 * @fileoverview Background job processor for handling Redis queue jobs
 * @module services/jobProcessor
 */

import QueueService from './queueService.js';

/**
 * Background job processor for handling export jobs
 * @class JobProcessor
 */
class JobProcessor {
  /**
   * Start the job processor
   * @static
   * @async
   */
  static async start() {
    console.log('🚀 Starting background job processor...');

    // Start processing export jobs
    QueueService.processExportJobs().catch((error) => {
      console.error('❌ Job processor error:', error);
    });
  }

  /**
   * Stop the job processor (for graceful shutdown)
   * @static
   */
  static stop() {
    console.log('🛑 Stopping background job processor...');
    // In a real implementation, you might want to set a flag to stop the while loop
    // For now, we'll just log the stop event
  }

  /**
   * Get queue statistics
   * @static
   * @async
   * @returns {Promise<Object>} Queue statistics
   */
  static async getStats() {
    const queueLength = await QueueService.getQueueLength();

    return {
      queueLength,
      processorStatus: 'running',
      timestamp: new Date().toISOString()
    };
  }
}

export default JobProcessor;
