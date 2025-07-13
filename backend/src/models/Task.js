/**
 * @fileoverview Task model definition with Mongoose schema and methods
 * @module models/Task
 */

import mongoose from 'mongoose';

/**
 * Mongoose schema for Task documents
 * @typedef {Object} TaskSchema
 * @property {string} title - Task title (required, max 200 chars)
 * @property {string} description - Task description (optional, max 1000 chars)
 * @property {string} status - Task status: 'pending', 'in-progress', or 'completed'
 * @property {string} priority - Task priority: 'low', 'medium', or 'high'
 * @property {Date} createdAt - Task creation timestamp
 * @property {Date} updatedAt - Task last update timestamp
 * @property {Date} completedAt - Task completion timestamp (null if not completed)
 * @property {number} estimatedTime - Estimated completion time in minutes
 * @property {number} actualTime - Actual completion time in minutes
 */
const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    },
    estimatedTime: {
      type: Number,
      min: 0
    },
    actualTime: {
      type: Number,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
taskSchema.index({ status: 1, priority: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ title: 'text', description: 'text' }); // Text search index
taskSchema.index({ estimatedTime: 1, actualTime: 1 });
taskSchema.index({ completedAt: 1 });

/**
 * Pre-save middleware to automatically set completedAt when status changes to completed
 * @param {Function} next - Mongoose next function
 */
taskSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'completed' && this.completedAt) {
      this.completedAt = null;
    }
  }
  next();
});

/**
 * Calculates the time taken to complete a task in minutes
 * @method calculateCompletionTime
 * @returns {number|null} Completion time in minutes, or null if not completed
 * @example
 * const task = await Task.findById(taskId);
 * const completionTime = task.calculateCompletionTime(); // returns minutes or null
 */
taskSchema.methods.calculateCompletionTime = function () {
  if (this.completedAt && this.createdAt) {
    return Math.floor((this.completedAt - this.createdAt) / (1000 * 60));
  }
  return null;
};

/**
 * Task Query Builder Class for building complex queries
 * @class TaskQueryBuilder
 */
class TaskQueryBuilder {
  constructor() {
    this.query = {};
    this.sort = {};
    this.select = {};
    this.populate = [];
    this.options = {};
  }

  /**
   * Add text search filter
   * @param {string} searchTerm - Text to search in title and description
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  search(searchTerm) {
    if (searchTerm && searchTerm.trim()) {
      this.query.$text = { $search: searchTerm };
    }
    return this;
  }

  /**
   * Add title filter with various operators
   * @param {string|Object} title - Title value or filter object
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  title(title) {
    if (title) {
      if (typeof title === 'string') {
        this.query.title = { $regex: title, $options: 'i' };
      } else {
        this.query.title = title;
      }
    }
    return this;
  }

  /**
   * Add description filter
   * @param {string|Object} description - Description value or filter object
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  description(description) {
    if (description) {
      if (typeof description === 'string') {
        this.query.description = { $regex: description, $options: 'i' };
      } else {
        this.query.description = description;
      }
    }
    return this;
  }

  /**
   * Add status filter
   * @param {string|Array} status - Status value(s) to filter by
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  status(status) {
    if (status) {
      this.query.status = Array.isArray(status) ? { $in: status } : status;
    }
    return this;
  }

  /**
   * Add priority filter
   * @param {string|Array} priority - Priority value(s) to filter by
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  priority(priority) {
    if (priority) {
      this.query.priority = Array.isArray(priority)
        ? { $in: priority }
        : priority;
    }
    return this;
  }

  /**
   * Add date range filter for createdAt
   * @param {Object} dateRange - Date range object with start and/or end
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  createdAtRange(dateRange) {
    if (dateRange) {
      const range = {};
      if (dateRange.start) range.$gte = new Date(dateRange.start);
      if (dateRange.end) range.$lte = new Date(dateRange.end);
      if (Object.keys(range).length > 0) {
        this.query.createdAt = range;
      }
    }
    return this;
  }

  /**
   * Add date range filter for updatedAt
   * @param {Object} dateRange - Date range object with start and/or end
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  updatedAtRange(dateRange) {
    if (dateRange) {
      const range = {};
      if (dateRange.start) range.$gte = new Date(dateRange.start);
      if (dateRange.end) range.$lte = new Date(dateRange.end);
      if (Object.keys(range).length > 0) {
        this.query.updatedAt = range;
      }
    }
    return this;
  }

  /**
   * Add date range filter for completedAt
   * @param {Object} dateRange - Date range object with start and/or end
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  completedAtRange(dateRange) {
    if (dateRange) {
      const range = {};
      if (dateRange.start) range.$gte = new Date(dateRange.start);
      if (dateRange.end) range.$lte = new Date(dateRange.end);
      if (Object.keys(range).length > 0) {
        this.query.completedAt = range;
      }
    }
    return this;
  }

  /**
   * Filter by completion status (completed vs not completed)
   * @param {boolean} isCompleted - Whether to filter for completed tasks
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  isCompleted(isCompleted) {
    if (typeof isCompleted === 'boolean') {
      if (isCompleted) {
        this.query.completedAt = { $ne: null };
      } else {
        this.query.completedAt = null;
      }
    }
    return this;
  }

  /**
   * Add estimated time filter
   * @param {Object} timeRange - Time range object with min and/or max
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  estimatedTimeRange(timeRange) {
    if (timeRange) {
      const range = {};
      if (timeRange.min !== undefined) range.$gte = timeRange.min;
      if (timeRange.max !== undefined) range.$lte = timeRange.max;
      if (Object.keys(range).length > 0) {
        this.query.estimatedTime = range;
      }
    }
    return this;
  }

  /**
   * Add actual time filter
   * @param {Object} timeRange - Time range object with min and/or max
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  actualTimeRange(timeRange) {
    if (timeRange) {
      const range = {};
      if (timeRange.min !== undefined) range.$gte = timeRange.min;
      if (timeRange.max !== undefined) range.$lte = timeRange.max;
      if (Object.keys(range).length > 0) {
        this.query.actualTime = range;
      }
    }
    return this;
  }

  /**
   * Filter tasks that have estimated time set
   * @param {boolean} hasEstimatedTime - Whether task has estimated time
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  hasEstimatedTime(hasEstimatedTime) {
    if (typeof hasEstimatedTime === 'boolean') {
      if (hasEstimatedTime) {
        this.query.estimatedTime = { $exists: true, $ne: null };
      } else {
        this.query.$or = [
          { estimatedTime: { $exists: false } },
          { estimatedTime: null }
        ];
      }
    }
    return this;
  }

  /**
   * Filter tasks that have actual time set
   * @param {boolean} hasActualTime - Whether task has actual time
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  hasActualTime(hasActualTime) {
    if (typeof hasActualTime === 'boolean') {
      if (hasActualTime) {
        this.query.actualTime = { $exists: true, $ne: null };
      } else {
        this.query.$or = [
          { actualTime: { $exists: false } },
          { actualTime: null }
        ];
      }
    }
    return this;
  }

  /**
   * Filter by time efficiency (actual vs estimated)
   * @param {string} efficiency - 'over-estimated', 'under-estimated', 'accurate'
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  timeEfficiency(efficiency) {
    if (efficiency) {
      switch (efficiency) {
      case 'over-estimated':
        this.query.$expr = {
          $and: [
            { $ne: ['$actualTime', null] },
            { $ne: ['$estimatedTime', null] },
            { $gt: ['$actualTime', '$estimatedTime'] }
          ]
        };
        break;
      case 'under-estimated':
        this.query.$expr = {
          $and: [
            { $ne: ['$actualTime', null] },
            { $ne: ['$estimatedTime', null] },
            { $lt: ['$actualTime', '$estimatedTime'] }
          ]
        };
        break;
      case 'accurate':
        this.query.$expr = {
          $and: [
            { $ne: ['$actualTime', null] },
            { $ne: ['$estimatedTime', null] },
            { $eq: ['$actualTime', '$estimatedTime'] }
          ]
        };
        break;
      }
    }
    return this;
  }

  /**
   * Add custom query conditions
   * @param {Object} conditions - Custom MongoDB query conditions
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  where(conditions) {
    if (conditions) {
      this.query = { ...this.query, ...conditions };
    }
    return this;
  }

  /**
   * Add OR conditions
   * @param {Array} conditions - Array of conditions to OR together
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  orWhere(conditions) {
    if (conditions && Array.isArray(conditions)) {
      this.query.$or = conditions;
    }
    return this;
  }

  /**
   * Add AND conditions
   * @param {Array} conditions - Array of conditions to AND together
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  andWhere(conditions) {
    if (conditions && Array.isArray(conditions)) {
      this.query.$and = conditions;
    }
    return this;
  }

  /**
   * Set sorting options
   * @param {string} field - Field to sort by
   * @param {string} order - Sort order ('asc' or 'desc')
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  sortBy(field, order = 'desc') {
    if (field) {
      this.sort[field] = order === 'desc' ? -1 : 1;
    }
    return this;
  }

  /**
   * Set field selection
   * @param {string|Array} fields - Fields to include/exclude
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  select(fields) {
    if (fields) {
      if (typeof fields === 'string') {
        fields.split(',').forEach((field) => {
          this.select[field.trim()] = 1;
        });
      } else if (Array.isArray(fields)) {
        fields.forEach((field) => {
          this.select[field] = 1;
        });
      }
    }
    return this;
  }

  /**
   * Set pagination options
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {TaskQueryBuilder} - Returns this for chaining
   */
  paginate(page = 1, limit = 10) {
    this.options.skip = (page - 1) * limit;
    this.options.limit = limit;
    return this;
  }

  /**
   * Execute the query and return results
   * @returns {Promise<Array>} - Query results
   */
  async execute() {
    let query = Task.find(this.query);

    // Apply sorting
    if (Object.keys(this.sort).length > 0) {
      query = query.sort(this.sort);
    }

    // Apply field selection
    if (Object.keys(this.select).length > 0) {
      query = query.select(this.select);
    }

    // Apply pagination
    if (this.options.skip !== undefined) {
      query = query.skip(this.options.skip);
    }
    if (this.options.limit !== undefined) {
      query = query.limit(this.options.limit);
    }

    return await query.exec();
  }

  /**
   * Execute the query and return count
   * @returns {Promise<number>} - Total count
   */
  async count() {
    return await Task.countDocuments(this.query);
  }

  /**
   * Execute the query with pagination metadata
   * @returns {Promise<Object>} - Results with pagination info
   */
  async executeWithPagination() {
    const [tasks, total] = await Promise.all([this.execute(), this.count()]);

    const page = Math.floor(this.options.skip / this.options.limit) + 1;
    const pages = Math.ceil(total / this.options.limit);

    return {
      tasks,
      pagination: {
        page,
        limit: this.options.limit,
        total,
        pages
      }
    };
  }
}

/**
 * Static method to create a new query builder
 * @static
 * @returns {TaskQueryBuilder} - New query builder instance
 */
taskSchema.statics.queryBuilder = function () {
  return new TaskQueryBuilder();
};

/**
 * Static method for advanced search with all possible filters
 * @static
 * @param {Object} filters - Complete filter object
 * @param {Object} options - Query options (sort, pagination, etc.)
 * @returns {Promise<Object>} - Results with pagination
 */
taskSchema.statics.advancedSearch = async function (
  filters = {},
  options = {}
) {
  const builder = new TaskQueryBuilder();

  // Apply all filters
  if (filters.search) builder.search(filters.search);
  if (filters.title) builder.title(filters.title);
  if (filters.description) builder.description(filters.description);
  if (filters.status) builder.status(filters.status);
  if (filters.priority) builder.priority(filters.priority);
  if (filters.createdAtRange) builder.createdAtRange(filters.createdAtRange);
  if (filters.updatedAtRange) builder.updatedAtRange(filters.updatedAtRange);
  if (filters.completedAtRange)
    builder.completedAtRange(filters.completedAtRange);
  if (filters.isCompleted !== undefined)
    builder.isCompleted(filters.isCompleted);
  if (filters.estimatedTimeRange)
    builder.estimatedTimeRange(filters.estimatedTimeRange);
  if (filters.actualTimeRange) builder.actualTimeRange(filters.actualTimeRange);
  if (filters.hasEstimatedTime !== undefined)
    builder.hasEstimatedTime(filters.hasEstimatedTime);
  if (filters.hasActualTime !== undefined)
    builder.hasActualTime(filters.hasActualTime);
  if (filters.timeEfficiency) builder.timeEfficiency(filters.timeEfficiency);
  if (filters.where) builder.where(filters.where);
  if (filters.orWhere) builder.orWhere(filters.orWhere);
  if (filters.andWhere) builder.andWhere(filters.andWhere);

  // Apply options
  if (options.sortBy) builder.sortBy(options.sortBy, options.sortOrder);
  if (options.select) builder.select(options.select);

  // Handle pagination - if limit is 0, don't apply pagination (get all records)
  if (options.limit === 0) {
    // Don't apply pagination for exports
  } else if (options.page || options.limit) {
    builder.paginate(options.page || 1, options.limit || 10);
  }

  return await builder.executeWithPagination();
};

/**
 * Static method for advanced search with cursor for streaming exports
 * @static
 * @param {Object} filters - Complete filter object
 * @param {Object} options - Query options (sort, batchSize, etc.)
 * @returns {Promise<Object>} - MongoDB cursor
 */
taskSchema.statics.advancedSearchCursor = async function (
  filters = {},
  options = {}
) {
  const builder = new TaskQueryBuilder();

  // Apply all filters
  if (filters.search) builder.search(filters.search);
  if (filters.title) builder.title(filters.title);
  if (filters.description) builder.description(filters.description);
  if (filters.status) builder.status(filters.status);
  if (filters.priority) builder.priority(filters.priority);
  if (filters.createdAtRange) builder.createdAtRange(filters.createdAtRange);
  if (filters.updatedAtRange) builder.updatedAtRange(filters.updatedAtRange);
  if (filters.completedAtRange)
    builder.completedAtRange(filters.completedAtRange);
  if (filters.isCompleted !== undefined)
    builder.isCompleted(filters.isCompleted);
  if (filters.estimatedTimeRange)
    builder.estimatedTimeRange(filters.estimatedTimeRange);
  if (filters.actualTimeRange) builder.actualTimeRange(filters.actualTimeRange);
  if (filters.hasEstimatedTime !== undefined)
    builder.hasEstimatedTime(filters.hasEstimatedTime);
  if (filters.hasActualTime !== undefined)
    builder.hasActualTime(filters.hasActualTime);
  if (filters.timeEfficiency) builder.timeEfficiency(filters.timeEfficiency);
  if (filters.where) builder.where(filters.where);
  if (filters.orWhere) builder.orWhere(filters.orWhere);
  if (filters.andWhere) builder.andWhere(filters.andWhere);

  // Apply options
  if (options.sortBy) builder.sortBy(options.sortBy, options.sortOrder);
  if (options.select) builder.select(options.select);

  // Create cursor query
  let query = Task.find(builder.query);

  // Apply sorting
  if (Object.keys(builder.sort).length > 0) {
    query = query.sort(builder.sort);
  }

  // Apply field selection
  if (Object.keys(builder.select).length > 0) {
    query = query.select(builder.select);
  }

  // Apply batch size for cursor
  if (options.batchSize) {
    query = query.batchSize(options.batchSize);
  }

  // Return cursor for streaming
  return query.cursor();
};

/**
 * Task model for managing task documents in MongoDB
 * @type {mongoose.Model}
 */
const Task = mongoose.model('Task', taskSchema);

export default Task;
