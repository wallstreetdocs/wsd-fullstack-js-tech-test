import mongoose from 'mongoose';

const TaskExportSchema = new mongoose.Schema({
  requestedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  completedAt: Date,
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
    required: true
  },
  format: {
    type: String,
    enum: ['csv', 'json'],
    required: true
  },
  filters: {
    type: Object,
    default: {}
  },
  fileUrl: String, // Optional: for future use if you store files
  error: String
});

const TaskExport = mongoose.model('TaskExport', TaskExportSchema);

export default TaskExport;
