/**
 * @fileoverview Service for broadcasting socket events for export progress updates
 * @module services/socketBroadcastService
 */

/**
 * Service class for broadcasting socket events
 * @class SocketBroadcastService
 */
class SocketBroadcastService {
  /**
   * Socket handlers reference for broadcasting
   * @static
   * @type {Object|null}
   */
  static socketHandlers = null;

  /**
   * Set socket handlers for broadcasting
   * @static
   * @param {Object} handlers - Socket handler object with broadcast methods
   */
  static setSocketHandlers(handlers) {
    this.socketHandlers = handlers;
    console.log('🔧 SocketBroadcastService: Socket handlers set');
  }

  /**
   * Broadcast export progress update
   * @static
   * @async
   * @param {string} exportId - Export ID
   * @param {string} status - Export status
   * @param {string} message - Progress message
   * @param {number} [percentage] - Progress percentage (0-100)
   */
  static async broadcastExportProgress(
    exportId,
    status,
    message,
    percentage = null
  ) {
    if (!this.socketHandlers) {
      console.log('⚠️ SocketBroadcastService: No socket handlers available');
      return;
    }

    try {
      await this.socketHandlers.broadcastExportProgress(
        exportId,
        status,
        message,
        percentage
      );
      console.log(
        `📡 SocketBroadcastService: Broadcasted export progress - ${exportId} -> ${status} (${percentage || 'N/A'}%)`
      );
    } catch (error) {
      console.error(
        '❌ SocketBroadcastService: Error broadcasting export progress:',
        error
      );
    }
  }

  /**
   * Broadcast export started event
   * @static
   * @async
   * @param {string} exportId - Export ID
   */
  static async broadcastExportStarted(exportId) {
    await this.broadcastExportProgress(
      exportId,
      'processing',
      'Starting export job...',
      5
    );
  }

  /**
   * Broadcast export fetching data event
   * @static
   * @async
   * @param {string} exportId - Export ID
   */
  static async broadcastExportFetching(exportId) {
    await this.broadcastExportProgress(
      exportId,
      'processing',
      'Fetching task data...',
      15
    );
  }

  /**
   * Broadcast export processing event
   * @static
   * @async
   * @param {string} exportId - Export ID
   * @param {number} taskCount - Number of tasks being processed
   */
  static async broadcastExportProcessing(exportId, taskCount) {
    await this.broadcastExportProgress(
      exportId,
      'processing',
      `Processing ${taskCount} tasks...`,
      40
    );
  }

  /**
   * Broadcast export file generation event
   * @static
   * @async
   * @param {string} exportId - Export ID
   */
  static async broadcastExportFileGeneration(exportId) {
    await this.broadcastExportProgress(
      exportId,
      'processing',
      'File generated, finalizing...',
      70
    );
  }

  /**
   * Broadcast export finalizing event
   * @static
   * @async
   * @param {string} exportId - Export ID
   */
  static async broadcastExportFinalizing(exportId) {
    await this.broadcastExportProgress(
      exportId,
      'processing',
      'Finalizing export...',
      85
    );
  }

  /**
   * Broadcast export completed event
   * @static
   * @async
   * @param {string} exportId - Export ID
   * @param {number} taskCount - Number of tasks exported
   */
  static async broadcastExportCompleted(exportId, taskCount) {
    await this.broadcastExportProgress(
      exportId,
      'completed',
      `Export completed: ${taskCount} tasks`,
      100
    );
  }

  /**
   * Broadcast export failed event
   * @static
   * @async
   * @param {string} exportId - Export ID
   * @param {string} errorMessage - Error message
   */
  static async broadcastExportFailed(exportId, errorMessage) {
    await this.broadcastExportProgress(
      exportId,
      'failed',
      `Export failed: ${errorMessage}`,
      0
    );
  }

  /**
   * Broadcast export queued event
   * @static
   * @async
   * @param {string} exportId - Export ID
   */
  static async broadcastExportQueued(exportId) {
    await this.broadcastExportProgress(
      exportId,
      'pending',
      'Export job added to queue',
      0
    );
  }

  /**
   * Broadcast custom progress update
   * @static
   * @async
   * @param {string} exportId - Export ID
   * @param {string} status - Export status
   * @param {string} message - Progress message
   * @param {number} percentage - Progress percentage (0-100)
   */
  static async broadcastCustomProgress(exportId, status, message, percentage) {
    await this.broadcastExportProgress(exportId, status, message, percentage);
  }
}

export default SocketBroadcastService;
