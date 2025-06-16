import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('API Tests', () => {
  test('should return health status', async () => {
    const response = await fetch('http://localhost:3001/api/health');
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.message, 'API is healthy');
  });

  test('should get empty tasks list initially', async () => {
    const response = await fetch('http://localhost:3001/api/tasks');
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert(Array.isArray(data.data.tasks));
  });

  test('should create a new task', async () => {
    const taskData = {
      title: 'Test Task',
      description: 'Test Description',
      priority: 'medium'
    };

    const response = await fetch('http://localhost:3001/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskData)
    });

    const data = await response.json();
    
    assert.strictEqual(response.status, 201);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.title, taskData.title);
    assert.strictEqual(data.data.description, taskData.description);
    assert.strictEqual(data.data.priority, taskData.priority);
  });

  test('should get analytics data', async () => {
    const response = await fetch('http://localhost:3001/api/analytics');
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert(typeof data.data.totalTasks === 'number');
    assert(typeof data.data.completionRate === 'number');
    assert(typeof data.data.tasksByStatus === 'object');
    assert(typeof data.data.tasksByPriority === 'object');
  });
});