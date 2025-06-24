/**
 * @fileoverview Task store for managing task data, CRUD operations, and real-time updates
 * @module stores/taskStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

const setTimeout = globalThis.setTimeout || window.setTimeout
const clearTimeout = globalThis.clearTimeout || window.clearTimeout

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
    sortOrder: 'desc',
    // Advanced filter fields
    search: '',
    dateFrom: '',
    dateTo: '',
    assignedTo: '',
    tags: [],
    category: ''
  })

  // Add debounced search state
  const searchDebounce = ref(null)

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

  // Computed for active filters count
  const activeFiltersCount = computed(() => {
    let count = 0
    if (filters.value.status) count++
    if (filters.value.priority) count++
    if (filters.value.search) count++
    if (filters.value.dateFrom) count++
    if (filters.value.dateTo) count++
    if (filters.value.assignedTo) count++
    if (filters.value.tags.length > 0) count++
    if (filters.value.category) count++
    return count
  })

  // Computed for filtered tasks (client-side filtering for dashboard quick view)
  const filteredTasks = computed(() => {
    let filtered = [...tasks.value]

    // Apply search filter
    if (filters.value.search) {
      const searchTerm = filters.value.search.toLowerCase()
      filtered = filtered.filter(
        (task) =>
          task.title?.toLowerCase().includes(searchTerm) ||
          task.description?.toLowerCase().includes(searchTerm) ||
          task.tags?.some((tag) => tag.toLowerCase().includes(searchTerm))
      )
    }

    // Apply date range filter
    if (filters.value.dateFrom) {
      const fromDate = new Date(filters.value.dateFrom)
      filtered = filtered.filter((task) => new Date(task.createdAt) >= fromDate)
    }

    if (filters.value.dateTo) {
      const toDate = new Date(filters.value.dateTo)
      toDate.setHours(23, 59, 59, 999) // End of day
      filtered = filtered.filter((task) => new Date(task.createdAt) <= toDate)
    }

    // Apply other filters
    if (filters.value.status) {
      filtered = filtered.filter((task) => task.status === filters.value.status)
    }

    if (filters.value.priority) {
      filtered = filtered.filter(
        (task) => task.priority === filters.value.priority
      )
    }

    if (filters.value.assignedTo) {
      filtered = filtered.filter(
        (task) => task.assignedTo === filters.value.assignedTo
      )
    }

    if (filters.value.category) {
      filtered = filtered.filter(
        (task) => task.category === filters.value.category
      )
    }

    if (filters.value.tags.length > 0) {
      filtered = filtered.filter((task) =>
        filters.value.tags.some((tag) => task.tags?.includes(tag))
      )
    }

    return filtered
  })

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

      // Clean up empty parameters
      Object.keys(queryParams).forEach((key) => {
        if (
          !queryParams[key] ||
          (Array.isArray(queryParams[key]) && queryParams[key].length === 0)
        ) {
          delete queryParams[key]
        }
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
   * Updates task filters and refetches data
   * @function updateFilters
   * @param {Object} newFilters - New filter values
   */
  function updateFilters(newFilters) {
    filters.value = { ...filters.value, ...newFilters }
    pagination.value.page = 1
    fetchTasks()
  }

  /**
   * Updates search filter with debouncing
   * @function updateSearch
   * @param {string} searchTerm - Search term
   * @param {boolean} immediate - Whether to search immediately
   */
  function updateSearch(searchTerm, immediate = false) {
    filters.value.search = searchTerm

    if (searchDebounce.value) {
      clearTimeout(searchDebounce.value)
    }

    const delay = immediate ? 0 : 500 // 500ms debounce

    searchDebounce.value = setTimeout(() => {
      pagination.value.page = 1
      fetchTasks()
    }, delay)
  }

  /**
   * Updates date range filters
   * @function updateDateRange
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   */
  function updateDateRange(dateFrom, dateTo) {
    filters.value.dateFrom = dateFrom
    filters.value.dateTo = dateTo
    pagination.value.page = 1
    fetchTasks()
  }

  /**
   * Clears all filters
   * @function clearFilters
   */
  function clearFilters() {
    filters.value = {
      status: '',
      priority: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      search: '',
      dateFrom: '',
      dateTo: '',
      assignedTo: '',
      tags: [],
      category: ''
    }
    pagination.value.page = 1
    fetchTasks()
  }

  /**
   * Clears a specific filter
   * @function clearFilter
   * @param {string} filterKey - Filter key to clear
   */
  function clearFilter(filterKey) {
    if (Array.isArray(filters.value[filterKey])) {
      filters.value[filterKey] = []
    } else {
      filters.value[filterKey] = ''
    }
    pagination.value.page = 1
    fetchTasks()
  }

  /**
   * Sets pagination page and refetches data
   * @function setPage
   * @param {number} page - Page number
   */
  function setPage(page) {
    pagination.value.page = page
    fetchTasks()
  }

  /**
   * Sets sorting options
   * @function setSorting
   * @param {string} sortBy - Field to sort by
   * @param {string} sortOrder - Sort order (asc/desc)
   */
  function setSorting(sortBy, sortOrder = 'desc') {
    filters.value.sortBy = sortBy
    filters.value.sortOrder = sortOrder
    fetchTasks()
  }

  /**
   * Gets predefined filter presets
   * @function getFilterPresets
   * @returns {Array} Array of filter presets
   */
  function getFilterPresets() {
    return [
      {
        name: 'My Tasks Today',
        filters: {
          dateFrom: new Date().toISOString().split('T')[0],
          dateTo: new Date().toISOString().split('T')[0]
        }
      },
      {
        name: 'High Priority Pending',
        filters: {
          priority: 'high',
          status: 'pending'
        }
      },
      {
        name: 'Overdue Tasks',
        filters: {
          dateTo: new Date(Date.now() - 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          status: 'pending'
        }
      },
      {
        name: 'This Week',
        filters: {
          dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          dateTo: new Date().toISOString().split('T')[0]
        }
      }
    ]
  }

  /**
   * Applies a filter preset
   * @function applyFilterPreset
   * @param {Object} preset - Filter preset to apply
   */
  function applyFilterPreset(preset) {
    updateFilters(preset.filters)
  }

  /**
   * Handles real-time task updates from Socket.IO
   * @function handleTaskUpdate
   * @param {Object} data - Task update data
   */
  function handleTaskUpdate(data) {
    const { action, task } = data

    switch (action) {
      case 'created':
        if (!tasks.value.find((t) => t._id === task._id)) {
          tasks.value.unshift(task)
          pagination.value.total++
        }
        break
      case 'updated': {
        const index = tasks.value.findIndex((t) => t._id === task._id)
        if (index !== -1) {
          tasks.value[index] = task
        }
        break
      }
      case 'deleted': {
        const deleteIndex = tasks.value.findIndex((t) => t._id === task._id)
        if (deleteIndex !== -1) {
          tasks.value.splice(deleteIndex, 1)
          pagination.value.total--
        }
        break
      }
    }
  }

  /**
   * Sets up Socket.IO event listeners
   * @function initializeSocketListeners
   */
  function initializeSocketListeners() {
    socket.on('task-update', handleTaskUpdate)
  }

  /**
   * Removes Socket.IO event listeners
   * @function cleanup
   */
  function cleanup() {
    socket.off('task-update', handleTaskUpdate)
    if (searchDebounce.value) {
      clearTimeout(searchDebounce.value)
    }
  }

  return {
    // State
    tasks,
    loading,
    error,
    pagination,
    filters,

    // Computed
    pendingTasks,
    inProgressTasks,
    completedTasks,
    highPriorityTasks,
    tasksByStatus,
    tasksByPriority,
    activeFiltersCount,
    filteredTasks,

    // Actions
    fetchTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    updateFilters,
    updateSearch,
    updateDateRange,
    clearFilters,
    clearFilter,
    setPage,
    setSorting,
    getFilterPresets,
    applyFilterPreset,
    handleTaskUpdate,
    initializeSocketListeners,
    cleanup
  }
})
