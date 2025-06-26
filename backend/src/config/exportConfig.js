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
   * Threshold in bytes for medium exports that will be stored as temp files
   * Exports larger than this use temp file storage instead of memory buffers
   * @type {number}
   */
  mediumExportThreshold: 5 * 1024 * 1024, // 5MB

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