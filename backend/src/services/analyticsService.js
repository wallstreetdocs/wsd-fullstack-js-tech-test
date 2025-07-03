/**
 * @fileoverview Analytics service for task metrics calculation and caching
 * @module services/AnalyticsService
 */

import Task from '../models/Task.js';
import ExportJob from '../models/ExportJob.js';
import { redisClient } from '../config/redis.js';

/**
 * Service class for calculating and caching task analytics
 * @class AnalyticsService
 */
class AnalyticsService {
  /**
   * Retrieves task metrics with Redis caching
   * @static
   * @async
   * @returns {Promise<Object>} Complete task metrics object
   * @throws {Error} Falls back to direct calculation if cache fails
   * @example
   * const metrics = await AnalyticsService.getTaskMetrics();
   * console.log(metrics.totalTasks, metrics.completionRate);
   */
  static async getTaskMetrics() {
    try {
      const cacheKey = 'task_metrics';
      const cached = await redisClient.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      const metrics = await this.calculateMetrics();

      await redisClient.setex(cacheKey, 10, JSON.stringify(metrics));

      return metrics;
    } catch (error) {
      console.error('Error getting task metrics:', error);
      return await this.calculateMetrics();
    }
  }

  /**
   * Calculates all task metrics from database
   * @static
   * @async
   * @returns {Promise<Object>} Comprehensive metrics object with all analytics data
   */
  static async calculateMetrics() {
    const [
      totalTasks,
      tasksByStatus,
      tasksByPriority,
      completionRate,
      averageCompletionTime,
      tasksCreatedToday,
      tasksCompletedToday,
      recentActivity,
      exportsOverTime
    ] = await Promise.all([
      Task.countDocuments(),
      this.getTasksByStatus(),
      this.getTasksByPriority(),
      this.getCompletionRate(),
      this.getAverageCompletionTime(),
      this.getTasksCreatedToday(),
      this.getTasksCompletedToday(),
      this.getRecentActivity(),
      this.getExportsOverTime()
    ]);

    return {
      totalTasks,
      tasksByStatus,
      tasksByPriority,
      completionRate,
      averageCompletionTime,
      tasksCreatedToday,
      tasksCompletedToday,
      recentActivity,
      exportsOverTime,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Groups tasks by status and returns count for each status
   * @static
   * @async
   * @returns {Promise<Object>} Object with pending, in-progress, and completed counts
   */
  static async getTasksByStatus() {
    const result = await Task.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const statusCounts = { pending: 0, 'in-progress': 0, completed: 0 };
    result.forEach(item => {
      statusCounts[item._id] = item.count;
    });

    return statusCounts;
  }

  /**
   * Groups tasks by priority and returns count for each priority level
   * @static
   * @async
   * @returns {Promise<Object>} Object with low, medium, and high priority counts
   */
  static async getTasksByPriority() {
    const result = await Task.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const priorityCounts = { low: 0, medium: 0, high: 0 };
    result.forEach(item => {
      priorityCounts[item._id] = item.count;
    });

    return priorityCounts;
  }

  /**
   * Calculates task completion rate as percentage
   * @static
   * @async
   * @returns {Promise<number>} Completion rate percentage (0-100)
   */
  static async getCompletionRate() {
    const [total, completed] = await Promise.all([
      Task.countDocuments(),
      Task.countDocuments({ status: 'completed' })
    ]);

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  /**
   * Calculates average time to complete tasks in hours
   * @static
   * @async
   * @returns {Promise<number>} Average completion time in hours (rounded to 1 decimal)
   */
  static async getAverageCompletionTime() {
    const completedTasks = await Task.find({
      status: 'completed',
      completedAt: { $exists: true, $ne: null }
    }).select('createdAt completedAt');

    if (completedTasks.length === 0) return 0;

    // Filter out invalid tasks and calculate valid completion times
    const validCompletionTimes = [];

    for (const task of completedTasks) {
      if (task.completedAt && task.createdAt) {
        const completionTime = task.completedAt.getTime() - task.createdAt.getTime();

        // Only include positive completion times (completed after created)
        if (completionTime > 0) {
          validCompletionTimes.push(completionTime);
        }
      }
    }

    if (validCompletionTimes.length === 0) return 0;

    const averageMilliseconds = validCompletionTimes.reduce((sum, time) => sum + time, 0) / validCompletionTimes.length;

    // Convert to hours and round to 1 decimal place
    return Math.round((averageMilliseconds / (1000 * 60 * 60)) * 10) / 10;
  }

  /**
   * Counts tasks created today (since midnight)
   * @static
   * @async
   * @returns {Promise<number>} Number of tasks created today
   */
  static async getTasksCreatedToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await Task.countDocuments({
      createdAt: { $gte: today }
    });
  }

  /**
   * Counts tasks completed today (since midnight)
   * @static
   * @async
   * @returns {Promise<number>} Number of tasks completed today
   */
  static async getTasksCompletedToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await Task.countDocuments({
      status: 'completed',
      completedAt: { $gte: today }
    });
  }

  /**
   * Retrieves most recently updated tasks and export jobs for activity feed
   * @static
   * @async
   * @returns {Promise<Array>} Array of 10 most recent activities with basic info
   */
  static async getRecentActivity() {
    // Get recent tasks
    const tasks = await Task.find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('title status priority updatedAt');

    // Get recent export jobs
    const exports = await ExportJob.find({ status: { $in: ['completed', 'failed'] } })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('filename status format updatedAt');

    // Convert export jobs to task-like format for activity feed
    const exportActivities = exports.map(exportJob => ({
      _id: exportJob._id,
      title: `Export: ${exportJob.filename || 'Tasks'}`,
      status: exportJob.status === 'completed' ? 'completed' : 'pending',
      priority: 'medium',
      updatedAt: exportJob.updatedAt
    }));

    // Combine and sort by updatedAt
    const combinedActivity = [...tasks, ...exportActivities]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10);

    return combinedActivity;
  }

  /**
   * Calculates average task creation rate over last 30 days
   * @static
   * @async
   * @returns {Promise<number>} Average tasks created per hour over 30 days
   */
  static async getTaskCreationRate() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await Task.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
            hour: { $hour: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
    ]);

    return result.length > 0 ? result.reduce((sum, item) => sum + item.count, 0) / result.length : 0;
  }

  /**
   * Invalidates the Redis cache for task metrics
   * @static
   * @async
   * @returns {Promise<void>}
   */
  static async invalidateCache() {
    try {
      await redisClient.del('task_metrics');
    } catch (error) {
      console.error('Error invalidating analytics cache:', error);
    }
  }

  /**
   * Data migration utility to fix completed tasks missing completedAt dates
   * @static
   * @async
   * @returns {Promise<void>} Logs number of fixed tasks
   */
  static async fixCompletedTasksData() {
    try {
      // Fix completed tasks that don't have completedAt set
      const completedTasksWithoutDate = await Task.find({
        status: 'completed',
        $or: [
          { completedAt: { $exists: false } },
          { completedAt: null }
        ]
      });

      for (const task of completedTasksWithoutDate) {
        // Use updatedAt as completedAt if it's available and makes sense
        if (task.updatedAt && task.updatedAt >= task.createdAt) {
          task.completedAt = task.updatedAt;
          await task.save();
          console.log(`Fixed completedAt for task ${task._id}`);
        }
      }

      console.log(`Fixed ${completedTasksWithoutDate.length} completed tasks`);
    } catch (error) {
      console.error('Error fixing completed tasks data:', error);
    }
  }

  /**
   * Retrieves export job counts grouped by month for the past 6 months
   * @static
   * @async
   * @returns {Promise<Array>} Array of monthly export counts with labels and data
   */
  static async getExportsOverTime() {
    try {
      // Calculate date 6 months ago from today
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1); // Start from the 1st of the month
      sixMonthsAgo.setHours(0, 0, 0, 0);

      // Aggregate exports by month
      const result = await ExportJob.aggregate([
        {
          $match: {
            createdAt: { $gte: sixMonthsAgo },
            status: 'completed' // Only count completed exports
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 },
            firstDay: { $min: '$createdAt' }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1 }
        }
      ]);

      // Fill in any missing months with zero counts
      const monthlyData = [];
      const today = new Date();
      let currentDate = new Date(sixMonthsAgo);

      // Iterate through each month in the 6-month period
      while (currentDate <= today) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // MongoDB months are 1-12

        // Look for a match in our aggregation results
        const match = result.find(
          item => item._id.year === year && item._id.month === month
        );

        // Get the month label
        const monthLabel = this.formatWeekLabel(currentDate);

        monthlyData.push({
          label: monthLabel,
          year,
          month,
          count: match ? match.count : 0
        });

        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      return {
        labels: monthlyData.map(item => item.label),
        data: monthlyData.map(item => item.count)
      };
    } catch (error) {
      console.error('Error getting exports over time:', error);
      return { labels: [], data: [] };
    }
  }

  /**
   * Helper method to get ISO week number from date
   * @static
   * @param {Date} date - Date to get week number from
   * @returns {number} Week number (1-53)
   */
  static getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Helper method to format week label
   * @static
   * @param {Date} date - Start date of the week
   * @returns {string} Formatted week label with just month name
   */
  static formatWeekLabel(date) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Just return the month name
    return monthNames[date.getMonth()];
  }
}

export default AnalyticsService;
