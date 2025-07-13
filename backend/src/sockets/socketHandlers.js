/**
 * @fileoverview Socket.IO event handlers for real-time communication
 * @module sockets/SocketHandlers
 */

import AnalyticsService from '../services/analyticsService.js';

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
          socket.emit('analytics-error', {
            message: 'Failed to get analytics data'
          });
        }
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
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
   * Broadcasts export progress updates to all connected clients
   * @param {string} exportId - Export ID
   * @param {string} status - Export status (processing, completed, failed)
   * @param {string} message - Progress message
   * @param {number} [percentage] - Progress percentage (0-100)
   */
  async broadcastExportProgress(exportId, status, message, percentage = null) {
    const progressData = {
      exportId,
      status,
      message,
      percentage,
      timestamp: new Date().toISOString()
    };
    
    console.log('📡 Broadcasting export progress:', progressData);
    console.log('📡 Connected clients:', this.io.engine.clientsCount);
    
    this.io.emit('export-progress', progressData);
    
    // Small delay to ensure event is sent before next one
    await new Promise(resolve => setTimeout(resolve, 100));
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
