/**
 * @fileoverview Export caching service with 2-level cache strategy
 * @module services/exportCacheService
 */

import crypto from 'crypto';
import { redisClient } from '../config/redis.js';
import ExportHistory from '../models/ExportHistory.js';
import Task from '../models/Task.js';
import { buildTaskQuery } from './queryBuilderService.js';

/**
 * Export cache service implementing 2-level caching strategy:
 * Level 1: Redis cache (metadata only) - Fast lookup
 * Level 2: Database cache (ExportHistory) - Persistent storage
 * @class ExportCacheService
 */
class ExportCacheService {
  /**
   * Cache TTL in seconds (24 hours)
   */
  static CACHE_TTL = 24 * 60 * 60;

  /**
   * Generates a unique cache key from query parameters and data freshness
   * @param {Object} queryParams - Query parameters for filtering
   * @param {string} format - Export format (csv/json)
   * @param {Date} lastUpdatedAt - Last data update timestamp
   * @returns {string} Unique cache key
   */
  static generateCacheKey(queryParams, format, lastUpdatedAt) {
    const normalizedParams = this.normalizeQueryParams(queryParams);
    const paramString = JSON.stringify(normalizedParams, Object.keys(normalizedParams).sort());
    const dataHash = crypto.createHash('md5')
      .update(`${paramString}:${format}:${lastUpdatedAt.toISOString()}`)
      .digest('hex');

    return `export:${format}:${dataHash}`;
  }

  /**
   * Normalizes query parameters for consistent cache key generation
   * @private
   * @param {Object} params - Raw query parameters
   * @returns {Object} Normalized parameters
   */
  static normalizeQueryParams(params) {
    const normalized = { ...params };

    // Sort arrays to ensure consistent ordering
    if (normalized.status && Array.isArray(normalized.status)) {
      normalized.status = [...normalized.status].sort();
    }
    if (normalized.priority && Array.isArray(normalized.priority)) {
      normalized.priority = [...normalized.priority].sort();
    }

    // Remove undefined/null values
    Object.keys(normalized).forEach(key => {
      if (normalized[key] === undefined || normalized[key] === null) {
        delete normalized[key];
      }
    });

    return normalized;
  }

  /**
   * Gets the latest data update timestamp for the filtered dataset
   * @async
   * @param {Object} queryParams - Query parameters for filtering
   * @returns {Promise<Date>} Latest update timestamp for the filtered data
   */
  static async getDataFreshnessTimestamp(queryParams = {}) {
    try {
      // Build the same query that will be used for export
      const taskQuery = buildTaskQuery(queryParams);

      // Find the most recently updated task within the filtered dataset
      const latestTask = await Task.findOne(taskQuery, { updatedAt: 1 }, { sort: { updatedAt: -1 } });

      return latestTask ? latestTask.updatedAt : new Date();
    } catch (error) {
      console.error('Error getting data freshness timestamp:', error);
      return new Date(); // Fallback to current time
    }
  }

  /**
   * Retrieves export metadata from Redis cache (Level 1)
   * @async
   * @param {string} cacheKey - Cache key
   * @returns {Promise<Object|null>} Cached metadata or null if not found
   */
  static async getFromRedisCache(cacheKey) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const metadata = JSON.parse(cached);
        console.log(`✅ Redis cache HIT for key: ${cacheKey}`);
        return metadata;
      }
      console.log(`❌ Redis cache MISS for key: ${cacheKey}`);
      return null;
    } catch (error) {
      console.error('Redis cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Stores export metadata in Redis cache (Level 1)
   * @async
   * @param {string} cacheKey - Cache key
   * @param {Object} metadata - Export metadata
   * @returns {Promise<void>}
   */
  static async setRedisCache(cacheKey, metadata) {
    try {
      await redisClient.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(metadata)
      );
      console.log(`💾 Redis cache SET for key: ${cacheKey}`);
    } catch (error) {
      console.error('Redis cache storage error:', error);
    }
  }

  /**
   * Retrieves export from database cache (Level 2)
   * @async
   * @param {string} cacheKey - Cache key
   * @returns {Promise<Object|null>} Export record or null if not found
   */
  static async getFromDatabaseCache(cacheKey) {
    try {
      const exportRecord = await ExportHistory.findOne({
        cacheKey,
        status: 'completed'
      });

      if (exportRecord) {
        console.log(`✅ Database cache HIT for key: ${cacheKey}`);
        return {
          filename: exportRecord.filename,
          format: exportRecord.format,
          totalRecords: exportRecord.totalRecords,
          fileSizeBytes: exportRecord.fileSizeBytes,
          executionTimeMs: exportRecord.executionTimeMs,
          queryParameters: exportRecord.queryParameters,
          createdAt: exportRecord.createdAt,
          id: exportRecord._id
        };
      }

      console.log(`❌ Database cache MISS for key: ${cacheKey}`);
      return null;
    } catch (error) {
      console.error('Database cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Checks if a cached export is still valid based on data freshness
   * @async
   * @param {Object} exportRecord - Export record from database
   * @param {Date} currentDataTimestamp - Current data freshness timestamp
   * @returns {Promise<boolean>} True if cache is still valid
   */
  static async isCacheValid(exportRecord, currentDataTimestamp) {
    // If export was created after the last data update, it's still valid
    return exportRecord.createdAt >= currentDataTimestamp;
  }

  /**
   * Creates a new export record in database cache
   * @async
   * @param {string} cacheKey - Cache key
   * @param {Object} exportData - Export data
   * @param {Object} queryParams - Original query parameters
   * @returns {Promise<Object>} Created export record
   */
  static async createDatabaseCacheRecord(cacheKey, exportData, queryParams) {
    try {
      const exportRecord = new ExportHistory({
        filename: exportData.filename,
        format: exportData.format,
        status: 'pending',
        totalRecords: exportData.totalRecords || 0,
        queryParameters: queryParams,
        cacheKey,
        filters: queryParams // Keep for backward compatibility
      });

      await exportRecord.save();
      console.log(`💾 Database cache record created: ${cacheKey}`);
      return exportRecord;
    } catch (error) {
      console.error('Database cache record creation error:', error);
      throw error;
    }
  }

  /**
   * Updates database cache record when export completes
   * @async
   * @param {string} cacheKey - Cache key
   * @param {Object} completionData - Completion data
   * @returns {Promise<Object>} Updated export record
   */
  static async updateDatabaseCacheRecord(cacheKey, completionData) {
    try {
      const exportRecord = await ExportHistory.findOneAndUpdate(
        { cacheKey },
        {
          status: 'completed',
          fileSizeBytes: completionData.fileSizeBytes,
          executionTimeMs: completionData.executionTimeMs
        },
        { new: true }
      );

      if (exportRecord) {
        console.log(`✅ Database cache record updated: ${cacheKey}`);
        return exportRecord;
      }

      throw new Error(`Export record not found for cache key: ${cacheKey}`);
    } catch (error) {
      console.error('Database cache record update error:', error);
      throw error;
    }
  }

  /**
   * Main cache lookup function implementing 2-level cache strategy
   * @async
   * @param {Object} queryParams - Query parameters
   * @param {string} format - Export format
   * @returns {Promise<Object|null>} Cache result or null if no cache hit
   */
  static async lookupCache(queryParams, format) {
    try {
      // Get current data freshness for the specific filtered dataset
      const dataTimestamp = await this.getDataFreshnessTimestamp(queryParams);
      const cacheKey = this.generateCacheKey(queryParams, format, dataTimestamp);

      console.log(`🔍 Cache lookup for key: ${cacheKey}`);

      // Level 1: Check Redis cache
      const redisResult = await this.getFromRedisCache(cacheKey);
      if (redisResult) {
        return {
          source: 'redis',
          cacheKey,
          ...redisResult
        };
      }

      // Level 2: Check database cache
      const dbResult = await this.getFromDatabaseCache(cacheKey);
      if (dbResult) {
        // Verify cache is still valid
        const isValid = await this.isCacheValid(dbResult, dataTimestamp);
        if (isValid) {
          // Update Redis cache for faster future access
          await this.setRedisCache(cacheKey, {
            filename: dbResult.filename,
            format: dbResult.format,
            totalRecords: dbResult.totalRecords,
            fileSizeBytes: dbResult.fileSizeBytes,
            executionTimeMs: dbResult.executionTimeMs
          });

          return {
            source: 'database',
            cacheKey,
            ...dbResult
          };
        } else {
          console.log(`⚠️ Database cache expired for key: ${cacheKey}`);
        }
      }

      // No valid cache found
      console.log(`❌ No valid cache found for key: ${cacheKey}`);
      return null;
    } catch (error) {
      console.error('Cache lookup error:', error);
      return null;
    }
  }

}

export default ExportCacheService;
