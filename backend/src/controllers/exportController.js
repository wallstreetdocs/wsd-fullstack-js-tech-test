import fs from 'fs';
import path from 'path';
import { redisClient } from '../config/redis.js';
import { io } from '../index.js';
import ExportHistory from '../models/ExportHistory.js';
import Task from '../models/Task.js';
import { buildTaskQuery } from '../services/taskFilterService.js';
import { exportToCSV } from '../utils/exportUtils.js';

export const exportTasks = async (req, res, next) => {
  try {
    const { filters, format = 'csv' } = req.body;
    const cacheKey = `export:${JSON.stringify(filters)}:${format}`;

    // 1. Check Redis cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      io.emit('exportProgress', { status: 'cached' });

      // Reuse file if it exists
      const existing = await ExportHistory.findOne({ filters, format }).sort({
        createdAt: -1
      });
      if (existing && existing.filePath && fs.existsSync(existing.filePath)) {
        // Increment count instead of creating duplicate history
        existing.downloadCount = (existing.downloadCount || 1) + 1;
        await existing.save();

        const fileName = path.basename(existing.filePath);
        res.setHeader(
          'Content-Type',
          format === 'csv' ? 'text/csv' : 'application/json'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}"`
        );
        return res.send(fs.readFileSync(existing.filePath));
      }

      // If file not found, regenerate from cached content
      const buffer = Buffer.from(cached, 'utf-8');
      const fileName = `tasks-export-${Date.now()}.${format}`;
      const filePath = path.join('exports', fileName);
      fs.mkdirSync('exports', { recursive: true });
      fs.writeFileSync(filePath, buffer);

      await ExportHistory.create({
        filters,
        format,
        count: Array.isArray(JSON.parse(cached))
          ? JSON.parse(cached).length
          : 0,
        filePath,
        downloadCount: 1,
        createdAt: new Date()
      });

      res.setHeader(
        'Content-Type',
        format === 'csv' ? 'text/csv' : 'application/json'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`
      );
      return res.send(buffer);
    }

    // 2. No cache — generate fresh export
    io.emit('exportProgress', { status: 'processing', percent: 0 });

    const query = buildTaskQuery(filters);
    const tasks = await Task.find(query).lean();

    const fileName = `tasks-export-${Date.now()}.${format}`;
    const filePath = path.join('exports', fileName);
    fs.mkdirSync('exports', { recursive: true });

    let fileContent;
    if (format === 'csv') {
      fileContent = await exportToCSV(tasks);
    } else {
      fileContent = JSON.stringify(tasks, null, 2);
    }

    // Save file
    fs.writeFileSync(filePath, fileContent);

    // Cache for 1 hour
    await redisClient.set(cacheKey, fileContent, 'EX', 3600);

    // Save or update export history
    const existingHistory = await ExportHistory.findOne({ filters, format });
    if (existingHistory) {
      existingHistory.count = tasks.length;
      existingHistory.filePath = filePath;
      existingHistory.downloadCount = (existingHistory.downloadCount || 1) + 1;
      existingHistory.updatedAt = new Date();
      await existingHistory.save();
    } else {
      await ExportHistory.create({
        filters,
        format,
        count: tasks.length,
        filePath,
        downloadCount: 1,
        createdAt: new Date()
      });
    }

    res.setHeader(
      'Content-Type',
      format === 'csv' ? 'text/csv' : 'application/json'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(fileContent);
  } catch (error) {
    console.error('Export error:', error);
    io.emit('exportProgress', { status: 'error', message: error.message });
    next(error);
  }
};

export const getExportHistory = async (req, res, next) => {
  try {
    const history = await ExportHistory.find().sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    next(error);
  }
};

export const downloadExportFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await ExportHistory.findById(id);
    if (!record || !record.filePath) {
      return res.status(404).json({ message: 'Export file not found' });
    }
    const absPath = path.resolve(record.filePath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ message: 'File does not exist' });
    }
    res.download(absPath);
  } catch (error) {
    next(error);
  }
};
