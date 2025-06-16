import { test, describe } from 'node:test';
import assert from 'node:assert';
import { connectMongoDB } from '../../src/config/database.js';

describe('Database Config Tests', () => {
  test('should export connectMongoDB function', () => {
    assert(typeof connectMongoDB === 'function');
  });

  test('should be an async function', () => {
    assert(connectMongoDB.constructor.name === 'AsyncFunction');
  });
});