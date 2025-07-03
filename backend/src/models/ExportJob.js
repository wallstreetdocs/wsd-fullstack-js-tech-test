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
      required: true,
      set: function(value) {
        // Always normalize to lowercase and validate
        const normalizedValue = String(value).toLowerCase();
        // Only allow 'json' or 'csv', default to 'csv'
        return normalizedValue === 'json' ? 'json' : 'csv';
      }
    },
    filters: {
      // Basic filters (original)
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
      },

      // Advanced filters
      search: {
        type: String,
        required: false
      },
      createdAfter: {
        type: Date,
        required: false
      },
      createdBefore: {
        type: Date,
        required: false
      },
      completedAfter: {
        type: Date,
        required: false
      },
      completedBefore: {
        type: Date,
        required: false
      },
      estimatedTimeLt: {
        type: Number,
        required: false
      },
      estimatedTimeGte: {
        type: Number,
        required: false
      }
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'paused', 'cancelled'],
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
    },
    fileSize: {
      type: Number,
      required: false
    },
    storageType: {
      type: String,
      enum: ['tempFile'],
      default: 'tempFile'
    },
    tempFilePath: {
      type: String,
      required: false
    },
    refreshCache: {
      type: Boolean,
      default: false
    },
    lastCheckpointItems: {
      type: Number,
      default: 0
    },
    lastCheckpointFileSize: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const ExportJob = mongoose.model('ExportJob', exportJobSchema);

export default ExportJob;
