/**
 * @fileoverview Query builder service for task filtering and sorting
 * @module services/queryBuilderService
 */

/**
 * Builds MongoDB query for task filtering
 * @param {Object} filters - Filter parameters
 * @param {string|string[]} [filters.status] - Task status filter
 * @param {string|string[]} [filters.priority] - Task priority filter
 * @param {string} [filters.createdAfter] - Tasks created after date (ISO string)
 * @param {string} [filters.createdBefore] - Tasks created before date (ISO string)
 * @param {string} [filters.completedAfter] - Tasks completed after date (ISO string)
 * @param {string} [filters.completedBefore] - Tasks completed before date (ISO string)
 * @param {string} [filters.updatedAfter] - Tasks updated after date (ISO string)
 * @param {string} [filters.updatedBefore] - Tasks updated before date (ISO string)
 * @param {string} [filters.createdWithin] - Predefined date range (last-7-days, last-30-days, last-90-days)
 * @param {string} [filters.completedWithin] - Predefined completion date range
 * @param {boolean} [filters.overdueTasks] - Filter for overdue tasks (in-progress > 7 days)
 * @param {boolean} [filters.recentlyCompleted] - Filter for recently completed tasks (< 7 days)
 * @param {number} [filters.estimatedTimeMin] - Minimum estimated time in minutes
 * @param {number} [filters.estimatedTimeMax] - Maximum estimated time in minutes
 * @param {number} [filters.actualTimeMin] - Minimum actual time in minutes
 * @param {number} [filters.actualTimeMax] - Maximum actual time in minutes
 * @param {boolean} [filters.underEstimated] - Tasks that took longer than estimated
 * @param {boolean} [filters.overEstimated] - Tasks that took less than estimated
 * @param {boolean} [filters.noEstimate] - Tasks without estimated time
 * @returns {Object} MongoDB query object
 */
export const buildTaskQuery = (filters = {}) => {
  const queryParts = [];

  // Basic field filters - support both single values and arrays
  if (filters.status) {
    const statusQuery = Array.isArray(filters.status)
      ? { status: { $in: filters.status } }
      : { status: filters.status };
    queryParts.push(statusQuery);
  }

  if (filters.priority) {
    const priorityQuery = Array.isArray(filters.priority)
      ? { priority: { $in: filters.priority } }
      : { priority: filters.priority };
    queryParts.push(priorityQuery);
  }

  // Date range filters
  const dateQueries = buildDateQueries(filters);
  if (dateQueries.length > 0) {
    queryParts.push(...dateQueries);
  }

  // Time-based filters
  const timeQueries = buildTimeQueries(filters);
  if (timeQueries.length > 0) {
    queryParts.push(...timeQueries);
  }

  // Advanced status-based filters
  const statusQueries = buildAdvancedStatusQueries(filters);
  if (statusQueries.length > 0) {
    queryParts.push(...statusQueries);
  }

  // Performance-based filters
  const performanceQueries = buildPerformanceQueries(filters);
  if (performanceQueries.length > 0) {
    queryParts.push(...performanceQueries);
  }

  // Combine all queries with AND logic
  if (queryParts.length === 0) {
    return {};
  } else if (queryParts.length === 1) {
    return queryParts[0];
  } else {
    return { $and: queryParts };
  }
};

/**
 * Builds date-based query filters
 * @param {Object} filters - Filter parameters
 * @returns {Array} Array of date query objects
 */
const buildDateQueries = (filters) => {
  const queries = [];

  // Created date range
  if (filters.createdAfter || filters.createdBefore) {
    const createdQuery = { createdAt: {} };
    if (filters.createdAfter) {
      createdQuery.createdAt.$gte = new Date(filters.createdAfter);
    }
    if (filters.createdBefore) {
      createdQuery.createdAt.$lte = new Date(filters.createdBefore);
    }
    queries.push(createdQuery);
  }

  // Completed date range
  if (filters.completedAfter || filters.completedBefore) {
    const completedQuery = { completedAt: {} };
    if (filters.completedAfter) {
      completedQuery.completedAt.$gte = new Date(filters.completedAfter);
    }
    if (filters.completedBefore) {
      completedQuery.completedAt.$lte = new Date(filters.completedBefore);
    }
    queries.push(completedQuery);
  }

  // Updated date range
  if (filters.updatedAfter || filters.updatedBefore) {
    const updatedQuery = { updatedAt: {} };
    if (filters.updatedAfter) {
      updatedQuery.updatedAt.$gte = new Date(filters.updatedAfter);
    }
    if (filters.updatedBefore) {
      updatedQuery.updatedAt.$lte = new Date(filters.updatedBefore);
    }
    queries.push(updatedQuery);
  }

  // Predefined date ranges
  if (filters.createdWithin) {
    const createdWithinQuery = buildPredefinedDateQuery('createdAt', filters.createdWithin);
    if (createdWithinQuery) queries.push(createdWithinQuery);
  }

  if (filters.completedWithin) {
    const completedWithinQuery = buildPredefinedDateQuery('completedAt', filters.completedWithin);
    if (completedWithinQuery) queries.push(completedWithinQuery);
  }

  return queries;
};

/**
 * Builds predefined date range queries
 * @param {string} field - Date field name
 * @param {string} range - Predefined range (last-7-days, last-30-days, last-90-days)
 * @returns {Object|null} Date query object or null if invalid range
 */
const buildPredefinedDateQuery = (field, range) => {
  const rangeDays = {
    'last-7-days': 7,
    'last-30-days': 30,
    'last-90-days': 90
  };

  const days = rangeDays[range];
  if (!days) return null;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return { [field]: { $gte: startDate } };
};

/**
 * Builds time-based query filters
 * @param {Object} filters - Filter parameters
 * @returns {Array} Array of time query objects
 */
const buildTimeQueries = (filters) => {
  const queries = [];

  // Estimated time range
  if (filters.estimatedTimeMin || filters.estimatedTimeMax) {
    const estimatedQuery = { estimatedTime: {} };
    if (filters.estimatedTimeMin) {
      estimatedQuery.estimatedTime.$gte = parseInt(filters.estimatedTimeMin);
    }
    if (filters.estimatedTimeMax) {
      estimatedQuery.estimatedTime.$lte = parseInt(filters.estimatedTimeMax);
    }
    queries.push(estimatedQuery);
  }

  // Actual time range
  if (filters.actualTimeMin || filters.actualTimeMax) {
    const actualQuery = { actualTime: {} };
    if (filters.actualTimeMin) {
      actualQuery.actualTime.$gte = parseInt(filters.actualTimeMin);
    }
    if (filters.actualTimeMax) {
      actualQuery.actualTime.$lte = parseInt(filters.actualTimeMax);
    }
    queries.push(actualQuery);
  }

  // Tasks without estimated time
  if (filters.noEstimate === 'true' || filters.noEstimate === true) {
    queries.push({
      $or: [
        { estimatedTime: null },
        { estimatedTime: { $exists: false } }
      ]
    });
  }

  return queries;
};

/**
 * Builds advanced status-based query filters
 * @param {Object} filters - Filter parameters
 * @returns {Array} Array of status query objects
 */
const buildAdvancedStatusQueries = (filters) => {
  const queries = [];

  // Overdue tasks (in-progress for more than 7 days)
  if (filters.overdueTasks === 'true' || filters.overdueTasks === true) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    queries.push({
      $and: [
        { status: 'in-progress' },
        { createdAt: { $lt: sevenDaysAgo } }
      ]
    });
  }

  // Recently completed tasks (completed within last 7 days)
  if (filters.recentlyCompleted === 'true' || filters.recentlyCompleted === true) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    queries.push({
      $and: [
        { status: 'completed' },
        { completedAt: { $gte: sevenDaysAgo } }
      ]
    });
  }

  return queries;
};

/**
 * Builds performance-based query filters
 * @param {Object} filters - Filter parameters
 * @returns {Array} Array of performance query objects
 */
const buildPerformanceQueries = (filters) => {
  const queries = [];

  // Under-estimated tasks (actual time > estimated time)
  if (filters.underEstimated === 'true' || filters.underEstimated === true) {
    queries.push({
      $and: [
        { status: 'completed' },
        { estimatedTime: { $exists: true, $ne: null } },
        { actualTime: { $exists: true, $ne: null } },
        { $expr: { $gt: ['$actualTime', '$estimatedTime'] } }
      ]
    });
  }

  // Over-estimated tasks (actual time < estimated time)
  if (filters.overEstimated === 'true' || filters.overEstimated === true) {
    queries.push({
      $and: [
        { status: 'completed' },
        { estimatedTime: { $exists: true, $ne: null } },
        { actualTime: { $exists: true, $ne: null } },
        { $expr: { $lt: ['$actualTime', '$estimatedTime'] } }
      ]
    });
  }

  return queries;
};

/**
 * Builds sorting query object
 * @param {Object} filters - Filter parameters
 * @param {string} [filters.sortBy=createdAt] - Field to sort by
 * @param {string} [filters.sortOrder=desc] - Sort order (asc/desc)
 * @returns {Object} MongoDB sort object
 */
export const buildSortQuery = (filters = {}) => {
  const sortField = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

  return { [sortField]: sortOrder };
};

/**
 * Validates and sanitizes filter parameters
 * @param {Object} filters - Raw filter parameters
 * @returns {Object} Sanitized filter parameters
 */
export const sanitizeFilters = (filters = {}) => {
  const sanitized = { ...filters };

  // Convert string arrays to actual arrays
  ['status', 'priority'].forEach(field => {
    if (typeof sanitized[field] === 'string' && sanitized[field].includes(',')) {
      sanitized[field] = sanitized[field].split(',').map(s => s.trim()).filter(Boolean);
    }
  });

  // Convert numeric strings to numbers
  ['estimatedTimeMin', 'estimatedTimeMax', 'actualTimeMin', 'actualTimeMax'].forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      const num = parseInt(sanitized[field]);
      if (!isNaN(num)) {
        sanitized[field] = num;
      } else {
        delete sanitized[field];
      }
    }
  });

  // Convert boolean strings to booleans
  ['overdueTasks', 'recentlyCompleted', 'underEstimated', 'overEstimated', 'noEstimate'].forEach(field => {
    if (sanitized[field] === 'true') {
      sanitized[field] = true;
    } else if (sanitized[field] === 'false') {
      sanitized[field] = false;
    }
  });

  // Validate date strings
  ['createdAfter', 'createdBefore', 'completedAfter', 'completedBefore', 'updatedAfter', 'updatedBefore'].forEach(field => {
    if (sanitized[field]) {
      const date = new Date(sanitized[field]);
      if (isNaN(date.getTime())) {
        delete sanitized[field];
      }
    }
  });

  return sanitized;
};
