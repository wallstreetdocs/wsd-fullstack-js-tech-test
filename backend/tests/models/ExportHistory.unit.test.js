import { test, describe } from 'node:test';
import assert from 'node:assert';

// Import ExportHistory model
import ExportHistory from '../../src/models/ExportHistory.js';

describe('ExportHistory Model Behavior Tests', () => {
  test('creates valid export record with required fields', () => {
    const exportRecord = new ExportHistory({
      filename: 'tasks-export-2025-01-15.csv',
      format: 'csv',
      totalRecords: 150
    });

    assert(exportRecord.filename === 'tasks-export-2025-01-15.csv');
    assert(exportRecord.format === 'csv');
    assert(exportRecord.totalRecords === 150);
    assert(exportRecord.status === 'pending'); // default value
  });

  test('rejects export record missing required filename', () => {
    const exportRecord = new ExportHistory({
      format: 'csv',
      totalRecords: 150
    });

    const error = exportRecord.validateSync();
    assert(error);
    assert(error.errors.filename);
    assert(error.errors.filename.message.includes('required'));
  });

  test('rejects export record missing required format', () => {
    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      totalRecords: 150
    });

    const error = exportRecord.validateSync();
    assert(error);
    assert(error.errors.format);
  });

  test('rejects export record missing required totalRecords', () => {
    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv'
    });

    const error = exportRecord.validateSync();
    assert(error);
    assert(error.errors.totalRecords);
  });

  test('rejects invalid format values', () => {
    const exportRecord = new ExportHistory({
      filename: 'test.xml',
      format: 'xml',
      totalRecords: 150
    });

    const error = exportRecord.validateSync();
    assert(error);
    assert(error.errors.format);
  });

  test('accepts valid format values', () => {
    const csvRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv',
      totalRecords: 150
    });

    const jsonRecord = new ExportHistory({
      filename: 'test.json',
      format: 'json',
      totalRecords: 150
    });

    const csvError = csvRecord.validateSync();
    const jsonError = jsonRecord.validateSync();
    
    assert(csvError === undefined, `CSV validation failed: ${csvError?.message}`);
    assert(jsonError === undefined, `JSON validation failed: ${jsonError?.message}`);
  });

  test('rejects invalid status values', () => {
    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv',
      status: 'invalid_status',
      totalRecords: 150
    });

    const error = exportRecord.validateSync();
    assert(error);
    assert(error.errors.status);
  });

  test('accepts valid status values', () => {
    const statuses = ['pending', 'completed', 'failed'];
    
    statuses.forEach(status => {
      const exportRecord = new ExportHistory({
        filename: `test-${status}.csv`,
        format: 'csv',
        status,
        totalRecords: 150
      });

      assert(exportRecord.validateSync() === undefined);
      assert(exportRecord.status === status);
    });
  });

  test('rejects negative totalRecords', () => {
    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv',
      totalRecords: -1
    });

    const error = exportRecord.validateSync();
    assert(error);
    assert(error.errors.totalRecords);
  });

  test('rejects negative fileSizeBytes', () => {
    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv',
      totalRecords: 150,
      fileSizeBytes: -100
    });

    const error = exportRecord.validateSync();
    assert(error);
    assert(error.errors.fileSizeBytes);
  });

  test('rejects negative executionTimeMs', () => {
    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv',
      totalRecords: 150,
      executionTimeMs: -500
    });

    const error = exportRecord.validateSync();
    assert(error);
    assert(error.errors.executionTimeMs);
  });

  test('filePath virtual returns correct export path', () => {
    const exportRecord = new ExportHistory({
      filename: 'tasks-export-2025-01-15.csv',
      format: 'csv',
      totalRecords: 150
    });

    assert(exportRecord.filePath === 'exports/tasks-export-2025-01-15.csv');
  });

  test('toJSON removes mongoose internals and adds id', () => {
    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv',
      totalRecords: 150
    });

    const json = exportRecord.toJSON();

    // Should have id but not mongoose internals
    assert(json.id !== undefined);
    assert(json._id === undefined);
    assert(json.__v === undefined);

    // Should preserve actual data
    assert(json.filename === 'test.csv');
    assert(json.format === 'csv');
    assert(json.totalRecords === 150);
  });

  test('createExportRecord static method creates record with pending status', async () => {
    const data = {
      filename: 'test-export.csv',
      format: 'csv',
      totalRecords: 100,
      filters: { status: ['pending'] },
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent'
    };

    // Mock the save method since we're not connecting to DB
    const originalSave = ExportHistory.prototype.save;
    ExportHistory.prototype.save = async function() {
      return this;
    };

    try {
      const record = await ExportHistory.createExportRecord(data);
      
      assert(record.filename === data.filename);
      assert(record.format === data.format);
      assert(record.totalRecords === data.totalRecords);
      assert(record.status === 'pending');
      assert(record.ipAddress === data.ipAddress);
      assert(record.userAgent === data.userAgent);
    } finally {
      // Restore original save method
      ExportHistory.prototype.save = originalSave;
    }
  });

  test('markCompleted updates status and adds completion data', async () => {
    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv',
      totalRecords: 150,
      status: 'pending'
    });

    // Mock the save method
    const originalSave = ExportHistory.prototype.save;
    ExportHistory.prototype.save = async function() {
      return this;
    };

    try {
      const fileSizeBytes = 2048;
      const executionTimeMs = 3000;

      await exportRecord.markCompleted(fileSizeBytes, executionTimeMs);

      assert(exportRecord.status === 'completed');
      assert(exportRecord.fileSizeBytes === fileSizeBytes);
      assert(exportRecord.executionTimeMs === executionTimeMs);
    } finally {
      ExportHistory.prototype.save = originalSave;
    }
  });

  test('markFailed updates status and adds error information', async () => {
    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv',
      totalRecords: 150,
      status: 'pending'
    });

    // Mock the save method
    const originalSave = ExportHistory.prototype.save;
    ExportHistory.prototype.save = async function() {
      return this;
    };

    try {
      const errorMessage = 'Database connection timeout';
      const executionTimeMs = 1500;

      await exportRecord.markFailed(errorMessage, executionTimeMs);

      assert(exportRecord.status === 'failed');
      assert(exportRecord.errorMessage === errorMessage);
      assert(exportRecord.executionTimeMs === executionTimeMs);
    } finally {
      ExportHistory.prototype.save = originalSave;
    }
  });

  test('allows optional fields to be undefined', () => {
    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv',
      totalRecords: 150
      // All optional fields omitted
    });

    const error = exportRecord.validateSync();
    assert(error === undefined);

    // Optional fields should be undefined or have default values
    assert(exportRecord.fileSizeBytes === undefined);
    assert(exportRecord.executionTimeMs === undefined);
    assert(exportRecord.errorMessage === undefined);
    assert(exportRecord.ipAddress === undefined);
    assert(exportRecord.userAgent === undefined);
  });

  test('accepts filters as mixed data type', () => {
    const complexFilters = {
      status: ['pending', 'completed'],
      priority: ['high'],
      createdWithin: 'last-7-days',
      overdueTasks: true,
      estimatedTimeMin: 30
    };

    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv',
      totalRecords: 150,
      filters: complexFilters
    });

    const error = exportRecord.validateSync();
    assert(error === undefined);
    assert.deepStrictEqual(exportRecord.filters, complexFilters);
  });

  test('handles empty filters object', () => {
    const exportRecord = new ExportHistory({
      filename: 'test.csv',
      format: 'csv',
      totalRecords: 150,
      filters: {}
    });

    const error = exportRecord.validateSync();
    assert(error === undefined);
    assert.deepStrictEqual(exportRecord.filters, {});
  });

  test('validation works with realistic export data', () => {
    const realisticData = {
      filename: 'tasks-export-pending-completed-2025-01-15T10-30-00-000Z-abc123.csv',
      format: 'csv',
      status: 'completed',
      totalRecords: 247,
      fileSizeBytes: 25600,
      executionTimeMs: 4500,
      filters: {
        status: ['pending', 'completed'],
        priority: ['high'],
        createdWithin: 'last-30-days'
      },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    const exportRecord = new ExportHistory(realisticData);
    const error = exportRecord.validateSync();
    
    assert(error === undefined);
    Object.keys(realisticData).forEach(key => {
      if (key === 'filters') {
        assert.deepStrictEqual(exportRecord[key], realisticData[key]);
      } else {
        assert(exportRecord[key] === realisticData[key]);
      }
    });
  });
});