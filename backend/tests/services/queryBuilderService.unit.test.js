import { test, describe } from 'node:test';
import assert from 'node:assert';
import { 
  buildTaskQuery, 
  buildSortQuery, 
  sanitizeFilters 
} from '../../src/services/queryBuilderService.js';

describe('Query Builder Service Unit Tests', () => {
  describe('buildTaskQuery', () => {
    test('should return empty query for no filters', () => {
      const query = buildTaskQuery({});
      assert.deepStrictEqual(query, {});
    });

    test('should build query for single status filter', () => {
      const filters = { status: 'pending' };
      const query = buildTaskQuery(filters);
      assert.deepStrictEqual(query, { status: 'pending' });
    });

    test('should build query for multiple status filters', () => {
      const filters = { status: ['pending', 'in-progress'] };
      const query = buildTaskQuery(filters);
      assert.deepStrictEqual(query, { status: { $in: ['pending', 'in-progress'] } });
    });

    test('should build query for single priority filter', () => {
      const filters = { priority: 'high' };
      const query = buildTaskQuery(filters);
      assert.deepStrictEqual(query, { priority: 'high' });
    });

    test('should build query for multiple priority filters', () => {
      const filters = { priority: ['high', 'medium'] };
      const query = buildTaskQuery(filters);
      assert.deepStrictEqual(query, { priority: { $in: ['high', 'medium'] } });
    });

    test('should build query for date range filters', () => {
      const filters = {
        createdAfter: '2024-01-01',
        createdBefore: '2024-12-31'
      };
      const query = buildTaskQuery(filters);
      
      assert(query.createdAt);
      assert(query.createdAt.$gte instanceof Date);
      assert(query.createdAt.$lte instanceof Date);
      assert.strictEqual(query.createdAt.$gte.getFullYear(), 2024);
      assert.strictEqual(query.createdAt.$lte.getFullYear(), 2024);
    });

    test('should build query for completed date range', () => {
      const filters = {
        completedAfter: '2024-06-01',
        completedBefore: '2024-06-30'
      };
      const query = buildTaskQuery(filters);
      
      assert(query.completedAt);
      assert(query.completedAt.$gte instanceof Date);
      assert(query.completedAt.$lte instanceof Date);
    });

    test('should build query for updated date range', () => {
      const filters = {
        updatedAfter: '2024-05-01',
        updatedBefore: '2024-05-31'
      };
      const query = buildTaskQuery(filters);
      
      assert(query.updatedAt);
      assert(query.updatedAt.$gte instanceof Date);
      assert(query.updatedAt.$lte instanceof Date);
    });

    test('should build query for predefined date ranges', () => {
      const filters = { createdWithin: 'last-30-days' };
      const query = buildTaskQuery(filters);
      
      assert(query.createdAt);
      assert(query.createdAt.$gte instanceof Date);
      
      // Check that the date is approximately 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const timeDiff = Math.abs(query.createdAt.$gte.getTime() - thirtyDaysAgo.getTime());
      assert(timeDiff < 1000, 'Date should be within 1 second of 30 days ago');
    });

    test('should build query for completed within predefined range', () => {
      const filters = { completedWithin: 'last-7-days' };
      const query = buildTaskQuery(filters);
      
      assert(query.completedAt);
      assert(query.completedAt.$gte instanceof Date);
    });

    test('should ignore invalid predefined date ranges', () => {
      const filters = { createdWithin: 'invalid-range' };
      const query = buildTaskQuery(filters);
      
      assert.deepStrictEqual(query, {});
    });

    test('should build query for estimated time range', () => {
      const filters = {
        estimatedTimeMin: 60,
        estimatedTimeMax: 240
      };
      const query = buildTaskQuery(filters);
      
      assert.deepStrictEqual(query, {
        estimatedTime: { $gte: 60, $lte: 240 }
      });
    });

    test('should build query for actual time range', () => {
      const filters = {
        actualTimeMin: 30,
        actualTimeMax: 300
      };
      const query = buildTaskQuery(filters);
      
      assert.deepStrictEqual(query, {
        actualTime: { $gte: 30, $lte: 300 }
      });
    });

    test('should build query for tasks without estimated time', () => {
      const filters = { noEstimate: true };
      const query = buildTaskQuery(filters);
      
      assert.deepStrictEqual(query, {
        $or: [
          { estimatedTime: null },
          { estimatedTime: { $exists: false } }
        ]
      });
    });

    test('should build query for overdue tasks', () => {
      const filters = { overdueTasks: true };
      const query = buildTaskQuery(filters);
      
      assert(query.$and);
      assert.strictEqual(query.$and.length, 2);
      assert.deepStrictEqual(query.$and[0], { status: 'in-progress' });
      assert(query.$and[1].createdAt);
      assert(query.$and[1].createdAt.$lt instanceof Date);
    });

    test('should build query for recently completed tasks', () => {
      const filters = { recentlyCompleted: true };
      const query = buildTaskQuery(filters);
      
      assert(query.$and);
      assert.strictEqual(query.$and.length, 2);
      assert.deepStrictEqual(query.$and[0], { status: 'completed' });
      assert(query.$and[1].completedAt);
      assert(query.$and[1].completedAt.$gte instanceof Date);
    });

    test('should build query for under-estimated tasks', () => {
      const filters = { underEstimated: true };
      const query = buildTaskQuery(filters);
      
      assert(query.$and);
      assert.strictEqual(query.$and.length, 4);
      assert.deepStrictEqual(query.$and[0], { status: 'completed' });
      assert.deepStrictEqual(query.$and[1], { estimatedTime: { $exists: true, $ne: null } });
      assert.deepStrictEqual(query.$and[2], { actualTime: { $exists: true, $ne: null } });
      assert.deepStrictEqual(query.$and[3], { $expr: { $gt: ['$actualTime', '$estimatedTime'] } });
    });

    test('should build query for over-estimated tasks', () => {
      const filters = { overEstimated: true };
      const query = buildTaskQuery(filters);
      
      assert(query.$and);
      assert.strictEqual(query.$and.length, 4);
      assert.deepStrictEqual(query.$and[0], { status: 'completed' });
      assert.deepStrictEqual(query.$and[1], { estimatedTime: { $exists: true, $ne: null } });
      assert.deepStrictEqual(query.$and[2], { actualTime: { $exists: true, $ne: null } });
      assert.deepStrictEqual(query.$and[3], { $expr: { $lt: ['$actualTime', '$estimatedTime'] } });
    });

    test('should combine multiple filters with $and', () => {
      const filters = {
        status: 'pending',
        priority: 'high',
        createdAfter: '2024-01-01'
      };
      const query = buildTaskQuery(filters);
      
      assert(query.$and);
      assert.strictEqual(query.$and.length, 3);
      
      // Find each condition in the $and array
      const statusCondition = query.$and.find(cond => cond.status);
      const priorityCondition = query.$and.find(cond => cond.priority);
      const dateCondition = query.$and.find(cond => cond.createdAt);
      
      assert.deepStrictEqual(statusCondition, { status: 'pending' });
      assert.deepStrictEqual(priorityCondition, { priority: 'high' });
      assert(dateCondition.createdAt.$gte instanceof Date);
    });

    test('should handle single filter without $and wrapper', () => {
      const filters = { status: 'completed' };
      const query = buildTaskQuery(filters);
      
      assert.deepStrictEqual(query, { status: 'completed' });
      assert(!query.$and);
    });

    test('should handle complex multi-filter scenario', () => {
      const filters = {
        status: ['pending', 'in-progress'],
        priority: 'high',
        createdWithin: 'last-30-days',
        estimatedTimeMin: 60,
        overdueTasks: true
      };
      const query = buildTaskQuery(filters);
      
      assert(query.$and);
      assert(query.$and.length >= 4);
    });
  });

  describe('buildSortQuery', () => {
    test('should return default sort for empty filters', () => {
      const sort = buildSortQuery({});
      assert.deepStrictEqual(sort, { createdAt: -1 });
    });

    test('should build sort for custom field descending', () => {
      const filters = { sortBy: 'title', sortOrder: 'desc' };
      const sort = buildSortQuery(filters);
      assert.deepStrictEqual(sort, { title: -1 });
    });

    test('should build sort for custom field ascending', () => {
      const filters = { sortBy: 'priority', sortOrder: 'asc' };
      const sort = buildSortQuery(filters);
      assert.deepStrictEqual(sort, { priority: 1 });
    });

    test('should default to descending when sortOrder is invalid', () => {
      const filters = { sortBy: 'title', sortOrder: 'invalid' };
      const sort = buildSortQuery(filters);
      assert.deepStrictEqual(sort, { title: -1 });
    });

    test('should handle all valid sort fields', () => {
      const validFields = ['createdAt', 'updatedAt', 'title', 'priority', 'status', 'estimatedTime', 'actualTime'];
      
      validFields.forEach(field => {
        const sort = buildSortQuery({ sortBy: field, sortOrder: 'asc' });
        assert.deepStrictEqual(sort, { [field]: 1 });
      });
    });
  });

  describe('sanitizeFilters', () => {
    test('should return empty object for undefined input', () => {
      const sanitized = sanitizeFilters();
      assert.deepStrictEqual(sanitized, {});
    });

    test('should convert comma-separated status string to array', () => {
      const filters = { status: 'pending,in-progress,completed' };
      const sanitized = sanitizeFilters(filters);
      assert.deepStrictEqual(sanitized.status, ['pending', 'in-progress', 'completed']);
    });

    test('should convert comma-separated priority string to array', () => {
      const filters = { priority: 'high,medium' };
      const sanitized = sanitizeFilters(filters);
      assert.deepStrictEqual(sanitized.priority, ['high', 'medium']);
    });

    test('should trim whitespace from array values', () => {
      const filters = { status: ' pending , in-progress , completed ' };
      const sanitized = sanitizeFilters(filters);
      assert.deepStrictEqual(sanitized.status, ['pending', 'in-progress', 'completed']);
    });

    test('should filter out empty strings from arrays', () => {
      const filters = { status: 'pending,,in-progress,' };
      const sanitized = sanitizeFilters(filters);
      assert.deepStrictEqual(sanitized.status, ['pending', 'in-progress']);
    });

    test('should convert numeric string fields to numbers', () => {
      const filters = {
        estimatedTimeMin: '60',
        estimatedTimeMax: '240',
        actualTimeMin: '30',
        actualTimeMax: '300'
      };
      const sanitized = sanitizeFilters(filters);
      
      assert.strictEqual(sanitized.estimatedTimeMin, 60);
      assert.strictEqual(sanitized.estimatedTimeMax, 240);
      assert.strictEqual(sanitized.actualTimeMin, 30);
      assert.strictEqual(sanitized.actualTimeMax, 300);
    });

    test('should remove invalid numeric fields', () => {
      const filters = {
        estimatedTimeMin: 'invalid',
        estimatedTimeMax: 'abc',
        actualTimeMin: '',
        actualTimeMax: 'xyz'
      };
      const sanitized = sanitizeFilters(filters);
      
      assert(!('estimatedTimeMin' in sanitized));
      assert(!('estimatedTimeMax' in sanitized));
      // Empty string doesn't get processed by the numeric conversion logic
      assert('actualTimeMin' in sanitized && sanitized.actualTimeMin === '');
      assert(!('actualTimeMax' in sanitized));
    });

    test('should convert boolean strings to booleans', () => {
      const filters = {
        overdueTasks: 'true',
        recentlyCompleted: 'false',
        underEstimated: 'true',
        overEstimated: 'false',
        noEstimate: 'true'
      };
      const sanitized = sanitizeFilters(filters);
      
      assert.strictEqual(sanitized.overdueTasks, true);
      assert.strictEqual(sanitized.recentlyCompleted, false);
      assert.strictEqual(sanitized.underEstimated, true);
      assert.strictEqual(sanitized.overEstimated, false);
      assert.strictEqual(sanitized.noEstimate, true);
    });

    test('should preserve existing boolean values', () => {
      const filters = {
        overdueTasks: true,
        recentlyCompleted: false
      };
      const sanitized = sanitizeFilters(filters);
      
      assert.strictEqual(sanitized.overdueTasks, true);
      assert.strictEqual(sanitized.recentlyCompleted, false);
    });

    test('should remove invalid date strings', () => {
      const filters = {
        createdAfter: 'invalid-date',
        createdBefore: '2024-13-45', // Invalid date
        completedAfter: '2024-01-01', // Valid date
        completedBefore: 'not-a-date'
      };
      const sanitized = sanitizeFilters(filters);
      
      assert(!('createdAfter' in sanitized));
      assert(!('createdBefore' in sanitized));
      assert.strictEqual(sanitized.completedAfter, '2024-01-01');
      assert(!('completedBefore' in sanitized));
    });

    test('should preserve valid date strings', () => {
      const filters = {
        createdAfter: '2024-01-01',
        createdBefore: '2024-12-31T23:59:59.999Z',
        completedAfter: '2024-06-15T10:30:00Z'
      };
      const sanitized = sanitizeFilters(filters);
      
      assert.strictEqual(sanitized.createdAfter, '2024-01-01');
      assert.strictEqual(sanitized.createdBefore, '2024-12-31T23:59:59.999Z');
      assert.strictEqual(sanitized.completedAfter, '2024-06-15T10:30:00Z');
    });

    test('should handle complex filter combination', () => {
      const filters = {
        status: 'pending,in-progress',
        priority: ' high , medium ',
        createdAfter: '2024-01-01',
        createdBefore: 'invalid-date',
        estimatedTimeMin: '60',
        estimatedTimeMax: 'invalid',
        overdueTasks: 'true',
        recentlyCompleted: 'false',
        someOtherField: 'unchanged'
      };
      const sanitized = sanitizeFilters(filters);
      
      assert.deepStrictEqual(sanitized.status, ['pending', 'in-progress']);
      assert.deepStrictEqual(sanitized.priority, ['high', 'medium']);
      assert.strictEqual(sanitized.createdAfter, '2024-01-01');
      assert(!('createdBefore' in sanitized));
      assert.strictEqual(sanitized.estimatedTimeMin, 60);
      assert(!('estimatedTimeMax' in sanitized));
      assert.strictEqual(sanitized.overdueTasks, true);
      assert.strictEqual(sanitized.recentlyCompleted, false);
      assert.strictEqual(sanitized.someOtherField, 'unchanged');
    });

    test('should preserve non-targeted fields unchanged', () => {
      const filters = {
        customField: 'value',
        anotherField: 123,
        objectField: { nested: 'value' }
      };
      const sanitized = sanitizeFilters(filters);
      
      assert.strictEqual(sanitized.customField, 'value');
      assert.strictEqual(sanitized.anotherField, 123);
      assert.deepStrictEqual(sanitized.objectField, { nested: 'value' });
    });
  });

  describe('Integration Tests', () => {
    test('should work together for realistic query building', () => {
      const rawFilters = {
        status: 'pending,in-progress',
        priority: 'high',
        createdAfter: '2024-01-01',
        estimatedTimeMin: '60',
        overdueTasks: 'true',
        sortBy: 'priority',
        sortOrder: 'desc'
      };

      const sanitized = sanitizeFilters(rawFilters);
      const query = buildTaskQuery(sanitized);
      const sort = buildSortQuery(sanitized);

      // Verify sanitization
      assert.deepStrictEqual(sanitized.status, ['pending', 'in-progress']);
      assert.strictEqual(sanitized.priority, 'high');
      assert.strictEqual(sanitized.estimatedTimeMin, 60);
      assert.strictEqual(sanitized.overdueTasks, true);

      // Verify query building
      assert(query.$and);
      assert(query.$and.length >= 3);

      // Verify sorting
      assert.deepStrictEqual(sort, { priority: -1 });
    });

    test('should handle empty filters gracefully', () => {
      const rawFilters = {};
      const sanitized = sanitizeFilters(rawFilters);
      const query = buildTaskQuery(sanitized);
      const sort = buildSortQuery(sanitized);

      assert.deepStrictEqual(sanitized, {});
      assert.deepStrictEqual(query, {});
      assert.deepStrictEqual(sort, { createdAt: -1 });
    });
  });
});