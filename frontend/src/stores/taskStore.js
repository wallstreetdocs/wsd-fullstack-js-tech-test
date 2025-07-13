/**
 * @fileoverview Task store for managing task data, CRUD operations, and real-time updates
 * @module stores/taskStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

/**
 * Pinia store for task management with pagination, filtering, and real-time updates
 * @function useTaskStore
 * @returns {Object} Task store with reactive state and methods
 */
export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref([])
  const loading = ref(false)
  const error = ref(null)
  const pagination = ref({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  })

  const filters = ref({
    status: '',
    priority: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })

  // Advanced query state
  const advancedQuery = ref({})
  const searchQuery = ref('')
  const queryMode = ref('basic') // 'basic', 'search', 'advanced'

  const pendingTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'pending')
  )

  const inProgressTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'in-progress')
  )

  const completedTasks = computed(() =>
    tasks.value.filter((task) => task.status === 'completed')
  )

  const highPriorityTasks = computed(() =>
    tasks.value.filter((task) => task.priority === 'high')
  )

  const tasksByStatus = computed(() => ({
    pending: pendingTasks.value.length,
    'in-progress': inProgressTasks.value.length,
    completed: completedTasks.value.length
  }))

  const tasksByPriority = computed(() => ({
    low: tasks.value.filter((task) => task.priority === 'low').length,
    medium: tasks.value.filter((task) => task.priority === 'medium').length,
    high: tasks.value.filter((task) => task.priority === 'high').length
  }))

  /**
   * Fetches tasks with pagination and filtering
   * @async
   * @function fetchTasks
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<void>}
   */
  async function fetchTasks(params = {}) {
    loading.value = true
    error.value = null

    try {
      const queryParams = {
        page: pagination.value.page,
        limit: pagination.value.limit,
        ...filters.value,
        ...params
      }

      Object.keys(queryParams).forEach((key) => {
        if (!queryParams[key]) delete queryParams[key]
      })

      const response = await apiClient.getTasks(queryParams)

      tasks.value = response.data.tasks
      pagination.value = response.data.pagination
    } catch (err) {
      error.value = err.message
      console.error('Error fetching tasks:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Advanced search with full-text search capabilities
   * @async
   * @function searchTasks
   * @param {string} query - Search query
   * @param {Object} [filters={}] - Additional filters
   * @param {Object} [options={}] - Search options
   * @returns {Promise<void>}
   */
  async function searchTasks(query, filters = {}, options = {}) {
    loading.value = true
    error.value = null
    queryMode.value = 'search'
    searchQuery.value = query

    try {
      const response = await apiClient.searchTasks(query, filters, options)
      tasks.value = response.data.tasks
      pagination.value = response.data.pagination
    } catch (err) {
      error.value = err.message
      console.error('Error searching tasks:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Advanced query builder for complex queries
   * @async
   * @function queryTasks
   * @param {Object} filters - Query filters
   * @param {Object} [options={}] - Query options
   * @returns {Promise<void>}
   */
  async function queryTasks(filters = {}, options = {}) {
    loading.value = true
    error.value = null
    queryMode.value = 'advanced'
    advancedQuery.value = { filters, options }

    try {
      const response = await apiClient.queryTasks(filters, options)
      tasks.value = response.data.tasks
      pagination.value = response.data.pagination
    } catch (err) {
      error.value = err.message
      console.error('Error querying tasks:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetches a single task by ID
   * @async
   * @function getTask
   * @param {string} id - Task ID
   * @returns {Promise<Object>} Task data
   */
  async function getTask(id) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.getTask(id)
      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Creates a new task
   * @async
   * @function createTask
   * @param {Object} taskData - Task data
   * @returns {Promise<Object>} Created task
   */
  async function createTask(taskData) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.createTask(taskData)

      tasks.value.unshift(response.data)
      pagination.value.total++

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error creating task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Updates an existing task
   * @async
   * @function updateTask
   * @param {string} id - Task ID
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Updated task
   */
  async function updateTask(id, updates) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.updateTask(id, updates)

      const index = tasks.value.findIndex((task) => task._id === id)
      if (index !== -1) {
        tasks.value[index] = response.data
      }

      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error updating task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Deletes a task by ID
   * @async
   * @function deleteTask
   * @param {string} id - Task ID
   * @returns {Promise<void>}
   */
  async function deleteTask(id) {
    loading.value = true
    error.value = null

    try {
      await apiClient.deleteTask(id)

      const index = tasks.value.findIndex((task) => task._id === id)
      if (index !== -1) {
        tasks.value.splice(index, 1)
        pagination.value.total--
      }
    } catch (err) {
      error.value = err.message
      console.error('Error deleting task:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetches task statistics with optional filtering
   * @async
   * @function fetchTaskStats
   * @param {Object} [filters={}] - Filter parameters for stats
   * @returns {Promise<Object>} Task statistics
   */
  async function fetchTaskStats(filters = {}) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.getTaskStats(filters)
      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching task stats:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Updates filters and refetches data
   * @function updateFilters
   * @param {Object} newFilters - New filter values
   */
  function updateFilters(newFilters) {
    Object.assign(filters.value, newFilters)
    pagination.value.page = 1 // Reset to first page
    queryMode.value = 'basic'
    fetchTasks()
  }

  /**
   * Sets the current page and refetches data
   * @function setPage
   * @param {number} page - Page number
   */
  function setPage(page) {
    pagination.value.page = page
    if (queryMode.value === 'basic') {
      fetchTasks()
    } else if (queryMode.value === 'search') {
      searchTasks(searchQuery.value)
    } else if (queryMode.value === 'advanced') {
      queryTasks(advancedQuery.value.filters, advancedQuery.value.options)
    }
  }

  /**
   * Sets the current query for export functionality without executing it
   * @function setCurrentQuery
   * @param {Object} query - Query object from Advanced Query Builder
   */
  function setCurrentQuery(query) {
    if (query && Object.keys(query).length > 0) {
      queryMode.value = 'advanced'
      advancedQuery.value = { filters: query, options: {} }
    }
  }

  /**
   * Resets to basic mode and fetches all tasks
   * @function resetToBasic
   */
  function resetToBasic() {
    queryMode.value = 'basic'
    searchQuery.value = ''
    advancedQuery.value = {}
    fetchTasks()
  }

  /**
   * Handles real-time task updates from WebSocket
   * @function handleTaskUpdate
   * @param {Object} data - Update data
   */
  function handleTaskUpdate(data) {
    const { action, task } = data

    switch (action) {
      case 'created':
        // Add new task to the beginning of the list
        tasks.value.unshift(task)
        pagination.value.total++
        break

      case 'updated':
        // Update existing task
        const updateIndex = tasks.value.findIndex((t) => t._id === task._id)
        if (updateIndex !== -1) {
          tasks.value[updateIndex] = task
        }
        break

      case 'deleted':
        // Remove deleted task
        const deleteIndex = tasks.value.findIndex((t) => t._id === task._id)
        if (deleteIndex !== -1) {
          tasks.value.splice(deleteIndex, 1)
          pagination.value.total--
        }
        break

      default:
        console.warn('Unknown task update action:', action)
    }
  }

  /**
   * Initializes WebSocket listeners for real-time updates
   * @function initializeSocketListeners
   */
  function initializeSocketListeners() {
    socket.on('task-update', handleTaskUpdate)
  }

  /**
   * Cleans up WebSocket listeners
   * @function cleanup
   */
  function cleanup() {
    socket.off('task-update', handleTaskUpdate)
  }

  return {
    // State
    tasks,
    loading,
    error,
    pagination,
    filters,
    advancedQuery,
    searchQuery,
    queryMode,

    // Computed
    pendingTasks,
    inProgressTasks,
    completedTasks,
    highPriorityTasks,
    tasksByStatus,
    tasksByPriority,

    // Actions
    fetchTasks,
    searchTasks,
    queryTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    fetchTaskStats,
    updateFilters,
    setPage,
    setCurrentQuery,
    resetToBasic,
    handleTaskUpdate,
    initializeSocketListeners,
    cleanup
  }
})
