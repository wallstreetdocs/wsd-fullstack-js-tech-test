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
   * @returns {Promise<Object|Blob>} API response data or Blob for file downloads
   * @throws {Error} Network or API errors
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        ...options.headers
      },
      ...options
    }

    // Default to application/json for POST/PUT unless overridden
    if (!config.headers['Content-Type'] && (config.method === 'POST' || config.method === 'PUT')) {
      config.headers['Content-Type'] = 'application/json'
    }

    if (config.body && typeof config.body === 'object' && config.headers['Content-Type'] === 'application/json') {
      config.body = JSON.stringify(config.body)
    }

    try {
      const response = await fetch(url, config)

      // Handle CSV or JSON download
      const contentType = response.headers.get('Content-Type')
      if (contentType && (contentType.includes('text/csv') || contentType.includes('application/octet-stream'))) {
        if (!response.ok) throw new Error('Export failed')
        return await response.blob()
      }

      // Default: JSON response
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
   * @param {Object} [headers={}] - Optional headers
   * @returns {Promise<Object|Blob>} API response data or Blob for file downloads
   */
  async get(endpoint, params = {}, headers = {}) {
    const query = new window.URLSearchParams(params).toString()
    const url = query ? `${endpoint}?${query}` : endpoint
    return this.request(url, { method: 'GET', headers })
  }

  /**
   * Export tasks in CSV or JSON format
   * @async
   * @param {Object} params - Query parameters (format, filters, etc.)
   * @returns {Promise<Blob|Object>} Exported file blob or JSON
   */
  async getExportTasks(params = {}) {
    const format = params.format || 'csv'
    let accept = 'application/json'
    if (format === 'csv') accept = 'text/csv'
    return this.get('/tasks/export', params, { Accept: accept })
  }

  /**
   * Retrieves tasks with optional filtering and pagination
   * @async
   * @param {Object} [params={}] - Query parameters (page, limit, status, priority, etc.)
   * @returns {Promise<Object>} Paginated tasks response
   */
  async getTasks(params = {}) {
    return this.get('/tasks', params)
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
}

export default new ApiClient()
