/**
 * @fileoverview Export configuration settings
 * @module config/exportConfig
 */

/**
 * Configuration for the export system
 * @type {Object}
 */
const exportConfig = {
  /**
   * Threshold in bytes for small exports that can be processed directly
   * Small exports are processed and returned immediately
   * @type {number}
   */
  smallExportThreshold: 200 * 1024, // 200KB

  /**
   * Threshold in bytes for medium exports that will be stored in MongoDB
   * Medium exports are processed in the background and stored in the database
   * @type {number}
   */
  mediumExportThreshold: 5 * 1024 * 1024, // 5MB

  /**
   * Maximum number of tasks that can be processed in a direct export
   * Used to determine whether to use direct or background processing
   * Lower value means more exports go through the worker process for better progress reporting
   * @type {number}
   */
  directExportTaskLimit: 50, // Reduced to ensure more exports go through the background worker

  /**
   * TTL for small export cache (in seconds)
   * @type {number}
   */
  smallExportCacheTTL: 3600, // 1 hour

  /**
   * TTL for medium export cache (in seconds)
   * @type {number}
   */
  mediumExportCacheTTL: 86400, // 24 hours

  /**
   * Batch size for processing tasks in streams
   * @type {number}
   */
  streamBatchSize: 100,

  /**
   * Memory usage threshold in bytes that triggers garbage collection
   * @type {number}
   */
  gcMemoryThreshold: 200 * 1024 * 1024, // 200MB
};

export default exportConfig;