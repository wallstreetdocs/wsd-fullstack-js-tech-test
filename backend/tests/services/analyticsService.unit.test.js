/**
 * ⚠️ Warning:
 * 🔍 Smoke test to verify that AnalyticsService exposes the expected static methods.
 *
 * ⚠️ This only checks method existence — not correctness or behavior.
 * ✅ For more valuable coverage, prefer testing actual method outputs
 * with controlled inputs and mock dependencies to verify real functionality.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import AnalyticsService from '../../src/services/analyticsService.js';

describe('Analytics Service Unit Tests', () => {
  test('should be a class with static methods', () => {
    assert(AnalyticsService);
    assert(typeof AnalyticsService.getTaskMetrics === 'function');
    assert(typeof AnalyticsService.calculateMetrics === 'function');
    assert(typeof AnalyticsService.getTasksByStatus === 'function');
    assert(typeof AnalyticsService.getTasksByPriority === 'function');
    assert(typeof AnalyticsService.getCompletionRate === 'function');
    assert(typeof AnalyticsService.getAverageCompletionTime === 'function');
    assert(typeof AnalyticsService.getTasksCreatedToday === 'function');
    assert(typeof AnalyticsService.getTasksCompletedToday === 'function');
    assert(typeof AnalyticsService.getRecentActivity === 'function');
    assert(typeof AnalyticsService.getTaskCreationRate === 'function');
    assert(typeof AnalyticsService.invalidateCache === 'function');
    assert(typeof AnalyticsService.fixCompletedTasksData === 'function');
  });

  test('all methods should be async functions', () => {
    const methods = [
      'getTaskMetrics',
      'calculateMetrics', 
      'getTasksByStatus',
      'getTasksByPriority',
      'getCompletionRate',
      'getAverageCompletionTime',
      'getTasksCreatedToday',
      'getTasksCompletedToday',
      'getRecentActivity',
      'getTaskCreationRate',
      'invalidateCache',
      'fixCompletedTasksData'
    ];

    methods.forEach(methodName => {
      const method = AnalyticsService[methodName];
      assert(method.constructor.name === 'AsyncFunction', 
        `${methodName} should be an async function`);
    });
  });

  test('should have proper method signatures', () => {
    // Test that methods exist and can be called (though they may fail due to DB)
    assert(AnalyticsService.getTaskMetrics.length === 0);
    assert(AnalyticsService.calculateMetrics.length === 0);
    assert(AnalyticsService.invalidateCache.length === 0);
  });

  test('should expose analytics service structure', () => {
    // Test the class structure
    const methodNames = Object.getOwnPropertyNames(AnalyticsService);
    
    assert(methodNames.includes('getTaskMetrics'));
    assert(methodNames.includes('calculateMetrics'));
    assert(methodNames.includes('getTasksByStatus'));
    assert(methodNames.includes('getTasksByPriority'));
    assert(methodNames.includes('getCompletionRate'));
    assert(methodNames.includes('getAverageCompletionTime'));
    assert(methodNames.includes('getTasksCreatedToday'));
    assert(methodNames.includes('getTasksCompletedToday'));
    assert(methodNames.includes('getRecentActivity'));
    assert(methodNames.includes('getTaskCreationRate'));
    assert(methodNames.includes('invalidateCache'));
    assert(methodNames.includes('fixCompletedTasksData'));
  });
});