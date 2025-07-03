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
   * TTL for small export cache (in seconds)
   * @type {number}
   */
  smallExportCacheTTL: 3600, // 1 hour

  /**
   * TTL for medium export cache (in seconds)
   * @type {number}
   */
  mediumExportCacheTTL: 86400 // 24 hours

};

export default exportConfig;
