import { test, describe } from 'node:test';
import assert from 'node:assert';
import { errorHandler, notFound } from '../../src/middleware/errorHandler.js';

describe('Error Handler Middleware Tests', () => {
  test('should handle validation errors', () => {
    const validationError = {
      name: 'ValidationError',
      errors: {
        title: { message: 'Title is required' },
        priority: { message: 'Priority must be low, medium, or high' }
      }
    };

    const req = {};
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.responseData = data;
        return this;
      }
    };
    const next = () => {};

    errorHandler(validationError, req, res, next);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.responseData.success, false);
    assert.strictEqual(res.responseData.message, 'Validation Error');
    assert(Array.isArray(res.responseData.errors));
    assert.strictEqual(res.responseData.errors.length, 2);
  });

  test('should handle cast errors', () => {
    const castError = {
      name: 'CastError'
    };

    const req = {};
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.responseData = data;
        return this;
      }
    };
    const next = () => {};

    errorHandler(castError, req, res, next);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.responseData.success, false);
    assert.strictEqual(res.responseData.message, 'Invalid ID format');
  });

  test('should handle duplicate key errors', () => {
    const duplicateError = {
      code: 11000
    };

    const req = {};
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.responseData = data;
        return this;
      }
    };
    const next = () => {};

    errorHandler(duplicateError, req, res, next);

    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.responseData.success, false);
    assert.strictEqual(res.responseData.message, 'Duplicate field value');
  });

  test('should handle generic errors', () => {
    const genericError = {
      message: 'Something went wrong',
      statusCode: 500
    };

    const req = {};
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.responseData = data;
        return this;
      }
    };
    const next = () => {};

    errorHandler(genericError, req, res, next);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.responseData.success, false);
    assert.strictEqual(res.responseData.message, 'Something went wrong');
  });

  test('should handle errors without status code', () => {
    const error = {
      message: 'Unknown error'
    };

    const req = {};
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.responseData = data;
        return this;
      }
    };
    const next = () => {};

    errorHandler(error, req, res, next);

    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.responseData.success, false);
    assert.strictEqual(res.responseData.message, 'Unknown error');
  });

  test('should include stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = {
      message: 'Test error',
      stack: 'Error stack trace'
    };

    const req = {};
    const res = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.responseData = data;
        return this;
      }
    };
    const next = () => {};

    errorHandler(error, req, res, next);

    assert.strictEqual(res.responseData.stack, 'Error stack trace');

    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  test('should create 404 not found error', () => {
    const req = {
      originalUrl: '/nonexistent-route'
    };
    
    let capturedError = null;
    const res = {};
    const next = (error) => {
      capturedError = error;
    };

    notFound(req, res, next);

    assert(capturedError instanceof Error);
    assert.strictEqual(capturedError.statusCode, 404);
    assert(capturedError.message.includes('/nonexistent-route'));
  });
});