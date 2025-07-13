/**
 * @fileoverview Tests for Task Query Builder functionality
 * @module tests/models/TaskQueryBuilder
 */

import mongoose from 'mongoose';
import Task from '../../src/models/Task.js';
import {
  connectTestDB,
  disconnectTestDB,
  clearTestDB
} from '../config/database.test.js';

describe('Task Query Builder', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('Basic Query Builder', () => {
    beforeEach(async () => {
      // Create test tasks
      await Task.create([
        {
          title: 'Urgent meeting with client',
          description: 'Discuss project timeline and deliverables',
          status: 'pending',
          priority: 'high',
          estimatedTime: 60,
          actualTime: 90,
          createdAt: new Date('2024-01-15'),
          completedAt: null
        },
        {
          title: 'Code review for feature branch',
          description: 'Review pull request for new authentication system',
          status: 'in-progress',
          priority: 'medium',
          estimatedTime: 30,
          actualTime: 25,
          createdAt: new Date('2024-01-16'),
          completedAt: null
        },
        {
          title: 'Update documentation',
          description: 'Update API documentation with new endpoints',
          status: 'completed',
          priority: 'low',
          estimatedTime: 45,
          actualTime: 45,
          createdAt: new Date('2024-01-10'),
          completedAt: new Date('2024-01-12')
        },
        {
          title: 'Bug fix for login issue',
          description: 'Fix authentication bug in production',
          status: 'completed',
          priority: 'high',
          estimatedTime: 20,
          actualTime: 35,
          createdAt: new Date('2024-01-14'),
          completedAt: new Date('2024-01-15')
        },
        {
          title: 'Weekly team standup',
          description: 'Daily standup meeting with development team',
          status: 'pending',
          priority: 'medium',
          estimatedTime: 15,
          actualTime: null,
          createdAt: new Date('2024-01-17'),
          completedAt: null
        }
      ]);
    });

    test('should create query builder instance', () => {
      const builder = Task.queryBuilder();
      expect(builder).toBeDefined();
      expect(typeof builder.search).toBe('function');
      expect(typeof builder.status).toBe('function');
      expect(typeof builder.execute).toBe('function');
    });

    test('should filter by status', async () => {
      const pendingTasks = await Task.queryBuilder()
        .status('pending')
        .execute();

      expect(pendingTasks).toHaveLength(2);
      expect(pendingTasks.every((task) => task.status === 'pending')).toBe(
        true
      );
    });

    test('should filter by multiple statuses', async () => {
      const activeTasks = await Task.queryBuilder()
        .status(['pending', 'in-progress'])
        .execute();

      expect(activeTasks).toHaveLength(3);
      expect(
        activeTasks.every((task) =>
          ['pending', 'in-progress'].includes(task.status)
        )
      ).toBe(true);
    });

    test('should filter by priority', async () => {
      const highPriorityTasks = await Task.queryBuilder()
        .priority('high')
        .execute();

      expect(highPriorityTasks).toHaveLength(2);
      expect(highPriorityTasks.every((task) => task.priority === 'high')).toBe(
        true
      );
    });

    test('should filter by multiple priorities', async () => {
      const importantTasks = await Task.queryBuilder()
        .priority(['high', 'medium'])
        .execute();

      expect(importantTasks).toHaveLength(4);
      expect(
        importantTasks.every((task) =>
          ['high', 'medium'].includes(task.priority)
        )
      ).toBe(true);
    });

    test('should search by title', async () => {
      const meetingTasks = await Task.queryBuilder().title('meeting').execute();

      expect(meetingTasks).toHaveLength(2);
      expect(
        meetingTasks.every((task) =>
          task.title.toLowerCase().includes('meeting')
        )
      ).toBe(true);
    });

    test('should search by description', async () => {
      const reviewTasks = await Task.queryBuilder()
        .description('review')
        .execute();

      expect(reviewTasks).toHaveLength(1);
      expect(reviewTasks[0].description.toLowerCase().includes('review')).toBe(
        true
      );
    });

    test('should filter by completion status', async () => {
      const completedTasks = await Task.queryBuilder()
        .isCompleted(true)
        .execute();

      expect(completedTasks).toHaveLength(2);
      expect(completedTasks.every((task) => task.completedAt !== null)).toBe(
        true
      );

      const pendingTasks = await Task.queryBuilder()
        .isCompleted(false)
        .execute();

      expect(pendingTasks).toHaveLength(3);
      expect(pendingTasks.every((task) => task.completedAt === null)).toBe(
        true
      );
    });

    test('should filter by estimated time range', async () => {
      const shortTasks = await Task.queryBuilder()
        .estimatedTimeRange({ max: 30 })
        .execute();

      expect(shortTasks).toHaveLength(2);
      expect(shortTasks.every((task) => task.estimatedTime <= 30)).toBe(true);
    });

    test('should filter by actual time range', async () => {
      const longTasks = await Task.queryBuilder()
        .actualTimeRange({ min: 30 })
        .execute();

      expect(longTasks).toHaveLength(3);
      expect(longTasks.every((task) => task.actualTime >= 30)).toBe(true);
    });

    test('should filter by time efficiency', async () => {
      const overEstimatedTasks = await Task.queryBuilder()
        .timeEfficiency('over-estimated')
        .execute();

      expect(overEstimatedTasks).toHaveLength(2);
      expect(
        overEstimatedTasks.every((task) => task.actualTime > task.estimatedTime)
      ).toBe(true);

      const underEstimatedTasks = await Task.queryBuilder()
        .timeEfficiency('under-estimated')
        .execute();

      expect(underEstimatedTasks).toHaveLength(1);
      expect(
        underEstimatedTasks.every(
          (task) => task.actualTime < task.estimatedTime
        )
      ).toBe(true);

      const accurateTasks = await Task.queryBuilder()
        .timeEfficiency('accurate')
        .execute();

      expect(accurateTasks).toHaveLength(1);
      expect(
        accurateTasks.every((task) => task.actualTime === task.estimatedTime)
      ).toBe(true);
    });

    test('should filter by existence of estimated time', async () => {
      const tasksWithEstimate = await Task.queryBuilder()
        .hasEstimatedTime(true)
        .execute();

      expect(tasksWithEstimate).toHaveLength(5);
      expect(
        tasksWithEstimate.every(
          (task) =>
            task.estimatedTime !== null && task.estimatedTime !== undefined
        )
      ).toBe(true);
    });

    test('should filter by existence of actual time', async () => {
      const tasksWithActualTime = await Task.queryBuilder()
        .hasActualTime(true)
        .execute();

      expect(tasksWithActualTime).toHaveLength(4);
      expect(
        tasksWithActualTime.every(
          (task) => task.actualTime !== null && task.actualTime !== undefined
        )
      ).toBe(true);
    });

    test('should filter by date range', async () => {
      const recentTasks = await Task.queryBuilder()
        .createdAtRange({ start: '2024-01-15' })
        .execute();

      expect(recentTasks).toHaveLength(3);
      expect(
        recentTasks.every((task) => task.createdAt >= new Date('2024-01-15'))
      ).toBe(true);
    });

    test('should sort results', async () => {
      const tasksByPriority = await Task.queryBuilder()
        .sortBy('priority', 'desc')
        .execute();

      const priorities = tasksByPriority.map((task) => task.priority);
      expect(priorities).toEqual(['high', 'high', 'medium', 'medium', 'low']);
    });

    test('should paginate results', async () => {
      const result = await Task.queryBuilder()
        .sortBy('createdAt', 'desc')
        .paginate(1, 2)
        .executeWithPagination();

      expect(result.tasks).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.pages).toBe(3);
    });

    test('should select specific fields', async () => {
      const tasks = await Task.queryBuilder()
        .select(['title', 'status'])
        .execute();

      expect(tasks).toHaveLength(5);
      expect(tasks[0]).toHaveProperty('title');
      expect(tasks[0]).toHaveProperty('status');
      expect(tasks[0]).not.toHaveProperty('description');
      expect(tasks[0]).not.toHaveProperty('priority');
    });

    test('should combine multiple filters', async () => {
      const urgentPendingTasks = await Task.queryBuilder()
        .status('pending')
        .priority('high')
        .title('urgent')
        .execute();

      expect(urgentPendingTasks).toHaveLength(1);
      expect(urgentPendingTasks[0].title).toContain('Urgent');
      expect(urgentPendingTasks[0].status).toBe('pending');
      expect(urgentPendingTasks[0].priority).toBe('high');
    });

    test('should use custom where conditions', async () => {
      const customTasks = await Task.queryBuilder()
        .where({ title: { $regex: 'bug', $options: 'i' } })
        .execute();

      expect(customTasks).toHaveLength(1);
      expect(customTasks[0].title.toLowerCase()).toContain('bug');
    });

    test('should use OR conditions', async () => {
      const orTasks = await Task.queryBuilder()
        .orWhere([{ status: 'completed' }, { priority: 'high' }])
        .execute();

      expect(orTasks).toHaveLength(3);
      expect(orTasks.some((task) => task.status === 'completed')).toBe(true);
      expect(orTasks.some((task) => task.priority === 'high')).toBe(true);
    });

    test('should use AND conditions', async () => {
      const andTasks = await Task.queryBuilder()
        .andWhere([{ status: 'completed' }, { priority: 'high' }])
        .execute();

      expect(andTasks).toHaveLength(1);
      expect(andTasks[0].status).toBe('completed');
      expect(andTasks[0].priority).toBe('high');
    });

    test('should count results', async () => {
      const count = await Task.queryBuilder().status('pending').count();

      expect(count).toBe(2);
    });
  });

  describe('Advanced Search', () => {
    beforeEach(async () => {
      await Task.create([
        {
          title: 'Database optimization',
          description: 'Optimize MongoDB queries and indexes',
          status: 'in-progress',
          priority: 'high',
          estimatedTime: 120,
          actualTime: 150,
          createdAt: new Date('2024-01-20'),
          completedAt: null
        },
        {
          title: 'Frontend bug fix',
          description: 'Fix responsive design issues',
          status: 'completed',
          priority: 'medium',
          estimatedTime: 60,
          actualTime: 45,
          createdAt: new Date('2024-01-18'),
          completedAt: new Date('2024-01-19')
        }
      ]);
    });

    test('should perform advanced search with filters', async () => {
      const result = await Task.advancedSearch(
        {
          status: ['in-progress', 'completed'],
          priority: 'high',
          timeEfficiency: 'over-estimated'
        },
        {
          sortBy: 'createdAt',
          sortOrder: 'desc',
          page: 1,
          limit: 10
        }
      );

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].status).toBe('in-progress');
      expect(result.tasks[0].priority).toBe('high');
      expect(result.pagination.total).toBe(1);
    });

    test('should handle complex date range queries', async () => {
      const result = await Task.advancedSearch({
        createdAtRange: {
          start: '2024-01-18',
          end: '2024-01-21'
        }
      });

      expect(result.tasks).toHaveLength(2);
      expect(
        result.tasks.every(
          (task) =>
            task.createdAt >= new Date('2024-01-18') &&
            task.createdAt <= new Date('2024-01-21')
        )
      ).toBe(true);
    });

    test('should handle text search with additional filters', async () => {
      const result = await Task.advancedSearch({
        search: 'bug',
        status: 'completed'
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title.toLowerCase()).toContain('bug');
      expect(result.tasks[0].status).toBe('completed');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid date ranges gracefully', async () => {
      const result = await Task.queryBuilder()
        .createdAtRange({ start: 'invalid-date' })
        .execute();

      expect(result).toHaveLength(0);
    });

    test('should handle empty filters', async () => {
      const result = await Task.queryBuilder()
        .status('')
        .priority(null)
        .execute();

      expect(result).toHaveLength(0);
    });

    test('should handle non-existent status values', async () => {
      const result = await Task.queryBuilder()
        .status('non-existent-status')
        .execute();

      expect(result).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      // Create many tasks for performance testing
      const tasks = [];
      for (let i = 0; i < 100; i++) {
        tasks.push({
          title: `Task ${i}`,
          description: `Description for task ${i}`,
          status: ['pending', 'in-progress', 'completed'][i % 3],
          priority: ['low', 'medium', 'high'][i % 3],
          estimatedTime: Math.floor(Math.random() * 120) + 15,
          actualTime: Math.floor(Math.random() * 180) + 10,
          createdAt: new Date(2024, 0, 1 + (i % 30)),
          completedAt: i % 3 === 2 ? new Date(2024, 0, 1 + (i % 30) + 1) : null
        });
      }
      await Task.create(tasks);
    });

    test('should handle large result sets with pagination', async () => {
      const startTime = Date.now();

      const result = await Task.queryBuilder()
        .paginate(1, 50)
        .executeWithPagination();

      const endTime = Date.now();

      expect(result.tasks).toHaveLength(50);
      expect(result.pagination.total).toBe(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should efficiently filter large datasets', async () => {
      const startTime = Date.now();

      const result = await Task.queryBuilder()
        .status('pending')
        .priority('high')
        .execute();

      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
