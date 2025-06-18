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
   * @param {string} [responseFormat=null] - Optional response format ('blob', 'text', etc.)
   * @returns {Promise<Object|Blob|string>} API response data
   * @throws {Error} Network or API errors
   */
  async request(endpoint, options = {}, responseFormat = null) {
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
      
      if (!response.ok) {
        // Try to get error message from response
        const errorText = await response.text()
        let errorMessage
        try {
          // Try to parse as JSON
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.message
        } catch {
          // Use text as is
          errorMessage = errorText
        }
        throw new Error(errorMessage || `HTTP error! status: ${response.status}`)
      }
      
      // Process response based on format
      if (responseFormat === 'blob') {
        return await response.blob()
      } else if (responseFormat === 'text') {
        return await response.text()
      } else {
        // Default to JSON
        return await response.json()
      }
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
   * @param {string} [responseFormat=null] - Optional response format ('blob', 'text', etc.)
   * @returns {Promise<Object|Blob|string>} API response data
   */
  async post(endpoint, data, responseFormat = null) {
    return this.request(endpoint, {
      method: 'POST',
      body: data
    }, responseFormat)
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
   * Exports tasks in specified format (CSV or JSON)
   * @async
   * @param {string} format - Export format ('csv' or 'json')
   * @param {Object} [filters={}] - Filter parameters (status, priority, sortBy, sortOrder)
   * @returns {Promise<Blob>} File data for download
   */
  async exportTasks(format, filters = {}) {
    // Set Accept header based on format
    const acceptHeader = format === 'csv' ? 'text/csv' : 'application/json';
    
    return this.post('/exportTasks', 
      {
        format,
        filters
      }, 
      'blob' // Request response as blob
    );
  }
}

export default new ApiClient()
