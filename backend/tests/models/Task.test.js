import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import Task from '../../src/models/Task.js';

describe('Task Model Tests', () => {
  before(async () => {
    // Connect to test database
    await mongoose.connect('mongodb://localhost:27018/task_analytics_test');
  });

  after(async () => {
    // Clean up test data and close connection
    await Task.deleteMany({});
    await mongoose.connection.close();
  });

  test('should create a task with required fields', async () => {
    const taskData = {
      title: 'Test Task',
      description: 'Test Description',
      priority: 'high'
    };

    const task = new Task(taskData);
    const savedTask = await task.save();

    assert.strictEqual(savedTask.title, taskData.title);
    assert.strictEqual(savedTask.description, taskData.description);
    assert.strictEqual(savedTask.priority, taskData.priority);
    assert.strictEqual(savedTask.status, 'pending'); // default value
  });

  test('should set completedAt when status changes to completed', async () => {
    const task = new Task({
      title: 'Complete Me',
      status: 'pending'
    });

    await task.save();
    assert.strictEqual(task.completedAt, null);

    task.status = 'completed';
    await task.save();
    
    assert(task.completedAt instanceof Date);
  });

  test('should clear completedAt when status changes from completed', async () => {
    // First create and save the task as completed
    const task = new Task({
      title: 'Complete and Uncomplete',
      status: 'pending'
    });

    await task.save();
    
    // Update to completed first
    task.status = 'completed';
    await task.save();
    assert(task.completedAt instanceof Date);

    // Then change back to pending
    task.status = 'pending';
    await task.save();
    
    assert.strictEqual(task.completedAt, null);
  });

  test('should calculate completion time correctly', async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const task = new Task({
      title: 'Timed Task',
      createdAt: oneHourAgo,
      completedAt: now,
      status: 'completed'
    });

    const completionTime = task.calculateCompletionTime();
    assert.strictEqual(completionTime, 60); // 60 minutes
  });

  test('should return null for completion time if not completed', async () => {
    const task = new Task({
      title: 'Incomplete Task',
      status: 'pending'
    });

    const completionTime = task.calculateCompletionTime();
    assert.strictEqual(completionTime, null);
  });

  test('should validate required title field', async () => {
    const task = new Task({
      description: 'No title task'
    });

    try {
      await task.save();
      assert.fail('Should have thrown validation error');
    } catch (error) {
      assert(error.name === 'ValidationError');
      assert(error.errors.title);
    }
  });

  test('should validate enum values for status', async () => {
    const task = new Task({
      title: 'Invalid Status Task',
      status: 'invalid-status'
    });

    try {
      await task.save();
      assert.fail('Should have thrown validation error');
    } catch (error) {
      assert(error.name === 'ValidationError');
      assert(error.errors.status);
    }
  });

  test('should validate enum values for priority', async () => {
    const task = new Task({
      title: 'Invalid Priority Task',
      priority: 'super-high'
    });

    try {
      await task.save();
      assert.fail('Should have thrown validation error');
    } catch (error) {
      assert(error.name === 'ValidationError');
      assert(error.errors.priority);
    }
  });
});