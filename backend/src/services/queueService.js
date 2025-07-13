/**
 * @fileoverview Redis queue service for handling export jobs asynchronously
 * @module services/queueService
 */

import { redisClient } from '../config/redis.js';
import ExportService from './exportService.js';
import Export from '../models/Export.js';
import SocketBroadcastService from './socketBroadcastService.js';

/**
 * Queue service for managing export jobs
 * @class QueueService
 */
class QueueService {
  /**
   * Queue name for export jobs
   * @static
   * @type {string}
   */
  static EXPORT_QUEUE = 'export_queue';

  /**
   * Add export job to queue
   * @static
   * @async
   * @param {Object} jobData - Export job data
   * @param {string} jobData.exportId - Export ID
   * @param {string} jobData.format - Export format
   * @param {Object} jobData.filters - Task filters
   * @param {Object} jobData.options - Export options
   * @returns {Promise<void>}
   */
  static async addExportJob(jobData) {
    const job = {
      id: jobData.exportId,
      type: 'export',
      data: jobData,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    await redisClient.lpush(this.EXPORT_QUEUE, JSON.stringify(job));
    console.log('📦 Export job added to queue:', job.id);
  }

  /**
   * Update export status in database and emit socket event
   * @static
   * @async
   * @param {string} exportId - Export ID
   * @param {string} status - Export status
   * @param {string} message - Status message
   * @param {string} [error] - Error message if failed
   */
  static async updateExportStatus(exportId, status, message, error = null) {
    try {
      // Update status in database
      const updatedExport = await Export.updateStatus(exportId, status, error);

      if (updatedExport) {
        console.log(`📊 Export status updated: ${exportId} -> ${status}`);

        // Emit socket event
        await SocketBroadcastService.broadcastExportProgress(
          exportId,
          status,
          message
        );
      } else {
        console.error(`❌ Failed to update export status: ${exportId}`);
      }
    } catch (error) {
      console.error(`❌ Error updating export status: ${exportId}`, error);
    }
  }

  /**
   * Process export jobs from queue
   * @static
   * @async
   */
  static async processExportJobs() {
    console.log('🔄 Starting export job processor...');

    while (true) {
      try {
        // Wait for job with timeout
        const result = await redisClient.brpop(this.EXPORT_QUEUE, 5);

        if (!result) {
          // No jobs available, continue polling
          continue;
        }

        const [, jobJson] = result;
        const job = JSON.parse(jobJson);

        console.log('🔧 Processing export job:', job.id);

        // Update job status to processing in database
        await this.updateExportStatus(
          job.id,
          'processing',
          'Starting export job...'
        );

        // Broadcast export started
        await SocketBroadcastService.broadcastExportStarted(job.id);

        try {
          // Process the export
          const { format, filters, options, exportId } = job.data;

          await ExportService.createExport({
            format,
            filters,
            options,
            exportId
          });

          // Update job status to completed in database
          await this.updateExportStatus(
            job.id,
            'completed',
            'Export completed successfully'
          );

          console.log('✅ Export job completed:', job.id);
        } catch (error) {
          console.error('❌ Export job failed:', job.id, error.message);

          // Update job status to failed in database
          await this.updateExportStatus(
            job.id,
            'failed',
            `Export failed: ${error.message}`,
            error.message
          );

          // Broadcast failure
          await SocketBroadcastService.broadcastExportFailed(
            job.id,
            error.message
          );
        }
      } catch (error) {
        console.error('❌ Error processing export job:', error);
        // Continue processing other jobs
      }
    }
  }

  /**
   * Get job status from database
   * @static
   * @async
   * @param {string} jobId - Job ID
   * @returns {Promise<Object|null>} Job status
   */
  static async getJobStatus(jobId) {
    const exportRecord = await Export.findById(jobId);

    if (exportRecord) {
      return {
        status: exportRecord.status,
        updatedAt: exportRecord.updatedAt,
        error: exportRecord.error,
        completedAt: exportRecord.completedAt
      };
    }

    return null;
  }

  /**
   * Get queue length
   * @static
   * @async
   * @returns {Promise<number>} Number of jobs in queue
   */
  static async getQueueLength() {
    return await redisClient.llen(this.EXPORT_QUEUE);
  }

  /**
   * Clear all jobs from queue
   * @static
   * @async
   */
  static async clearQueue() {
    await redisClient.del(this.EXPORT_QUEUE);
    console.log('🧹 Export queue cleared');
  }
}

export default QueueService;
