/**
 * @fileoverview Export job model for tracking task export progress
 * @module models/ExportJob
 */

import mongoose from 'mongoose';

const exportJobSchema = new mongoose.Schema(
  {
    format: {
      type: String,
      enum: ['csv', 'json'],
      required: true
    },
    filters: {
      status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed'],
        required: false
      },
      priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        required: false
      },
      sortBy: {
        type: String,
        default: 'createdAt',
        required: false
      },
      sortOrder: {
        type: String,
        enum: ['asc', 'desc'],
        default: 'desc',
        required: false
      }
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'paused'],
      default: 'pending'
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    totalItems: {
      type: Number,
      default: 0
    },
    processedItems: {
      type: Number,
      default: 0
    },
    result: {
      type: Buffer,
      required: false
    },
    error: {
      type: String,
      required: false
    },
    filename: {
      type: String,
      required: false
    },
    clientId: {
      type: String,
      required: false
    }
  },
  {
    timestamps: true
  }
);

// Add method to update progress
exportJobSchema.methods.updateProgress = function(processedItems, totalItems) {
  this.processedItems = processedItems;
  this.totalItems = totalItems;
  this.progress = Math.floor((processedItems / totalItems) * 100);
  return this.save();
};

// Add method to complete the job
exportJobSchema.methods.complete = function(result, filename) {
  this.status = 'completed';
  this.progress = 100;
  this.result = result;
  this.filename = filename;
  return this.save();
};

// Add method to mark job as failed
exportJobSchema.methods.fail = function(error) {
  this.status = 'failed';
  this.error = error.message || 'Unknown error';
  return this.save();
};

// Add method to pause job
exportJobSchema.methods.pause = function() {
  this.status = 'paused';
  return this.save();
};

// Add method to resume job
exportJobSchema.methods.resume = function() {
  this.status = 'processing';
  return this.save();
};

const ExportJob = mongoose.model('ExportJob', exportJobSchema);

export default ExportJob;