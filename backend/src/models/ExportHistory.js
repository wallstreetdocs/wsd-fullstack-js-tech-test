import mongoose from 'mongoose';

const exportHistorySchema = new mongoose.Schema({
  filters: Object,
  format: String,
  count: Number,
  filePath: String,
  downloadCount: {
    type: Number,
    default: 1
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: {
    type: Date
  }
});

export default mongoose.model('ExportHistory', exportHistorySchema);
