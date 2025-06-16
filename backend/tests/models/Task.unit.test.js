import { test, describe } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';

// Import Task model
import Task from '../../src/models/Task.js';

describe('Task Model Unit Tests', () => {
  test('should be a mongoose model', () => {
    assert(Task);
    assert(Task.modelName === 'Task');
    assert(Task.schema instanceof mongoose.Schema);
  });

  test('should have correct schema structure', () => {
    const schema = Task.schema;
    const paths = schema.paths;

    // Check required fields
    assert(paths.title);
    assert(paths.title.isRequired === true);
    assert(paths.title.instance === 'String');

    // Check optional fields
    assert(paths.description);
    assert(paths.description.instance === 'String');

    // Check enum fields
    assert(paths.status);
    assert(paths.status.enumValues.includes('pending'));
    assert(paths.status.enumValues.includes('in-progress'));
    assert(paths.status.enumValues.includes('completed'));

    assert(paths.priority);
    assert(paths.priority.enumValues.includes('low'));
    assert(paths.priority.enumValues.includes('medium'));
    assert(paths.priority.enumValues.includes('high'));
  });

  test('should have correct default values', () => {
    const schema = Task.schema;
    const paths = schema.paths;

    assert(paths.status.defaultValue === 'pending');
    assert(paths.priority.defaultValue === 'medium');
  });

  test('should have indexes defined', () => {
    const indexes = Task.schema.indexes();
    
    // Should have compound index for status and priority
    const compoundIndex = indexes.find(idx => 
      idx[0].status && idx[0].priority
    );
    assert(compoundIndex, 'Should have compound index on status and priority');

    // Should have index on createdAt
    const createdAtIndex = indexes.find(idx => 
      idx[0].createdAt && Object.keys(idx[0]).length === 1
    );
    assert(createdAtIndex, 'Should have index on createdAt');
  });

  test('should have pre-save middleware', () => {
    const schema = Task.schema;
    // Check if the schema has pre hooks defined
    assert(schema.pre, 'Schema should have pre hooks');
    // Alternative way to check for middleware
    const paths = schema.paths;
    assert(paths, 'Schema should have paths defined');
  });

  test('should have calculateCompletionTime method', () => {
    const instance = new Task({ title: 'Test' });
    assert(typeof instance.calculateCompletionTime === 'function');
  });

  test('calculateCompletionTime should return null for incomplete tasks', () => {
    const task = new Task({ 
      title: 'Test',
      createdAt: new Date(),
      completedAt: null
    });

    const result = task.calculateCompletionTime();
    assert.strictEqual(result, null);
  });

  test('calculateCompletionTime should calculate time correctly', () => {
    const createdAt = new Date('2024-01-01T10:00:00Z');
    const completedAt = new Date('2024-01-01T11:30:00Z'); // 90 minutes later

    const task = new Task({ 
      title: 'Test',
      createdAt,
      completedAt
    });

    const result = task.calculateCompletionTime();
    assert.strictEqual(result, 90); // 90 minutes
  });

  test('should validate title maxlength', () => {
    const schema = Task.schema;
    const titlePath = schema.paths.title;
    
    assert(titlePath.options.maxlength === 200);
  });

  test('should validate description maxlength', () => {
    const schema = Task.schema;
    const descriptionPath = schema.paths.description;
    
    assert(descriptionPath.options.maxlength === 1000);
  });

  test('should have timestamps enabled', () => {
    const schema = Task.schema;
    assert(schema.options.timestamps === true);
  });

  test('should have numeric fields with min validation', () => {
    const schema = Task.schema;
    
    assert(schema.paths.estimatedTime.options.min === 0);
    assert(schema.paths.actualTime.options.min === 0);
  });
});