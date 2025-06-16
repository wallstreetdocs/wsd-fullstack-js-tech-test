import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { redisClient, connectRedis } from '../../src/config/redis.js';

describe('Redis Config Tests', () => {
  test('should have redisClient instance', () => {
    assert(redisClient);
    assert(typeof redisClient.connect === 'function');
    assert(typeof redisClient.disconnect === 'function');
  });

  test('should have connectRedis function', () => {
    assert(typeof connectRedis === 'function');
  });

  test('should handle connection events', () => {
    // Test that event listeners are set up
    const events = redisClient.eventNames();
    assert(events.includes('connect') || events.includes('connection'));
  });

  test('should configure redis with correct options', () => {
    const options = redisClient.options;
    assert(options.lazyConnect === true);
    assert(options.maxRetriesPerRequest === 3);
    assert(options.retryDelayOnFailover === 100);
  });
});