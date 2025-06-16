import { test, describe } from 'node:test';
import assert from 'node:assert';
import express from 'express';

// Import the router and function
import router, { setSocketHandlers } from '../../src/routes/api.js';

describe('API Routes Unit Tests', () => {
  test('should export setSocketHandlers function', () => {
    assert(typeof setSocketHandlers === 'function');
  });

  test('should set socket handlers', () => {
    const mockHandlers = {
      broadcastTaskUpdate: () => {},
      broadcastAnalyticsUpdate: () => {}
    };

    // This should not throw an error
    setSocketHandlers(mockHandlers);
    assert(true);
  });

  test('should handle null socket handlers', () => {
    // This should not throw an error
    setSocketHandlers(null);
    assert(true);
  });

  test('should export express router', () => {
    assert(router);
    assert(typeof router === 'function');
    // Check if it's an express router
    assert(router.stack !== undefined);
  });

  test('should have routes registered', () => {
    // The router should have routes registered
    assert(router.stack.length > 0);
    
    // Check for specific route patterns
    const routes = router.stack.map(layer => ({
      method: Object.keys(layer.route?.methods || {})[0],
      path: layer.route?.path
    }));

    // Should have GET /tasks route
    const tasksRoute = routes.find(r => r.path === '/tasks' && r.method === 'get');
    assert(tasksRoute, 'Should have GET /tasks route');

    // Should have POST /tasks route  
    const createTaskRoute = routes.find(r => r.path === '/tasks' && r.method === 'post');
    assert(createTaskRoute, 'Should have POST /tasks route');

    // Should have health route
    const healthRoute = routes.find(r => r.path === '/health' && r.method === 'get');
    assert(healthRoute, 'Should have GET /health route');

    // Should have analytics route
    const analyticsRoute = routes.find(r => r.path === '/analytics' && r.method === 'get');
    assert(analyticsRoute, 'Should have GET /analytics route');
  });

  test('should set socket handlers correctly', () => {
    const mockHandlers = {
      broadcastTaskUpdate: (action, task) => ({ action, task }),
      broadcastAnalyticsUpdate: () => 'analytics updated'
    };

    setSocketHandlers(mockHandlers);
    
    // Verify handlers are set (can't test directly, but no error should be thrown)
    assert(true);
  });
});