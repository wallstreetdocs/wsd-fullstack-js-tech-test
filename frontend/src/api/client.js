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

  /**
   * Creates async export job with current filters
   * @async
   * @param {Object} filters - Current filter state
   * @param {string} [format='csv'] - Export format (csv, json)
   * @returns {Promise<Object>} Job information
   */
  async exportTasks(filters = {}, format = 'csv') {
    const url = `${this.baseURL}/export/tasks`
    const config = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        format,
        ...filters
      })
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.message || `Export failed! status: ${response.status}`
        )
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Export request failed:', error)
      throw error
    }
  }

  /**
   * Retrieves export history with optional filtering and pagination
   * @async
   * @param {Object} [params={}] - Query parameters (page, limit, status, format, sortBy, sortOrder, etc.)
   * @returns {Promise<Object>} Paginated export history response
   */
  async getExportHistory(params = {}) {
    return this.get('/exports', params)
  }

  /**
   * Downloads an export file by filename
   * @async
   * @param {string} filename - Export filename to download
   * @returns {Promise<{blob: Blob, filename: string}>} File blob and filename
   * @throws {Error} Network or API errors
   */
  async downloadExport(filename) {
    const url = `${this.baseURL}/exports/download/${encodeURIComponent(filename)}`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'text/csv, application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.message || `Download failed! status: ${response.status}`
        )
      }

      const blob = await response.blob()
      const downloadFilename =
        this.getFilenameFromResponse(response) || filename

      return { blob, filename: downloadFilename }
    } catch (error) {
      console.error('Download request failed:', error)
      throw error
    }
  }

  /**
   * Extracts filename from Content-Disposition header
   * @private
   * @param {Response} response - Fetch response object
   * @returns {string|null} Extracted filename
   */
  getFilenameFromResponse(response) {
    const contentDisposition = response.headers.get('Content-Disposition')
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
      return filenameMatch ? filenameMatch[1] : null
    }
    return null
  }
}

export default new ApiClient()
