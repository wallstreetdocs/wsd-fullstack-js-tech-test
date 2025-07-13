/**
 * @fileoverview Export model definition with Mongoose schema for tracking export history
 * @module models/Export
 */

import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Mongoose schema for Export documents
 * @typedef {Object} ExportSchema
 * @property {string} format - Export format: 'csv' or 'json'
 * @property {Object} filters - Applied filters for the export
 * @property {Object} options - Export options (sorting, field selection, etc.)
 * @property {string} status - Export status: 'pending', 'processing', 'completed', 'failed'
 * @property {string} filePath - Path to the generated file
 * @property {number} recordCount - Number of records exported
 * @property {string} error - Error message if export failed
 * @property {Date} createdAt - Export creation timestamp
 * @property {Date} completedAt - Export completion timestamp
 * @property {string} cacheKey - Redis cache key for the export
 */
const exportSchema = new mongoose.Schema(
  {
    format: {
      type: String,
      enum: ['csv', 'json'],
      required: true,
      index: true
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    options: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    filePath: {
      type: String,
      default: null
    },
    recordCount: {
      type: Number,
      default: 0
    },
    error: {
      type: String,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    cacheKey: {
      type: String,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
exportSchema.index({ createdAt: -1 });
exportSchema.index({ status: 1, createdAt: -1 });
exportSchema.index({ format: 1, createdAt: -1 });

/**
 * Generate a cache key for the export based on filters, format, and options
 * @function generateCacheKey
 * @returns {string} Cache key
 */
exportSchema.methods.generateCacheKey = function () {
  const filterHash = JSON.stringify(this.filters);
  const formatHash = JSON.stringify(this.format);
  const optionsHash = JSON.stringify(this.options);
  const dataToHash = filterHash + formatHash + optionsHash;
  const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');
  const cacheKey = `export:${hash.slice(0, 16)}`;
  console.log('cacheKey :', cacheKey);
  return cacheKey;
};

/**
 * Mark export as completed
 * @function markCompleted
 * @param {string} filePath - Path to the generated file
 * @param {number} recordCount - Number of records exported
 */
exportSchema.methods.markCompleted = function (filePath, recordCount) {
  this.status = 'completed';
  this.filePath = filePath;
  this.recordCount = recordCount;
  this.completedAt = new Date();
  this.error = null;
};

/**
 * Mark export as failed
 * @function markFailed
 * @param {string} error - Error message
 */
exportSchema.methods.markFailed = function (error) {
  this.status = 'failed';
  this.error = error;
  this.completedAt = new Date();
};

/**
 * Static method to update export status
 * @static
 * @async
 * @param {string} exportId - Export ID
 * @param {string} status - New status
 * @param {string} [error] - Error message if failed
 * @returns {Promise<Object|null>} Updated export record
 */
exportSchema.statics.updateStatus = async function (
  exportId,
  status,
  error = null
) {
  const updateData = {
    status,
    updatedAt: new Date()
  };

  if (status === 'completed') {
    updateData.completedAt = new Date();
    updateData.error = null;
  } else if (status === 'failed') {
    updateData.completedAt = new Date();
    updateData.error = error;
  } else if (status === 'processing') {
    updateData.error = null;
  }

  return this.findByIdAndUpdate(exportId, updateData, {
    new: true,
    runValidators: true
  });
};

/**
 * Static method to find recent exports
 * @static
 * @async
 * @param {Object} [options={}] - Query options
 * @param {number} [options.limit=10] - Number of exports to return
 * @param {string} [options.status] - Filter by status
 * @param {string} [options.format] - Filter by format
 * @returns {Promise<Array>} Recent exports
 */
exportSchema.statics.findRecent = async function (options = {}) {
  const { limit = 10, status, format } = options;

  const query = {};
  if (status) query.status = status;
  if (format) query.format = format;

  return this.find(query).sort({ createdAt: -1 }).limit(limit);
};

/**
 * Static method to find export by cache key
 * @static
 * @async
 * @param {string} cacheKey - Cache key to search for
 * @returns {Promise<Object|null>} Export record or null
 */
exportSchema.statics.findByCacheKey = async function (cacheKey) {
  return this.findOne({ cacheKey }).sort({ createdAt: -1 });
};

/**
 * Static method to clean up old exports
 * @static
 * @async
 * @param {number} daysOld - Delete exports older than this many days
 * @returns {Promise<number>} Number of exports deleted
 */
exportSchema.statics.cleanupOld = async function (daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ['completed', 'failed'] }
  });

  return result.deletedCount;
};

/**
 * Export model for managing export documents in MongoDB
 * @type {mongoose.Model}
 */
const Export = mongoose.model('Export', exportSchema);

export default Export;
