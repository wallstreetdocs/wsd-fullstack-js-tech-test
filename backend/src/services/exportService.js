import { createObjectCsvStringifier } from 'csv-writer';
import ExcelJS from 'exceljs';
import Export from '../models/Export.js';
import Task from '../models/Task.js';
import {io, socketHandlers} from "../index.js";
import {redisClient} from "../config/redis.js";

class ExportService {
    constructor() {
        this.redis = redisClient;
        this.CACHE_TTL = 3600; // 1 hour
    }

    buildFilters(filters) {
        const query = {};

        if (filters.status) query.status = filters.status;
        if (filters.priority) query.priority = filters.priority;
        if (filters.dateRange) {
            query.createdAt = {
                $gte: new Date(filters.dateRange.start),
                $lte: new Date(filters.dateRange.end)
            };
        }

        return query;
    }

    async createExport(format, filters) {
        const exportDoc = new Export({
            format,
            filters,
            status: 'pending'
        });

        await exportDoc.save();
        socketHandlers.broadcastExportStatus(exportDoc._id, 'pending');

        this.processExport(exportDoc._id).catch(error => {
            console.error('Export processing error:', error);
        });

        return exportDoc._id;
    }

    async processExport(exportId) {
        const exportDoc = await Export.findById(exportId);
        if (!exportDoc) throw new Error('Export not found');

        try {
            await Export.findByIdAndUpdate(exportId, { status: 'processing' });
            socketHandlers.broadcastExportStatus(exportId, 'processing');

            // Get tasks with filters
            const tasks = await Task.find(this.buildFilters(exportDoc.filters));
            console.log(tasks)

            // Generate export based on format
            let result;
            switch (exportDoc.format) {
                case 'csv':
                    result = await this.generateCsv(tasks);
                    break;
                case 'xlsx':
                    result = await this.generateXlsx(tasks);
                    break;
                case 'json':
                    result = JSON.stringify(tasks);
                    break;
                default:
                    throw new Error('Unsupported format');
            }
            console.log(result)

            const cacheKey = `export:${exportId}`;
            await this.redis.setex(cacheKey, this.CACHE_TTL, result);

            await Export.findByIdAndUpdate(exportId, {
                status: 'completed',
                completedAt: new Date(),
                downloadUrl: `/api/exports/${exportId}/download`
            });

            socketHandlers.broadcastExportStatus(exportId, 'completed', {
                downloadUrl: `/api/exports/${exportId}/download`
            })

        } catch (error) {
            await Export.findByIdAndUpdate(exportId, {
                status: 'failed',
                error: error.message
            });

            socketHandlers.broadcastExportStatus(exportId, 'failed', {
                error: error.message
            });
        }
    }

    async generateCsv(tasks) {
        const csvStringifier = createObjectCsvStringifier({
            header: [
                { id: 'title', title: 'Title' },
                { id: 'description', title: 'Description' },
                { id: 'status', title: 'Status' },
                { id: 'priority', title: 'Priority' },
                { id: 'estimatedTime', title: 'Estimated Time (mins)' },
                { id: 'actualTime', title: 'Actual Time (mins)' },
                { id: 'createdAt', title: 'Created At' },
                { id: 'completedAt', title: 'Completed At' }
            ]
        });

        const records = tasks.map(task => ({
            ...task.toObject(),
            createdAt: task.createdAt.toISOString(),
            completedAt: task.completedAt?.toISOString() || ''
        }));

        return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
    }

    async generateXlsx(tasks) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Tasks');

        worksheet.columns = [
            { header: 'Title', key: 'title', width: 30 },
            { header: 'Description', key: 'description', width: 50 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Priority', key: 'priority', width: 15 },
            { header: 'Estimated Time', key: 'estimatedTime', width: 15 },
            { header: 'Actual Time', key: 'actualTime', width: 15 },
            { header: 'Created At', key: 'createdAt', width: 20 },
            { header: 'Completed At', key: 'completedAt', width: 20 }
        ];

        tasks.forEach(task => {
            worksheet.addRow({
                ...task.toObject(),
                createdAt: task.createdAt.toISOString(),
                completedAt: task.completedAt?.toISOString() || ''
            });
        });

        return await workbook.xlsx.writeBuffer();
    }

    async getExport(exportId) {
        const exportDoc = await Export.findById(exportId);
        if (!exportDoc) throw new Error('Export not found');
        return exportDoc;
    }

    async getExportContent(exportId) {
        const cacheKey = `export:${exportId}`;
        const cached = await this.redis.get(cacheKey);
        if (cached) return cached;

        const exportDoc = await Export.findById(exportId);
        if (!exportDoc || exportDoc.status !== 'completed') {
            throw new Error('Export not ready for download');
        }

        const tasks = await Task.find(this.buildFilters(exportDoc.filters));
        let result;

        switch (exportDoc.format) {
            case 'csv':
                result = await this.generateCsv(tasks);
                break;
            case 'xlsx':
                result = await this.generateXlsx(tasks);
                break;
            case 'json':
                result = JSON.stringify(tasks, null, 2);
                break;
            default:
                throw new Error('Unsupported format');
        }

        // Cache the regenerated result
        await this.redis.setEx(cacheKey, this.CACHE_TTL, result);
        return result;
    }

    async getExportHistory(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const exports = await Export.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('-result -filters -error');

        const total = await Export.countDocuments();

        return {
            exports,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async deleteExpiredFiles() {
        const result = await Export.deleteMany({
            expiresAt: { $lt: new Date() }
        });
        console.log(result)
        return {deletedCount: result.deletedCount};
    }
}

export default new ExportService();