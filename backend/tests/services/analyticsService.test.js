import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import AnalyticsService from '../../src/services/analyticsService.js';
import Task from '../../src/models/Task.js';

describe('Analytics Service Integration Tests', () => {
  before(async () => {
    // Connect to test database only if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect('mongodb://localhost:27018/task_analytics_test', {
        serverSelectionTimeoutMS: 5000
      });
    }
  });

  beforeEach(async () => {
    // Clean up before each test
    await Task.deleteMany({});
    // Wait a moment to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  after(async () => {
    // Clean up test data and close connection
    if (mongoose.connection.readyState === 1) {
      await Task.deleteMany({});
      await mongoose.connection.close();
    }
  });

  test('should calculate metrics with no tasks', async () => {
    const metrics = await AnalyticsService.calculateMetrics();

    assert.strictEqual(metrics.totalTasks, 0);
    assert.strictEqual(metrics.completionRate, 0);
    assert.strictEqual(metrics.averageCompletionTime, 0);
    assert.strictEqual(metrics.tasksCreatedToday, 0);
    assert.strictEqual(metrics.tasksCompletedToday, 0);
    assert.deepStrictEqual(metrics.tasksByStatus, { pending: 0, 'in-progress': 0, completed: 0 });
    assert.deepStrictEqual(metrics.tasksByPriority, { low: 0, medium: 0, high: 0 });
  });

  test('should count tasks by status correctly', async () => {
    await Task.create([
      { title: 'Task 1', status: 'pending' },
      { title: 'Task 2', status: 'pending' },
      { title: 'Task 3', status: 'in-progress' },
      { title: 'Task 4', status: 'completed' }
    ]);

    const statusCounts = await AnalyticsService.getTasksByStatus();

    assert.strictEqual(statusCounts.pending, 2);
    assert.strictEqual(statusCounts['in-progress'], 1);
    assert.strictEqual(statusCounts.completed, 1);
  });

  test('should count tasks by priority correctly', async () => {
    await Task.create([
      { title: 'Task 1', priority: 'low' },
      { title: 'Task 2', priority: 'medium' },
      { title: 'Task 3', priority: 'medium' },
      { title: 'Task 4', priority: 'high' }
    ]);

    const priorityCounts = await AnalyticsService.getTasksByPriority();

    assert.strictEqual(priorityCounts.low, 1);
    assert.strictEqual(priorityCounts.medium, 2);
    assert.strictEqual(priorityCounts.high, 1);
  });

  test('should calculate completion rate correctly', async () => {
    await Task.create([
      { title: 'Task 1', status: 'pending' },
      { title: 'Task 2', status: 'completed' },
      { title: 'Task 3', status: 'completed' },
      { title: 'Task 4', status: 'in-progress' }
    ]);

    const completionRate = await AnalyticsService.getCompletionRate();

    assert.strictEqual(completionRate, 50); // 2 out of 4 tasks completed = 50%
  });

  test('should count tasks created today', async () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    await Task.create([
      { title: 'Today Task 1', createdAt: today },
      { title: 'Today Task 2', createdAt: today },
      { title: 'Yesterday Task', createdAt: yesterday }
    ]);

    const tasksCreatedToday = await AnalyticsService.getTasksCreatedToday();

    assert.strictEqual(tasksCreatedToday, 2);
  });

  test('should count tasks completed today', async () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    await Task.create([
      { title: 'Completed Today 1', status: 'completed', completedAt: today },
      { title: 'Completed Today 2', status: 'completed', completedAt: today },
      { title: 'Completed Yesterday', status: 'completed', completedAt: yesterday },
      { title: 'Not Completed', status: 'pending' }
    ]);

    const tasksCompletedToday = await AnalyticsService.getTasksCompletedToday();

    assert.strictEqual(tasksCompletedToday, 2);
  });

  test('should calculate average completion time correctly', async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    await Task.create([
      { 
        title: 'Fast Task', 
        status: 'completed',
        createdAt: oneHourAgo,
        completedAt: now
      },
      { 
        title: 'Slow Task', 
        status: 'completed',
        createdAt: twoHoursAgo,
        completedAt: now
      },
      { 
        title: 'Incomplete Task', 
        status: 'pending',
        createdAt: twoHoursAgo
      }
    ]);

    const avgTime = await AnalyticsService.getAverageCompletionTime();

    // Average of 1 hour and 2 hours = 1.5 hours
    assert.strictEqual(avgTime, 1.5);
  });

  test('should get recent activity', async () => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // Create tasks with explicit updatedAt values
    const recentTask = await Task.create({ title: 'Recent Task' });
    const olderTask = await Task.create({ title: 'Older Task' });

    // Update their timestamps
    await Task.findByIdAndUpdate(recentTask._id, { updatedAt: now });
    await Task.findByIdAndUpdate(olderTask._id, { updatedAt: oneMinuteAgo });

    const recentActivity = await AnalyticsService.getRecentActivity();

    assert.strictEqual(recentActivity.length, 2);
    assert.strictEqual(recentActivity[0].title, 'Recent Task'); // Most recent first
    assert.strictEqual(recentActivity[1].title, 'Older Task');
  });

  test('should handle empty database for average completion time', async () => {
    const avgTime = await AnalyticsService.getAverageCompletionTime();
    assert.strictEqual(avgTime, 0);
  });

  test('should handle completion rate with no tasks', async () => {
    const completionRate = await AnalyticsService.getCompletionRate();
    assert.strictEqual(completionRate, 0);
  });

  test('should get task creation rate', async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await Task.create([
      { title: 'Recent Task 1', createdAt: new Date() },
      { title: 'Recent Task 2', createdAt: new Date() },
      { title: 'Old Task', createdAt: thirtyDaysAgo }
    ]);

    const creationRate = await AnalyticsService.getTaskCreationRate();
    assert(typeof creationRate === 'number');
  });

  test('should invalidate cache', async () => {
    // This test verifies the function runs without error
    await AnalyticsService.invalidateCache();
    assert(true); // If we get here, no error was thrown
  });

  test('should fix completed tasks data', async () => {
    // Create a task that's completed but missing completedAt
    const task = new Task({
      title: 'Completed but no date',
      status: 'completed',
      updatedAt: new Date()
    });
    await task.save();

    await AnalyticsService.fixCompletedTasksData();

    const updatedTask = await Task.findById(task._id);
    assert(updatedTask.completedAt instanceof Date);
  });

  test('should get metrics with caching', async () => {
    // Test the main getTaskMetrics function that includes caching logic
    const metrics = await AnalyticsService.getTaskMetrics();

    assert(typeof metrics === 'object');
    assert(typeof metrics.totalTasks === 'number');
    assert(typeof metrics.completionRate === 'number');
    assert(typeof metrics.lastUpdated === 'string');
  });

  test('should handle average completion time with invalid data', async () => {
    // Create completed task with invalid completion time (completed before created)
    const now = new Date();
    const future = new Date(now.getTime() + 60 * 60 * 1000);

    await Task.create({
      title: 'Invalid time task',
      status: 'completed',
      createdAt: future,
      completedAt: now
    });

    const avgTime = await AnalyticsService.getAverageCompletionTime();
    assert.strictEqual(avgTime, 0); // Should ignore invalid completion times
  });
});