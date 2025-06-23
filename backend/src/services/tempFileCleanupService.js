/**
 * @fileoverview Service for cleaning up temporary export files
 * @module services/tempFileCleanupService
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import ExportJob from '../models/ExportJob.js';
import { redisClient } from '../config/redis.js';

/**
 * Service for managing temporary export files and cleaning them up
 */
class TempFileCleanupService {
  /**
   * Initialize cleanup service with a cleanup interval
   * @param {number} [interval=86400000] - Cleanup interval in ms (default: 24 hours)
   */
  initialize(interval = 86400000) {
    console.log(`[TempFileCleanupService] Initializing with interval ${interval}ms`);
    
    // Run initial cleanup
    this.cleanupTempFiles();
    
    // Set up periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupTempFiles();
    }, interval);
  }

  /**
   * Stop the cleanup interval
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up temporary export files that are no longer needed
   * @returns {Promise<number>} Number of files cleaned up
   */
  async cleanupTempFiles() {
    try {
      console.log('[TempFileCleanupService] Starting temp file cleanup');
      
      // Find all export jobs with temp files that are older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const oldJobs = await ExportJob.find({
        storageType: 'tempFile',
        updatedAt: { $lt: sevenDaysAgo }
      });
      
      console.log(`[TempFileCleanupService] Found ${oldJobs.length} old export jobs with temp files`);
      
      let cleanupCount = 0;
      
      // Process each job
      for (const job of oldJobs) {
        try {
          // Check if temp file exists
          if (job.tempFilePath && fs.existsSync(job.tempFilePath)) {
            // Delete the temp file
            fs.unlinkSync(job.tempFilePath);
            console.log(`[TempFileCleanupService] Deleted temp file: ${job.tempFilePath}`);
            cleanupCount++;
          }
          
          // Clear the temp file path from the job
          job.tempFilePath = null;
          job.storageType = 'buffer'; // Change storage type to buffer
          await job.save();
        } catch (jobError) {
          console.error(`[TempFileCleanupService] Error cleaning up job ${job._id}:`, jobError);
          // Continue with other jobs
        }
      }
      
      // Also clean up any temporary export files in the temp directory
      // that might not be tracked by export jobs
      const tempDir = os.tmpdir();
      const files = fs.readdirSync(tempDir);
      const exportFilePattern = /^export_\d+\.(csv|json)$/;
      
      for (const file of files) {
        if (exportFilePattern.test(file)) {
          const filePath = path.join(tempDir, file);
          
          try {
            // Check file stats
            const stats = fs.statSync(filePath);
            const fileAge = new Date() - stats.mtime;
            const ageInDays = fileAge / (1000 * 60 * 60 * 24);
            
            // If file is older than 7 days, delete it
            if (ageInDays > 7) {
              fs.unlinkSync(filePath);
              console.log(`[TempFileCleanupService] Deleted orphaned temp file: ${filePath}`);
              cleanupCount++;
            }
          } catch (fileError) {
            console.error(`[TempFileCleanupService] Error checking file ${filePath}:`, fileError);
            // Continue with other files
          }
        }
      }
      
      console.log(`[TempFileCleanupService] Cleanup completed, removed ${cleanupCount} files`);
      return cleanupCount;
    } catch (error) {
      console.error('[TempFileCleanupService] Error during cleanup:', error);
      return 0;
    }
  }

  /**
   * Clean up Redis cache entries for exports that no longer exist
   * @returns {Promise<number>} Number of cache entries cleaned up
   */
  async cleanupExportCache() {
    try {
      console.log('[TempFileCleanupService] Starting export cache cleanup');
      
      // Get all keys that match export cache pattern
      const keys = await redisClient.keys('export:*');
      let cleanupCount = 0;
      
      for (const key of keys) {
        try {
          // Get cache data
          const cacheData = await redisClient.get(key);
          if (!cacheData) continue;
          
          const data = JSON.parse(cacheData);
          
          // Check if this is a temp file cache
          if (data.storageType === 'tempFile' && data.tempFilePath) {
            // Check if the temp file exists
            if (!fs.existsSync(data.tempFilePath)) {
              // File doesn't exist, remove the cache entry
              await redisClient.del(key);
              console.log(`[TempFileCleanupService] Removed stale cache entry: ${key}`);
              cleanupCount++;
            }
          }
        } catch (cacheError) {
          console.error(`[TempFileCleanupService] Error cleaning cache entry ${key}:`, cacheError);
          // Continue with other cache entries
        }
      }
      
      console.log(`[TempFileCleanupService] Cache cleanup completed, removed ${cleanupCount} entries`);
      return cleanupCount;
    } catch (error) {
      console.error('[TempFileCleanupService] Error during cache cleanup:', error);
      return 0;
    }
  }
}

export default new TempFileCleanupService();