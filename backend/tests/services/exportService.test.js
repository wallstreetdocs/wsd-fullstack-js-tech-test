/**
 * @fileoverview Tests for ExportService functionality
 * @module tests/services/exportService.test
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import ExportService from '../../src/services/exportService.js';
import Task from '../../src/models/Task.js';
import Export from '../../src/models/Export.js';
import { connectMongoDB } from '../../src/config/database.js';
import { redisClient } from '../../src/config/redis.js';

describe('ExportService', () => {
  beforeEach(async () => {
    await connectMongoDB();
    await redisClient.flushdb();
    await Task.deleteMany({});
    await Export.deleteMany({});
  });

  afterEach(async () => {
    await Task.deleteMany({});
    await Export.deleteMany({});
    await redisClient.flushdb();
  });

  describe('generateCSV', () => {
    test('should generate CSV content from task data', () => {
      const tasks = [
        {
          title: 'Test Task 1',
          description: 'Test Description 1',
          status: 'completed',
          priority: 'high',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          completedAt: new Date('2024-01-03'),
          estimatedTime: 120,
          actualTime: 100
        }
      ];

      const csv = ExportService.generateCSV(tasks);

      assert(csv.includes('Title,Description,Status,Priority'));
      assert(csv.includes('Test Task 1'));
      assert(csv.includes('Test Description 1'));
      assert(csv.includes('completed'));
      assert(csv.includes('high'));
      assert(csv.includes('Under-estimated'));
    });

    test('should handle empty task array', () => {
      const csv = ExportService.generateCSV([]);
      assert(csv.includes('Title,Description,Status,Priority'));
      assert.strictEqual(csv.split('\n').length, 2); // Header + empty line
    });
  });

  describe('generateJSON', () => {
    test('should generate JSON content from task data', () => {
      const tasks = [
        {
          _id: 'test-id',
          title: 'Test Task 1',
          description: 'Test Description 1',
          status: 'completed',
          priority: 'high',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          completedAt: new Date('2024-01-03'),
          estimatedTime: 120,
          actualTime: 100
        }
      ];

      const json = ExportService.generateJSON(tasks);
      const parsed = JSON.parse(json);

      assert(parsed.exportInfo);
      assert.strictEqual(parsed.exportInfo.format, 'json');
      assert.strictEqual(parsed.exportInfo.recordCount, 1);
      assert.strictEqual(parsed.tasks.length, 1);
      assert.strictEqual(parsed.tasks[0].title, 'Test Task 1');
      assert.strictEqual(parsed.tasks[0].timeEfficiency, 'Under-estimated');
    });
  });

  describe('calculateTimeEfficiency', () => {
    test('should return "Over-estimated" when actual > estimated', () => {
      const task = { estimatedTime: 100, actualTime: 120 };
      assert.strictEqual(
        ExportService.calculateTimeEfficiency(task),
        'Over-estimated'
      );
    });

    test('should return "Under-estimated" when actual < estimated', () => {
      const task = { estimatedTime: 120, actualTime: 100 };
      assert.strictEqual(
        ExportService.calculateTimeEfficiency(task),
        'Under-estimated'
      );
    });

    test('should return "Accurate" when actual = estimated', () => {
      const task = { estimatedTime: 100, actualTime: 100 };
      assert.strictEqual(
        ExportService.calculateTimeEfficiency(task),
        'Accurate'
      );
    });

    test('should return "N/A" when missing time data', () => {
      const task = { estimatedTime: 100 };
      assert.strictEqual(ExportService.calculateTimeEfficiency(task), 'N/A');
    });
  });

  describe('createExport', () => {
    test('should create export record and generate file', async () => {
      // Create test tasks
      const task = new Task({
        title: 'Test Task',
        description: 'Test Description',
        status: 'completed',
        priority: 'high',
        estimatedTime: 120,
        actualTime: 100
      });
      await task.save();

      const exportRecord = await ExportService.createExport({
        format: 'csv',
        filters: { status: 'completed' },
        options: { sortBy: 'createdAt', sortOrder: 'desc' }
      });

      assert(exportRecord);
      assert.strictEqual(exportRecord.format, 'csv');
      assert.strictEqual(exportRecord.status, 'completed');
      assert.strictEqual(exportRecord.recordCount, 1);
      assert(exportRecord.filePath);
    });

    test('should handle export with no matching tasks', async () => {
      const exportRecord = await ExportService.createExport({
        format: 'json',
        filters: { status: 'completed' },
        options: { sortBy: 'createdAt', sortOrder: 'desc' }
      });

      assert(exportRecord);
      assert.strictEqual(exportRecord.format, 'json');
      assert.strictEqual(exportRecord.status, 'completed');
      assert.strictEqual(exportRecord.recordCount, 0);
    });

    test('should throw error for unsupported format', async () => {
      await assert.rejects(
        ExportService.createExport({
          format: 'xml',
          filters: {},
          options: {}
        }),
        /format.*is not a valid enum value/
      );
    });
  });

  describe('getExportHistory', () => {
    test('should return export history', async () => {
      // Create test exports
      const export1 = new Export({
        format: 'csv',
        status: 'completed',
        recordCount: 5
      });
      await export1.save();

      const export2 = new Export({
        format: 'json',
        status: 'completed',
        recordCount: 3
      });
      await export2.save();

      const history = await ExportService.getExportHistory({ limit: 10 });

      assert.strictEqual(history.length, 2);
      assert.strictEqual(history[0].format, 'json'); // Most recent first
      assert.strictEqual(history[1].format, 'csv');
    });
  });

  describe('downloadExport', () => {
    test('should download export file', async () => {
      // Create test task and export
      const task = new Task({
        title: 'Test Task',
        description: 'Test Description',
        status: 'completed',
        priority: 'high'
      });
      await task.save();

      const exportRecord = await ExportService.createExport({
        format: 'csv',
        filters: { status: 'completed' },
        options: {}
      });

      const fileData = await ExportService.downloadExport(exportRecord._id);

      assert(fileData);
      assert(fileData.content.includes('Test Task'));
      assert(fileData.filename.includes('.csv'));
      assert.strictEqual(fileData.format, 'csv');
    });

    test('should throw error for non-existent export', async () => {
      await assert.rejects(
        ExportService.downloadExport('non-existent-id'),
        /Cast to ObjectId failed/
      );
    });
  });
});
