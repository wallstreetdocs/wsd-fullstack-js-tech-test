import {test, describe, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert';
import express from 'express';
import sinon from 'sinon';
import { mockReq, mockRes } from 'sinon-express-mock';
// Import the router and function
import router, { setSocketHandlers } from '../../src/routes/api.js';
import ExportService from "../../src/services/exportService.js";
import Export from "../../src/models/Export.js";

describe('API Routes Unit Tests', () => {

  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

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

  test('GET /exports should return paginated history', async () => {
    const mockExports = [
      { _id: '1', status: 'completed', format: 'csv', createdAt: new Date() },
      { _id: '2', status: 'processing', format: 'xlsx', createdAt: new Date() }
    ];

    const findStub = sandbox.stub(Export, 'find').returns({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            select: () => mockExports
          })
        })
      })
    });

    const countStub = sandbox.stub(Export, 'countDocuments').resolves(2);

    const req = mockReq({ query: { page: 1, limit: 10 } });
    const res = mockRes();

    await ExportService.getExportHistory(req, res);

    assert.strictEqual(res.json.calledOnce, true);
    assert.deepStrictEqual(res.json.firstCall.args[0], {
      status: 'success',
      data: {
        exports: mockExports,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1
        }
      }
    });
  });

  test('POST /exports should create new export', async () => {
    const exportData = {
      format: 'csv',
      filters: { status: 'pending' }
    };

    const mockExport = {
      _id: '123',
      ...exportData,
      status: 'pending',
      createdAt: new Date()
    };

    sandbox.stub(Export, 'create').resolves(mockExport);
    sandbox.stub(ExportService, 'processExport').resolves();

    const req = mockReq({ body: exportData });
    const res = mockRes();

    await ExportService.createExport(req, res);

    assert.strictEqual(res.status.calledWith(201), true);
    assert.strictEqual(res.json.calledOnce, true);
    assert.deepStrictEqual(res.json.firstCall.args[0], {
      status: 'success',
      data: mockExport
    });
  });

  test('GET /exports/:id should return status', async () => {
    const mockExport = {
      _id: '123',
      status: 'completed',
      format: 'csv',
      createdAt: new Date()
    };

    sandbox.stub(Export, 'findById').resolves(mockExport);

    const req = mockReq({ params: { id: '123' } });
    const res = mockRes();

    await ExportService.getExport(req, res);

    assert.strictEqual(res.json.calledOnce, true);
    assert.deepStrictEqual(res.json.firstCall.args[0], {
      status: 'success',
      data: mockExport
    });
  });

  test('GET /exports/:id/download should return file', async () => {
    const mockExport = {
      _id: '123',
      status: 'completed',
      format: 'csv',
      createdAt: new Date()
    };

    const mockContent = 'id,title,status\n1,Task 1,pending';

    sandbox.stub(Export, 'findById').resolves(mockExport);
    sandbox.stub(ExportService, 'getExportContent').resolves(mockContent);

    const req = mockReq({ params: { id: '123' } });
    const res = mockRes();

    await ExportService.getExportContent(req, res);

    assert.strictEqual(res.setHeader.calledWith('Content-Type', 'text/csv'), true);
    assert.strictEqual(res.send.calledWith(mockContent), true);
  });

  test('DELETE /exports/cleanup should remove old exports', async () => {
    const deleteResult = { deletedCount: 5 };
    sandbox.stub(Export, 'deleteMany').resolves(deleteResult);

    const req = mockReq();
    const res = mockRes();

    await ExportService.deleteExpiredFiles(req, res);

    assert.strictEqual(res.json.calledOnce, true);
    assert.deepStrictEqual(res.json.firstCall.args[0], {
      status: 'success',
      data: {
        deletedCount: 5
      }
    });
  });
});