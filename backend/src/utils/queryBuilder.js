/**
 * @fileoverview Shared utility for building MongoDB queries from filter parameters
 * @module utils/queryBuilder
 */

/**
 * Build a MongoDB query from filter parameters
 * @param {Object} filters - Filter parameters
 * @param {string} [filters.status] - Filter by task status
 * @param {string} [filters.priority] - Filter by task priority
 * @param {string} [filters.search] - Search in title and description
 * @param {string} [filters.createdAfter] - Filter tasks created after date
 * @param {string} [filters.createdBefore] - Filter tasks created before date
 * @param {string} [filters.completedAfter] - Filter tasks completed after date
 * @param {string} [filters.completedBefore] - Filter tasks completed before date
 * @param {number} [filters.estimatedTimeLt] - Filter tasks with estimated time less than value
 * @param {number} [filters.estimatedTimeGte] - Filter tasks with estimated time greater than or equal to value
 * @returns {Object} MongoDB query object
 */
export function buildQueryFromFilters(filters) {
  const query = {};

  // Basic filters
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;

  // Text search in title or description
  // Performant alternative would be to implement Mongo indexes for tasks and use that for search
  // But I didn't want to mess with Task Model
  if (filters.search) {
    const searchTerm = filters.search.trim();
    query.$or = [
      { title: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } }
    ];
  }

  // Date range filters
  if (filters.createdAfter || filters.createdBefore) {
    query.createdAt = {};
    if (filters.createdAfter) query.createdAt.$gte = new Date(filters.createdAfter);
    if (filters.createdBefore) query.createdAt.$lte = new Date(filters.createdBefore);
  }

  // Completed date range filters
  if (filters.completedAfter || filters.completedBefore) {
    query.completedAt = {};
    if (filters.completedAfter) query.completedAt.$gte = new Date(filters.completedAfter);
    if (filters.completedBefore) query.completedAt.$lte = new Date(filters.completedBefore);
  }

  // Estimated time filters
  if (filters.estimatedTimeLt || filters.estimatedTimeGte) {
    query.estimatedTime = {};
    if (filters.estimatedTimeLt) query.estimatedTime.$lt = parseInt(filters.estimatedTimeLt);
    if (filters.estimatedTimeGte) query.estimatedTime.$gte = parseInt(filters.estimatedTimeGte);
  }

  return query;
}

/**
 * Build a MongoDB sort object from filter parameters
 * @param {Object} filters - Filter parameters
 * @param {string} [filters.sortBy='createdAt'] - Field to sort by
 * @param {string} [filters.sortOrder='desc'] - Sort order (asc/desc)
 * @returns {Object} MongoDB sort object
 */
export function buildSortFromFilters(filters) {
  const sort = {};
  sort[filters.sortBy || 'createdAt'] = filters.sortOrder === 'asc' ? 1 : -1;
  return sort;
}
