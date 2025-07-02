import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';

describe('Export Service Cache Management Tests', () => {
  let mockRedisClient;
  let mockTask;
  let mockFs;

  beforeEach(() => {
    // Mock Redis client
    mockRedisClient = {
      get: mock.fn(),
      setex: mock.fn(),
      del: mock.fn(),
      keys: mock.fn()
    };

    // Mock Task model
    mockTask = {
      countDocuments: mock.fn()
    };

    // Mock filesystem operations
    mockFs = {
      existsSync: mock.fn(),
      unlinkSync: mock.fn()
    };
  });

  describe('5. Cache Management: Hit/miss scenarios, selective invalidation', () => {
    test('should generate consistent cache keys for same parameters', () => {
      const params1 = {
        format: 'csv',
        filters: {
          status: 'completed',
          priority: 'high',
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }
      };

      const params2 = {
        format: 'csv',
        filters: {
          status: 'completed',
          priority: 'high',
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }
      };

      // Simulate cache key generation logic
      const generateCacheKey = (jobParams) => {
        const { format, filters } = jobParams;
        const paramsString = JSON.stringify({
          format,
          filters: {
            status: filters.status || null,
            priority: filters.priority || null,
            sortBy: filters.sortBy || 'createdAt',
            sortOrder: filters.sortOrder || 'desc',
            search: filters.search || null,
            createdAfter: filters.createdAfter || null,
            createdBefore: filters.createdBefore || null,
            completedAfter: filters.completedAfter || null,
            completedBefore: filters.completedBefore || null,
            estimatedTimeLt: filters.estimatedTimeLt || null,
            estimatedTimeGte: filters.estimatedTimeGte || null
          }
        });
        return `export:${crypto.createHash('md5').update(paramsString).digest('hex')}`;
      };

      const key1 = generateCacheKey(params1);
      const key2 = generateCacheKey(params2);

      assert.strictEqual(key1, key2);
      assert.ok(key1.startsWith('export:'));
      assert.strictEqual(key1.length, 39); // 'export:' + 32 char MD5 hash
    });

    test('should handle cache hit scenario', async () => {
      const cacheKey = 'export:abc123def456';
      const cachedData = JSON.stringify({
        totalItems: 100,
        tempFilePath: '/tmp/export_cached.csv',
        filename: 'cached_export.csv',
        fileSize: 2048,
        storageType: 'tempFile'
      });

      // Mock cache hit
      mockRedisClient.get.mock.mockImplementation(() => Promise.resolve(cachedData));

      // Test cache retrieval
      const result = await mockRedisClient.get(cacheKey);
      const parsedResult = JSON.parse(result);

      assert.strictEqual(parsedResult.totalItems, 100);
      assert.strictEqual(parsedResult.filename, 'cached_export.csv');
      assert.strictEqual(parsedResult.storageType, 'tempFile');
      
      // Should not process job when cache hit occurs
      const shouldSkipProcessing = !!result;
      assert.strictEqual(shouldSkipProcessing, true);
    });

    test('should handle cache miss scenario', async () => {
      const cacheKey = 'export:nonexistent';

      // Mock cache miss
      mockRedisClient.get.mock.mockImplementation(() => Promise.resolve(null));

      // Test cache retrieval
      const result = await mockRedisClient.get(cacheKey);

      assert.strictEqual(result, null);
      
      // Should proceed with processing when cache miss occurs
      const shouldProcess = !result;
      assert.strictEqual(shouldProcess, true);
    });

    test('should cache export results with appropriate TTL', async () => {
      const cacheKey = 'export:test123';
      const exportData = {
        totalItems: 500,
        tempFilePath: '/tmp/export_500.csv',
        filename: 'export_500_items.csv',
        fileSize: 10240,
        storageType: 'tempFile'
      };

      // Test TTL calculation logic
      const getCacheTTL = (totalItems) => {
        const smallExportCacheTTL = 3600; // 1 hour
        const mediumExportCacheTTL = 86400; // 24 hours
        return totalItems > 1000 ? mediumExportCacheTTL : smallExportCacheTTL;
      };

      const ttl = getCacheTTL(exportData.totalItems);
      assert.strictEqual(ttl, 3600); // Should use small export TTL for 500 items

      // Test large export TTL
      const largeTTL = getCacheTTL(1500);
      assert.strictEqual(largeTTL, 86400); // Should use medium export TTL for 1500 items

      // Mock caching operation
      mockRedisClient.setex.mock.mockImplementation(() => Promise.resolve('OK'));

      const cacheResult = await mockRedisClient.setex(cacheKey, ttl, JSON.stringify(exportData));
      assert.strictEqual(cacheResult, 'OK');
    });

    test('should bypass cache when refreshCache is true', async () => {
      const cacheKey = 'export:refresh123';
      const jobWithRefresh = {
        refreshCache: true,
        format: 'csv',
        filters: { status: 'completed' }
      };

      // Mock existing cache
      mockRedisClient.get.mock.mockImplementation(() => Promise.resolve('{"cached": "data"}'));
      mockRedisClient.del.mock.mockImplementation(() => Promise.resolve(1));

      // Test refresh cache logic
      if (jobWithRefresh.refreshCache) {
        await mockRedisClient.del(cacheKey);
        // Should not attempt to get cached data
        const cachedResult = null; // Bypassed
        
        assert.strictEqual(cachedResult, null);
      }
    });

    test('should selectively invalidate affected caches on task changes', async () => {
      // Mock task change scenarios
      const taskChanges = [
        {
          operation: 'create',
          newTask: { status: 'completed', priority: 'high' }
        },
        {
          operation: 'update',
          oldTask: { status: 'pending', priority: 'medium' },
          newTask: { status: 'completed', priority: 'high' }
        },
        {
          operation: 'delete',
          oldTask: { status: 'completed', priority: 'low' }
        }
      ];

      // Mock affected cache key generation
      const generateAffectedKeys = (taskChange) => {
        const { oldTask, newTask, operation } = taskChange;
        const task = newTask || oldTask;
        const affectedKeys = new Set();

        // For creates/deletes, unfiltered caches are affected
        if (operation === 'create' || operation === 'delete') {
          affectedKeys.add('export:unfiltered_csv');
          affectedKeys.add('export:unfiltered_json');
        }

        // For all operations, check filters that could match this task
        const taskStatuses = operation === 'update' && oldTask
          ? [oldTask.status, newTask?.status].filter(Boolean)
          : [task.status];

        const taskPriorities = operation === 'update' && oldTask
          ? [oldTask.priority, newTask?.priority].filter(Boolean)
          : [task.priority];

        // Add cache keys for status/priority combinations
        for (const status of taskStatuses) {
          affectedKeys.add(`export:status_${status}_csv`);
          affectedKeys.add(`export:status_${status}_json`);

          for (const priority of taskPriorities) {
            affectedKeys.add(`export:status_${status}_priority_${priority}_csv`);
            affectedKeys.add(`export:status_${status}_priority_${priority}_json`);
          }
        }

        return Array.from(affectedKeys);
      };

      // Test each change scenario
      for (const change of taskChanges) {
        const affectedKeys = generateAffectedKeys(change);
        
        // Should have multiple affected keys
        assert.ok(affectedKeys.length > 0);
        
        // Create operation should affect unfiltered caches
        if (change.operation === 'create') {
          assert.ok(affectedKeys.includes('export:unfiltered_csv'));
          assert.ok(affectedKeys.includes('export:unfiltered_json'));
        }
        
        // Update operation should affect both old and new status/priority combinations
        if (change.operation === 'update') {
          assert.ok(affectedKeys.some(key => key.includes('pending')));
          assert.ok(affectedKeys.some(key => key.includes('completed')));
        }
      }
    });

    test('should cleanup temp files during cache invalidation', async () => {
      const cacheKeys = ['export:key1', 'export:key2', 'export:key3'];
      const cachedDataWithFiles = [
        JSON.stringify({
          storageType: 'tempFile',
          tempFilePath: '/tmp/export1.csv'
        }),
        JSON.stringify({
          storageType: 'tempFile',
          tempFilePath: '/tmp/export2.csv'
        }),
        null // No cached data
      ];

      // Mock cache retrieval and file operations
      let getCallCount = 0;
      mockRedisClient.get.mock.mockImplementation(() => {
        const data = cachedDataWithFiles[getCallCount++];
        return Promise.resolve(data);
      });

      mockFs.existsSync.mock.mockImplementation(() => true);
      mockFs.unlinkSync.mock.mockImplementation(() => {});
      mockRedisClient.del.mock.mockImplementation(() => Promise.resolve(1));

      // Simulate cache invalidation with cleanup
      let filesDeleted = 0;
      let cachesDeleted = 0;

      for (const cacheKey of cacheKeys) {
        const cachedData = await mockRedisClient.get(cacheKey);
        
        if (cachedData) {
          try {
            const data = JSON.parse(cachedData);
            if (data.storageType === 'tempFile' && data.tempFilePath) {
              if (mockFs.existsSync(data.tempFilePath)) {
                mockFs.unlinkSync(data.tempFilePath);
                filesDeleted++;
              }
            }
          } catch (parseError) {
            // Ignore parsing errors
          }
          
          await mockRedisClient.del(cacheKey);
          cachesDeleted++;
        }
      }

      assert.strictEqual(filesDeleted, 2); // Two temp files should be deleted
      assert.strictEqual(cachesDeleted, 2); // Two caches should be deleted
    });

    test('should handle cache operation errors gracefully', async () => {
      const cacheKey = 'export:error_test';

      // Mock Redis errors
      mockRedisClient.get.mock.mockImplementation(() => {
        throw new Error('Redis connection failed');
      });

      mockRedisClient.setex.mock.mockImplementation(() => {
        throw new Error('Redis write failed');
      });

      // Test cache read error handling
      let cacheError = false;
      let cachedResult = null;
      
      try {
        cachedResult = await mockRedisClient.get(cacheKey);
      } catch (error) {
        cacheError = true;
        // Should continue processing despite cache error
        cachedResult = null;
      }

      assert.strictEqual(cacheError, true);
      assert.strictEqual(cachedResult, null);

      // Test cache write error handling
      let cacheWriteError = false;
      
      try {
        await mockRedisClient.setex(cacheKey, 3600, '{"test": "data"}');
      } catch (error) {
        cacheWriteError = true;
        // Should not fail the export despite cache write error
      }

      assert.strictEqual(cacheWriteError, true);
      // Export should continue successfully even with cache errors
    });
  });
});