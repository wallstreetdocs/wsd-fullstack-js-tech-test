/**
 * @fileoverview Practical examples of using the Task Query Builder
 * @module examples/query-builder-examples
 */

import Task from '../src/models/Task.js';

/**
 * Example 1: Find all urgent high-priority tasks that are overdue
 */
export async function findOverdueUrgentTasks() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const overdueTasks = await Task.queryBuilder()
    .priority('high')
    .status(['pending', 'in-progress'])
    .createdAtRange({ start: oneWeekAgo.toISOString() })
    .title('urgent')
    .sortBy('createdAt', 'asc')
    .execute();

  console.log('Overdue urgent tasks:', overdueTasks.length);
  return overdueTasks;
}

/**
 * Example 2: Find tasks completed this week with time efficiency analysis
 */
export async function findCompletedTasksThisWeek() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const completedThisWeek = await Task.queryBuilder()
    .status('completed')
    .completedAtRange({ start: oneWeekAgo.toISOString() })
    .hasActualTime(true)
    .hasEstimatedTime(true)
    .sortBy('completedAt', 'desc')
    .execute();

  // Analyze time efficiency
  const overEstimated = completedThisWeek.filter(
    (task) => task.actualTime > task.estimatedTime
  );
  const underEstimated = completedThisWeek.filter(
    (task) => task.actualTime < task.estimatedTime
  );
  const accurate = completedThisWeek.filter(
    (task) => task.actualTime === task.estimatedTime
  );

  console.log(`Completed this week: ${completedThisWeek.length}`);
  console.log(`Over-estimated: ${overEstimated.length}`);
  console.log(`Under-estimated: ${underEstimated.length}`);
  console.log(`Accurate: ${accurate.length}`);

  return {
    total: completedThisWeek.length,
    overEstimated: overEstimated.length,
    underEstimated: underEstimated.length,
    accurate: accurate.length,
    tasks: completedThisWeek
  };
}

/**
 * Example 3: Find tasks that need attention (high priority + pending for more than 3 days)
 */
export async function findTasksNeedingAttention() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const attentionNeeded = await Task.queryBuilder()
    .priority('high')
    .status('pending')
    .createdAtRange({ start: threeDaysAgo.toISOString() })
    .sortBy('createdAt', 'asc')
    .execute();

  console.log('Tasks needing attention:', attentionNeeded.length);
  return attentionNeeded;
}

/**
 * Example 4: Get productivity statistics for the current month
 */
export async function getMonthlyProductivityStats() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);

  // Get all tasks for the month
  const monthlyTasks = await Task.queryBuilder()
    .createdAtRange({
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString()
    })
    .execute();

  // Calculate statistics
  const completed = monthlyTasks.filter((task) => task.status === 'completed');
  const pending = monthlyTasks.filter((task) => task.status === 'pending');
  const inProgress = monthlyTasks.filter(
    (task) => task.status === 'in-progress'
  );

  const totalEstimatedTime = monthlyTasks
    .filter((task) => task.estimatedTime)
    .reduce((sum, task) => sum + task.estimatedTime, 0);

  const totalActualTime = monthlyTasks
    .filter((task) => task.actualTime)
    .reduce((sum, task) => sum + task.actualTime, 0);

  const completionRate =
    monthlyTasks.length > 0
      ? (completed.length / monthlyTasks.length) * 100
      : 0;

  const timeAccuracy =
    totalEstimatedTime > 0 ? (totalActualTime / totalEstimatedTime) * 100 : 0;

  return {
    totalTasks: monthlyTasks.length,
    completed: completed.length,
    pending: pending.length,
    inProgress: inProgress.length,
    completionRate: Math.round(completionRate * 100) / 100,
    totalEstimatedTime,
    totalActualTime,
    timeAccuracy: Math.round(timeAccuracy * 100) / 100,
    tasks: monthlyTasks
  };
}

/**
 * Example 5: Find tasks with specific patterns using complex queries
 */
export async function findTasksWithPatterns() {
  // Find tasks that are either urgent or have bugs
  const urgentOrBugTasks = await Task.queryBuilder()
    .orWhere([
      { title: { $regex: 'urgent', $options: 'i' } },
      { title: { $regex: 'bug', $options: 'i' } },
      { description: { $regex: 'bug', $options: 'i' } }
    ])
    .status(['pending', 'in-progress'])
    .sortBy('priority', 'desc')
    .execute();

  // Find tasks that are both high priority and have time estimates
  const highPriorityWithEstimates = await Task.queryBuilder()
    .andWhere([
      { priority: 'high' },
      { estimatedTime: { $exists: true, $ne: null } }
    ])
    .hasEstimatedTime(true)
    .sortBy('estimatedTime', 'asc')
    .execute();

  return {
    urgentOrBugTasks,
    highPriorityWithEstimates
  };
}

/**
 * Example 6: Advanced search with multiple criteria
 */
export async function advancedTaskSearch(searchTerm, filters = {}) {
  const builder = Task.queryBuilder();

  // Add text search if provided
  if (searchTerm) {
    builder.search(searchTerm);
  }

  // Apply filters
  if (filters.status) {
    builder.status(filters.status);
  }
  if (filters.priority) {
    builder.priority(filters.priority);
  }
  if (filters.dateRange) {
    builder.createdAtRange(filters.dateRange);
  }
  if (filters.timeEfficiency) {
    builder.timeEfficiency(filters.timeEfficiency);
  }

  // Apply sorting and pagination
  builder
    .sortBy(filters.sortBy || 'createdAt', filters.sortOrder || 'desc')
    .paginate(filters.page || 1, filters.limit || 20);

  const result = await builder.executeWithPagination();

  return result;
}

/**
 * Example 7: Get dashboard statistics
 */
export async function getDashboardStats() {
  const today = new Date();
  const startOfWeek = new Date();
  startOfWeek.setDate(today.getDate() - today.getDay());

  // Get counts for different statuses
  const [total, pending, inProgress, completed] = await Promise.all([
    Task.queryBuilder().count(),
    Task.queryBuilder().status('pending').count(),
    Task.queryBuilder().status('in-progress').count(),
    Task.queryBuilder().status('completed').count()
  ]);

  // Get high priority tasks
  const highPriority = await Task.queryBuilder()
    .priority('high')
    .status(['pending', 'in-progress'])
    .count();

  // Get tasks completed this week
  const completedThisWeek = await Task.queryBuilder()
    .status('completed')
    .completedAtRange({ start: startOfWeek.toISOString() })
    .count();

  // Get overdue tasks (created more than 7 days ago and still pending)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const overdue = await Task.queryBuilder()
    .status(['pending', 'in-progress'])
    .createdAtRange({ start: sevenDaysAgo.toISOString() })
    .count();

  return {
    total,
    byStatus: {
      pending,
      inProgress,
      completed
    },
    highPriority,
    completedThisWeek,
    overdue,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
  };
}

/**
 * Example 8: Find tasks for specific time management analysis
 */
export async function analyzeTimeManagement() {
  // Find tasks that were significantly over-estimated
  const overEstimated = await Task.queryBuilder()
    .timeEfficiency('over-estimated')
    .hasEstimatedTime(true)
    .hasActualTime(true)
    .sortBy('actualTime', 'desc')
    .execute();

  // Find tasks that were significantly under-estimated
  const underEstimated = await Task.queryBuilder()
    .timeEfficiency('under-estimated')
    .hasEstimatedTime(true)
    .hasActualTime(true)
    .sortBy('estimatedTime', 'desc')
    .execute();

  // Find tasks without time estimates
  const noEstimates = await Task.queryBuilder()
    .hasEstimatedTime(false)
    .status(['pending', 'in-progress'])
    .sortBy('createdAt', 'desc')
    .execute();

  // Calculate average estimation accuracy
  const tasksWithBoth = await Task.queryBuilder()
    .hasEstimatedTime(true)
    .hasActualTime(true)
    .execute();

  const totalAccuracy = tasksWithBoth.reduce((sum, task) => {
    const accuracy =
      Math.abs(task.actualTime - task.estimatedTime) / task.estimatedTime;
    return sum + accuracy;
  }, 0);

  const averageAccuracy =
    tasksWithBoth.length > 0 ? (totalAccuracy / tasksWithBoth.length) * 100 : 0;

  return {
    overEstimated: {
      count: overEstimated.length,
      tasks: overEstimated
    },
    underEstimated: {
      count: underEstimated.length,
      tasks: underEstimated
    },
    noEstimates: {
      count: noEstimates.length,
      tasks: noEstimates
    },
    averageAccuracy: Math.round(averageAccuracy * 100) / 100
  };
}

/**
 * Example 9: Export tasks with specific criteria
 */
export async function exportTasksForReport(criteria = {}) {
  const builder = Task.queryBuilder();

  // Apply criteria
  if (criteria.status) builder.status(criteria.status);
  if (criteria.priority) builder.priority(criteria.priority);
  if (criteria.dateRange) builder.createdAtRange(criteria.dateRange);
  if (criteria.search) builder.search(criteria.search);

  // Select only necessary fields for export
  builder
    .select([
      'title',
      'description',
      'status',
      'priority',
      'createdAt',
      'completedAt',
      'estimatedTime',
      'actualTime'
    ])
    .sortBy('createdAt', 'desc');

  const tasks = await builder.execute();

  // Transform for export
  const exportData = tasks.map((task) => ({
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    created: task.createdAt.toISOString().split('T')[0],
    completed: task.completedAt
      ? task.completedAt.toISOString().split('T')[0]
      : '',
    estimatedTime: task.estimatedTime || '',
    actualTime: task.actualTime || '',
    timeEfficiency:
      task.estimatedTime && task.actualTime
        ? task.actualTime > task.estimatedTime
          ? 'Over'
          : task.actualTime < task.estimatedTime
            ? 'Under'
            : 'Accurate'
        : 'N/A'
  }));

  return exportData;
}

/**
 * Example 10: Find tasks for team workload analysis
 */
export async function analyzeTeamWorkload() {
  const currentDate = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  // Get tasks by priority distribution
  const [lowPriority, mediumPriority, highPriority] = await Promise.all([
    Task.queryBuilder().priority('low').count(),
    Task.queryBuilder().priority('medium').count(),
    Task.queryBuilder().priority('high').count()
  ]);

  // Get tasks by status distribution
  const [pendingCount, inProgressCount, completedCount] = await Promise.all([
    Task.queryBuilder().status('pending').count(),
    Task.queryBuilder().status('in-progress').count(),
    Task.queryBuilder().status('completed').count()
  ]);

  // Get recent activity (last 30 days)
  const recentActivity = await Task.queryBuilder()
    .createdAtRange({ start: lastMonth.toISOString() })
    .sortBy('createdAt', 'desc')
    .execute();

  // Calculate workload metrics
  const totalTasks = lowPriority + mediumPriority + highPriority;
  const activeTasks = pendingCount + inProgressCount;
  const completionRate =
    totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  return {
    priorityDistribution: {
      low: lowPriority,
      medium: mediumPriority,
      high: highPriority,
      total: totalTasks
    },
    statusDistribution: {
      pending: pendingCount,
      inProgress: inProgressCount,
      completed: completedCount,
      total: totalTasks
    },
    workloadMetrics: {
      activeTasks,
      completionRate: Math.round(completionRate * 100) / 100,
      recentActivity: recentActivity.length
    },
    recentActivity
  };
}

// Example usage
export async function runExamples() {
  console.log('=== Task Query Builder Examples ===\n');

  try {
    // Example 1: Find overdue urgent tasks
    console.log('1. Finding overdue urgent tasks...');
    const overdueTasks = await findOverdueUrgentTasks();
    console.log(`Found ${overdueTasks.length} overdue urgent tasks\n`);

    // Example 2: Weekly completion analysis
    console.log('2. Analyzing completed tasks this week...');
    const weeklyStats = await findCompletedTasksThisWeek();
    console.log(`Weekly completion rate: ${weeklyStats.completionRate}%\n`);

    // Example 3: Tasks needing attention
    console.log('3. Finding tasks needing attention...');
    const attentionTasks = await findTasksNeedingAttention();
    console.log(`Found ${attentionTasks.length} tasks needing attention\n`);

    // Example 4: Monthly productivity
    console.log('4. Getting monthly productivity stats...');
    const monthlyStats = await getMonthlyProductivityStats();
    console.log(`Monthly completion rate: ${monthlyStats.completionRate}%`);
    console.log(`Time accuracy: ${monthlyStats.timeAccuracy}%\n`);

    // Example 5: Pattern-based search
    console.log('5. Finding tasks with specific patterns...');
    const patternResults = await findTasksWithPatterns();
    console.log(
      `Found ${patternResults.urgentOrBugTasks.length} urgent or bug-related tasks`
    );
    console.log(
      `Found ${patternResults.highPriorityWithEstimates.length} high priority tasks with estimates\n`
    );

    // Example 6: Advanced search
    console.log('6. Performing advanced search...');
    const searchResults = await advancedTaskSearch('meeting', {
      status: ['pending', 'in-progress'],
      priority: 'high',
      page: 1,
      limit: 10
    });
    console.log(
      `Advanced search found ${searchResults.tasks.length} results\n`
    );

    // Example 7: Dashboard stats
    console.log('7. Getting dashboard statistics...');
    const dashboardStats = await getDashboardStats();
    console.log(
      `Dashboard - Total: ${dashboardStats.total}, Pending: ${dashboardStats.byStatus.pending}, High Priority: ${dashboardStats.highPriority}\n`
    );

    // Example 8: Time management analysis
    console.log('8. Analyzing time management...');
    const timeAnalysis = await analyzeTimeManagement();
    console.log(
      `Time management - Over-estimated: ${timeAnalysis.overEstimated.count}, Under-estimated: ${timeAnalysis.underEstimated.count}, Average accuracy: ${timeAnalysis.averageAccuracy}%\n`
    );

    // Example 9: Export data
    console.log('9. Exporting tasks for report...');
    const exportData = await exportTasksForReport({
      status: 'completed',
      dateRange: { start: '2024-01-01', end: '2024-12-31' }
    });
    console.log(`Exported ${exportData.length} completed tasks\n`);

    // Example 10: Team workload analysis
    console.log('10. Analyzing team workload...');
    const workloadAnalysis = await analyzeTeamWorkload();
    console.log(
      `Workload - Active tasks: ${workloadAnalysis.workloadMetrics.activeTasks}, Completion rate: ${workloadAnalysis.workloadMetrics.completionRate}%\n`
    );

    console.log('=== All examples completed successfully ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}
