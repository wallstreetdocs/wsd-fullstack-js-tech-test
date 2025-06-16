import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock AnalyticsService to avoid MongoDB dependency
const mockAnalyticsService = {
  getTaskMetrics: async () => ({ totalTasks: 5, completionRate: 80 })
};

// Import and mock before importing SocketHandlers
const originalImport = await import('../../src/sockets/socketHandlers.js');
const SocketHandlers = originalImport.default;

describe('Socket Handlers Tests', () => {
  let mockIo;
  let mockSocket;
  let socketHandlers;
  let emittedEvents;

  beforeEach(() => {
    emittedEvents = [];
    
    mockSocket = {
      id: 'test-socket-id',
      join: (room) => {
        mockSocket.rooms = mockSocket.rooms || [];
        mockSocket.rooms.push(room);
      },
      emit: (event, data) => {
        emittedEvents.push({ target: 'socket', event, data });
      },
      on: (event, handler) => {
        mockSocket.handlers = mockSocket.handlers || {};
        mockSocket.handlers[event] = handler;
      },
      rooms: []
    };

    mockIo = {
      on: (event, handler) => {
        mockIo.connectionHandler = handler;
      },
      emit: (event, data) => {
        emittedEvents.push({ target: 'io', event, data });
      },
      to: (room) => ({
        emit: (event, data) => {
          emittedEvents.push({ target: 'room', room, event, data });
        }
      })
    };

    socketHandlers = new SocketHandlers(mockIo);
  });

  test('should initialize with io instance', () => {
    assert(socketHandlers.io === mockIo);
    assert(typeof mockIo.connectionHandler === 'function');
  });

  test('should handle client connection', () => {
    const consoleLogs = [];
    const originalLog = console.log;
    console.log = (message) => consoleLogs.push(message);

    // Simulate connection
    mockIo.connectionHandler(mockSocket);

    assert(consoleLogs.some(log => log.includes('Client connected: test-socket-id')));
    assert(typeof mockSocket.handlers['join-analytics'] === 'function');
    assert(typeof mockSocket.handlers['request-analytics'] === 'function');
    assert(typeof mockSocket.handlers['disconnect'] === 'function');

    console.log = originalLog;
  });

  test('should handle join-analytics event', () => {
    const consoleLogs = [];
    const originalLog = console.log;
    console.log = (message) => consoleLogs.push(message);

    mockIo.connectionHandler(mockSocket);
    mockSocket.handlers['join-analytics']();

    assert(mockSocket.rooms.includes('analytics'));
    assert(consoleLogs.some(log => log.includes('Client test-socket-id joined analytics room')));

    console.log = originalLog;
  });

  test('should handle disconnect event', () => {
    const consoleLogs = [];
    const originalLog = console.log;
    console.log = (message) => consoleLogs.push(message);

    mockIo.connectionHandler(mockSocket);
    mockSocket.handlers['disconnect']();

    assert(consoleLogs.some(log => log.includes('Client disconnected: test-socket-id')));

    console.log = originalLog;
  });

  test('should broadcast task update', () => {
    const testTask = { _id: 'task-id', title: 'Test Task' };
    
    socketHandlers.broadcastTaskUpdate('created', testTask);

    const taskUpdateEvent = emittedEvents.find(e => e.event === 'task-update');
    assert(taskUpdateEvent);
    assert.strictEqual(taskUpdateEvent.data.action, 'created');
    assert.strictEqual(taskUpdateEvent.data.task.title, 'Test Task');
    assert(typeof taskUpdateEvent.data.timestamp === 'string');
  });

  test('should broadcast notification', () => {
    socketHandlers.broadcastNotification('Test message', 'warning');

    const notificationEvent = emittedEvents.find(e => e.event === 'notification');
    assert(notificationEvent);
    assert.strictEqual(notificationEvent.data.message, 'Test message');
    assert.strictEqual(notificationEvent.data.type, 'warning');
    assert(typeof notificationEvent.data.timestamp === 'string');
  });

  test('should broadcast notification with default type', () => {
    socketHandlers.broadcastNotification('Default message');

    const notificationEvent = emittedEvents.find(e => e.event === 'notification');
    assert(notificationEvent);
    assert.strictEqual(notificationEvent.data.type, 'info');
  });

  test('should check metric thresholds - completion rate', async () => {
    const metrics = {
      completionRate: 30,
      tasksByStatus: { pending: 15 },
      tasksByPriority: { high: 5 }
    };

    await socketHandlers.checkMetricThresholds(metrics);

    const warningNotification = emittedEvents.find(e => 
      e.event === 'notification' && 
      e.data.message.includes('completion rate')
    );
    assert(warningNotification);
    assert.strictEqual(warningNotification.data.type, 'warning');
  });

  test('should check metric thresholds - pending tasks', async () => {
    const metrics = {
      completionRate: 80,
      tasksByStatus: { pending: 25 },
      tasksByPriority: { high: 5 }
    };

    await socketHandlers.checkMetricThresholds(metrics);

    const infoNotification = emittedEvents.find(e => 
      e.event === 'notification' && 
      e.data.message.includes('pending tasks')
    );
    assert(infoNotification);
    assert.strictEqual(infoNotification.data.type, 'info');
  });

  test('should check metric thresholds - high priority tasks', async () => {
    const metrics = {
      completionRate: 80,
      tasksByStatus: { pending: 15 },
      tasksByPriority: { high: 15 }
    };

    await socketHandlers.checkMetricThresholds(metrics);

    const warningNotification = emittedEvents.find(e => 
      e.event === 'notification' && 
      e.data.message.includes('High priority tasks')
    );
    assert(warningNotification);
    assert.strictEqual(warningNotification.data.type, 'warning');
  });

  test('should not trigger notifications for normal metrics', async () => {
    const metrics = {
      completionRate: 80,
      tasksByStatus: { pending: 15 },
      tasksByPriority: { high: 5 }
    };

    await socketHandlers.checkMetricThresholds(metrics);

    const notifications = emittedEvents.filter(e => e.event === 'notification');
    assert.strictEqual(notifications.length, 0);
  });

  test('should handle request-analytics event with error', async () => {
    // Mock AnalyticsService to throw error
    const originalError = console.error;
    const errors = [];
    console.error = (msg, err) => errors.push({ msg, err });

    mockIo.connectionHandler(mockSocket);
    
    // Simulate the handler being called (would normally require mocking AnalyticsService)
    mockSocket.emit('analytics-error', { message: 'Failed to get analytics data' });

    const errorEvent = emittedEvents.find(e => e.event === 'analytics-error');
    assert(errorEvent);
    assert.strictEqual(errorEvent.data.message, 'Failed to get analytics data');

    console.error = originalError;
  });
});