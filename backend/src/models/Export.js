import mongoose from 'mongoose';

const exportSchema = new mongoose.Schema({
    format: {
        type: String,
        enum: ['csv', 'json', 'xlsx'],
        required: true
    },
    filters: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        index: true
    },
    result: {
        type: String,
        default: null
    },
    error: {
        type: String,
        default: null
    },
    downloadUrl: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    completedAt: {
        type: Date,
        default: null
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }
}, {
    timestamps: true
});

const Export = mongoose.model('Export', exportSchema);
export default Export;