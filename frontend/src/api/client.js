/**
 * @fileoverview HTTP API client for task management backend
 * @module api/client
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * HTTP client for communicating with the task management API
 * @class ApiClient
 */
class ApiClient {
  /**
   * Creates ApiClient instance with base URL configuration
   */
  constructor() {
    this.baseURL = `${API_BASE_URL}/api`
  }

  /**
   * Makes HTTP request to API endpoint with error handling
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [options={}] - Fetch options
   * @returns {Promise<Object>} API response data
   * @throws {Error} Network or API errors
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.message || `HTTP error! status: ${response.status}`
        )
      }

      return data
    } catch (error) {
      console.error('API Request failed:', error)
      throw error
    }
  }

  /**
   * Makes GET request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} [params={}] - URL query parameters
   * @returns {Promise<Object>} API response data
   */
  async get(endpoint, params = {}) {
    const query = new window.URLSearchParams(params).toString()
    const url = query ? `${endpoint}?${query}` : endpoint
    return this.request(url, { method: 'GET' })
  }

  /**
   * Makes POST request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} data - Request body data
   * @returns {Promise<Object>} API response data
   */
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data
    })
  }

  /**
   * Makes PUT request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @param {Object} data - Request body data
   * @returns {Promise<Object>} API response data
   */
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data
    })
  }

  /**
   * Makes DELETE request to API endpoint
   * @async
   * @param {string} endpoint - API endpoint path
   * @returns {Promise<Object>} API response data
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }

  /**
   * Converts query object to URL parameters for GET requests
   * @param {Object} query - Query object
   * @returns {Object} URL parameters
   */
  convertQueryToParams(query) {
    const params = { ...query }

    // Convert arrays to comma-separated strings
    if (Array.isArray(params.status)) {
      params.status = params.status.join(',')
    }
    if (Array.isArray(params.priority)) {
      params.priority = params.priority.join(',')
    }

    // Convert date ranges to individual parameters
    if (params.createdAtRange) {
      if (params.createdAtRange.start)
        params.createdAtStart = params.createdAtRange.start
      if (params.createdAtRange.end)
        params.createdAtEnd = params.createdAtRange.end
      delete params.createdAtRange
    }

    if (params.updatedAtRange) {
      if (params.updatedAtRange.start)
        params.updatedAtStart = params.updatedAtRange.start
      if (params.updatedAtRange.end)
        params.updatedAtEnd = params.updatedAtRange.end
      delete params.updatedAtRange
    }

    if (params.completedAtRange) {
      if (params.completedAtRange.start)
        params.completedAtStart = params.completedAtRange.start
      if (params.completedAtRange.end)
        params.completedAtEnd = params.completedAtRange.end
      delete params.completedAtRange
    }

    // Convert time ranges to individual parameters
    if (params.estimatedTimeRange) {
      if (params.estimatedTimeRange.min !== null)
        params.estimatedTimeMin = params.estimatedTimeRange.min
      if (params.estimatedTimeRange.max !== null)
        params.estimatedTimeMax = params.estimatedTimeRange.max
      delete params.estimatedTimeRange
    }

    if (params.actualTimeRange) {
      if (params.actualTimeRange.min !== null)
        params.actualTimeMin = params.actualTimeRange.min
      if (params.actualTimeRange.max !== null)
        params.actualTimeMax = params.actualTimeRange.max
      delete params.actualTimeRange
    }

    // Convert boolean values to strings
    if (params.isCompleted !== null && params.isCompleted !== undefined) {
      params.isCompleted = params.isCompleted.toString()
    }
    if (
      params.hasEstimatedTime !== null &&
      params.hasEstimatedTime !== undefined
    ) {
      params.hasEstimatedTime = params.hasEstimatedTime.toString()
    }
    if (params.hasActualTime !== null && params.hasActualTime !== undefined) {
      params.hasActualTime = params.hasActualTime.toString()
    }

    // Remove null/undefined values
    Object.keys(params).forEach((key) => {
      if (
        params[key] === null ||
        params[key] === undefined ||
        params[key] === ''
      ) {
        delete params[key]
      }
    })

    return params
  }

  /**
   * Retrieves tasks with optional filtering and pagination
   * @async
   * @param {Object} [params={}] - Query parameters (page, limit, status, priority, etc.)
   * @returns {Promise<Object>} Paginated tasks response
   */
  async getTasks(params = {}) {
    const urlParams = this.convertQueryToParams(params)
    return this.get('/tasks', urlParams)
  }

  /**
   * Advanced search with full-text search capabilities
   * @async
   * @param {string} query - Search query
   * @param {Object} [filters={}] - Additional filters
   * @param {Object} [options={}] - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchTasks(query, filters = {}, options = {}) {
    const params = {
      q: query,
      ...this.convertQueryToParams(filters)
    }

    if (Object.keys(options).length > 0) {
      params.options = JSON.stringify(options)
    }

    return this.get('/tasks/search', params)
  }

  /**
   * Advanced query builder endpoint for complex queries
   * @async
   * @param {Object} filters - Query filters
   * @param {Object} [options={}] - Query options
   * @returns {Promise<Object>} Query results
   */
  async queryTasks(filters = {}, options = {}) {
    return this.post('/tasks/query', { filters, options })
  }

  /**
   * Retrieves a specific task by ID
   * @async
   * @param {string} id - Task ID
   * @returns {Promise<Object>} Task data
   */
  async getTask(id) {
    return this.get(`/tasks/${id}`)
  }

  /**
   * Creates a new task
   * @async
   * @param {Object} task - Task data
   * @returns {Promise<Object>} Created task response
   */
  async createTask(task) {
    return this.post('/tasks', task)
  }

  /**
   * Updates an existing task
   * @async
   * @param {string} id - Task ID
   * @param {Object} updates - Task update data
   * @returns {Promise<Object>} Updated task response
   */
  async updateTask(id, updates) {
    return this.put(`/tasks/${id}`, updates)
  }

  /**
   * Deletes a task by ID
   * @async
   * @param {string} id - Task ID
   * @returns {Promise<Object>} Deletion confirmation response
   */
  async deleteTask(id) {
    return this.delete(`/tasks/${id}`)
  }

  /**
   * Retrieves task statistics with optional filtering
   * @async
   * @param {Object} [filters={}] - Filter parameters for stats
   * @returns {Promise<Object>} Task statistics
   */
  async getTaskStats(filters = {}) {
    const params = this.convertQueryToParams(filters)
    return this.get('/tasks/stats', params)
  }

  /**
   * Retrieves analytics and metrics data
   * @async
   * @returns {Promise<Object>} Analytics data
   */
  async getAnalytics() {
    return this.get('/analytics')
  }

  /**
   * Checks API health status
   * @async
   * @returns {Promise<Object>} Health check response
   */
  async getHealth() {
    return this.get('/health')
  }

  /**
   * Creates a new export
   * @async
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format ('csv' or 'json')
   * @param {Object} params.filters - Task filters
   * @param {Object} params.options - Export options
   * @returns {Promise<Object>} Export creation response
   */
  async createExport(params) {
    return this.post('/exports', params)
  }

  /**
   * Gets export history
   * @async
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<Object>} Export history response
   */
  async getExportHistory(params = {}) {
    return this.get('/exports', params)
  }

  /**
   * Gets export by ID
   * @async
   * @param {string} id - Export ID
   * @returns {Promise<Object>} Export data
   */
  async getExport(id) {
    return this.get(`/exports/${id}`)
  }

  /**
   * Downloads export file
   * @async
   * @param {string} id - Export ID
   * @returns {Promise<Blob>} File blob
   */
  async downloadExport(id) {
    const response = await fetch(`${this.baseURL}/exports/${id}/download`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.blob()
  }

  /**
   * Gets export statistics
   * @async
   * @returns {Promise<Object>} Export statistics
   */
  async getExportStats() {
    return this.get('/exports/stats')
  }

  /**
   * Cleans up old exports
   * @async
   * @param {number} [daysOld=7] - Delete exports older than this many days
   * @returns {Promise<Object>} Cleanup response
   */
  async cleanupExports(daysOld = 7) {
    return this.delete(`/exports/cleanup?daysOld=${daysOld}`)
  }
}

export default new ApiClient()
