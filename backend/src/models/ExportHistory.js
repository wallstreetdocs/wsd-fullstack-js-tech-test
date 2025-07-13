/**
 * @fileoverview Export history model for tracking task export operations
 * @module models/ExportHistory
 */

import mongoose from 'mongoose';

/**
 * Schema for tracking export history and audit trail
 * @type {mongoose.Schema}
 */
const exportHistorySchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  format: {
    type: String,
    required: true,
    enum: ['csv', 'json'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  totalRecords: {
    type: Number,
    required: true,
    min: 0
  },
  fileSizeBytes: {
    type: Number,
    min: 0
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  executionTimeMs: {
    type: Number,
    min: 0
  },
  errorMessage: {
    type: String,
    trim: true
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for efficient querying
exportHistorySchema.index({ createdAt: -1 });
exportHistorySchema.index({ status: 1, createdAt: -1 });
exportHistorySchema.index({ format: 1, createdAt: -1 });
exportHistorySchema.index({ filename: 1 });

// Virtual for file path
exportHistorySchema.virtual('filePath').get(function() {
  return `exports/${this.filename}`;
});

/**
 * Static method to create new export history record
 * @static
 * @param {Object} data - Export data
 * @returns {Promise<ExportHistory>} Created export history record
 */
exportHistorySchema.statics.createExportRecord = async function(data) {
  const record = new this({
    filename: data.filename,
    format: data.format,
    totalRecords: data.totalRecords,
    filters: data.filters,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    status: 'pending'
  });
  return await record.save();
};

/**
 * Instance method to mark export as completed
 * @param {number} fileSizeBytes - Size of generated file
 * @param {number} executionTimeMs - Time taken to complete export
 * @returns {Promise<ExportHistory>} Updated export history record
 */
exportHistorySchema.methods.markCompleted = async function(fileSizeBytes, executionTimeMs) {
  this.status = 'completed';
  this.fileSizeBytes = fileSizeBytes;
  this.executionTimeMs = executionTimeMs;
  return await this.save();
};

/**
 * Instance method to mark export as failed
 * @param {string} errorMessage - Error description
 * @param {number} executionTimeMs - Time taken before failure
 * @returns {Promise<ExportHistory>} Updated export history record
 */
exportHistorySchema.methods.markFailed = async function(errorMessage, executionTimeMs) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.executionTimeMs = executionTimeMs;
  return await this.save();
};

export default mongoose.model('ExportHistory', exportHistorySchema);
