/**
 * @fileoverview Export History MongoDB model for tracking task exports
 * @module models/ExportHistory
 */

import { Schema, model } from 'mongoose';

/**
 * Export History Schema
 * Tracks all export operations for auditing and user reference
 */
const exportHistorySchema = new Schema({
  /**
   * Filters applied during export
   * @type {Object}
   */
  filters: {
    type: Schema.Types.Mixed,
    default: {}
  },

  /**
   * Export format (csv, json)
   * @type {String}
   */
  format: {
    type: String,
    required: true,
    enum: ['csv', 'json'],
    lowercase: true
  },

  /**
   * Number of records exported
   * @type {Number}
   */
  recordCount: {
    type: Number,
    required: true,
    min: 0
  },

  /**
   * Whether the export was served from cache
   * @type {Boolean}
   */
  fromCache: {
    type: Boolean,
    default: false
  },

  /**
   * Export execution time in milliseconds
   * @type {Number}
   */
  executionTime: {
    type: Number,
    min: 0
  },

  /**
   * User who requested the export (if authentication is implemented)
   * @type {ObjectId}
   */
  requestedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  /**
   * IP address of the requester
   * @type {String}
   */
  ipAddress: {
    type: String
  },

  /**
   * User agent of the requester
   * @type {String}
   */
  userAgent: {
    type: String
  },

  /**
   * Export timestamp
   * @type {Date}
   */
  exportedAt: {
    type: Date,
    default: Date.now,
    required: true
  },

  /**
   * Additional metadata
   * @type {Object}
   */
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'export_history'
});

// Indexes for performance
exportHistorySchema.index({ exportedAt: -1 });
exportHistorySchema.index({ format: 1 });
exportHistorySchema.index({ requestedBy: 1 });
exportHistorySchema.index({ fromCache: 1 });

// Virtual for human-readable export date
exportHistorySchema.virtual('exportedAtFormatted').get(function() {
  return this.exportedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for file size estimation (rough calculation)
exportHistorySchema.virtual('estimatedSize').get(function() {
  const avgBytesPerRecord = this.format === 'csv' ? 200 : 400;
  const sizeInBytes = this.recordCount * avgBytesPerRecord;

  if (sizeInBytes < 1024) return `${sizeInBytes} B`;
  if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
});

// Instance method to get filter summary
exportHistorySchema.methods.getFilterSummary = function() {
  const filters = this.filters;
  const summary = [];

  if (filters.status && filters.status !== 'all') {
    summary.push(`Status: ${filters.status}`);
  }

  if (filters.priority && filters.priority !== 'all') {
    summary.push(`Priority: ${filters.priority}`);
  }

  if (filters.search) {
    summary.push(`Search: "${filters.search}"`);
  }

  if (filters.dateFrom || filters.dateTo) {
    let dateRange = 'Date: ';
    if (filters.dateFrom) dateRange += `from ${new Date(filters.dateFrom).toLocaleDateString()}`;
    if (filters.dateTo) dateRange += ` to ${new Date(filters.dateTo).toLocaleDateString()}`;
    summary.push(dateRange);
  }

  if (filters.tags && filters.tags.length > 0) {
    const tags = Array.isArray(filters.tags.$in) ? filters.tags.$in : [filters.tags];
    summary.push(`Tags: ${tags.join(', ')}`);
  }

  return summary.length > 0 ? summary.join(', ') : 'All tasks';
};

// Static method to get export statistics
exportHistorySchema.statics.getExportStats = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await this.aggregate([
    {
      $match: {
        exportedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalExports: { $sum: 1 },
        totalRecords: { $sum: '$recordCount' },
        csvExports: {
          $sum: { $cond: [{ $eq: ['$format', 'csv'] }, 1, 0] }
        },
        jsonExports: {
          $sum: { $cond: [{ $eq: ['$format', 'json'] }, 1, 0] }
        },
        cacheHits: {
          $sum: { $cond: ['$fromCache', 1, 0] }
        },
        avgRecordsPerExport: { $avg: '$recordCount' }
      }
    }
  ]);

  return stats[0] || {
    totalExports: 0,
    totalRecords: 0,
    csvExports: 0,
    jsonExports: 0,
    cacheHits: 0,
    avgRecordsPerExport: 0
  };
};

// Enable virtuals in JSON output
exportHistorySchema.set('toJSON', { virtuals: true });
exportHistorySchema.set('toObject', { virtuals: true });

export default model('ExportHistory', exportHistorySchema);
