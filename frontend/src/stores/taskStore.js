/**
 * @fileoverview Task store for managing task data, CRUD operations, and real-time updates
 * @module stores/taskStore
 */

import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
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
  const exportHistory = ref([])
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
   * Sets pagination page and refetches data
   * @function setPage
   * @param {number} page - Page number
   */
  function setPage(page) {
    pagination.value.page = page
    fetchTasks()
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
  }

  /**
   * Active export jobs
   * @type {Object}
   */
  const activeExports = reactive({})

  /**
   * Current export progress
   * @type {Object}
   */
  const exportProgress = reactive({
    active: false,
    jobId: null,
    status: null,
    progress: 0,
    format: null,
    processedItems: 0,
    totalItems: 0,
    error: null,
    filename: null
  })

  /**
   * Starts a background task export process
   * @async
   * @function exportTasks
   * @param {string} format - Export format ('csv' or 'json')
   * @returns {Promise<Object>} Export job metadata
   */
  async function exportTasks(format) {
    loading.value = true
    error.value = null
    exportProgress.active = true
    exportProgress.format = format
    exportProgress.progress = 0
    exportProgress.error = null

    try {
      const queryParams = {
        ...filters.value,
      }

      Object.keys(queryParams).forEach((key) => {
        if (!queryParams[key]) delete queryParams[key]
      })
      
      // Start export job
      const response = await apiClient.exportTasks(format, queryParams)
      
      // Store job ID for tracking
      const jobId = response.data.jobId
      exportProgress.jobId = jobId
      exportProgress.status = response.data.status
      
      // Add to active exports
      activeExports[jobId] = {
        id: jobId,
        format,
        status: response.data.status,
        progress: 0,
        createdAt: new Date()
      }
      
      // Set up socket listeners for this export if not already listening
      setupExportSocketListeners()
      
      return response.data
    } catch (err) {
      exportProgress.error = err.message
      error.value = err.message
      console.error('Error starting export:', err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Downloads a completed export
   * @async
   * @function downloadExport
   * @param {string} jobId - Export job ID
   * @returns {Promise<void>}
   */
  async function downloadExport(jobId) {
    try {
      console.log('Store downloadExport called with jobId:', jobId)
      
      // Find the export job to get the filename
      const job = exportHistory.value.find(j => j._id === jobId)
      const filename = job?.filename || `tasks_export_${new Date().toISOString().split('T')[0]}.${job?.format || 'csv'}`
      
      // Option 1: Use API client to get blob and create download
      const blob = await apiClient.downloadExport(jobId)
      
      // Create blob URL
      const url = window.URL.createObjectURL(blob)
      
      // Create and trigger download link
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }, 100)
      
    } catch (err) {
      error.value = err.message
      console.error('Error downloading export:', err)
      throw err
    }
  }
  
  /**
   * Pauses an active export job
   * @async
   * @function pauseExport
   * @param {string} jobId - Export job ID to pause
   * @returns {Promise<void>}
   */
  async function pauseExport(jobId = exportProgress.jobId) {
    if (!jobId) return
    
    try {
      socket.emit('pause-export', { jobId })
    } catch (err) {
      console.error('Error pausing export:', err)
    }
  }
  
  /**
   * Resumes a paused export job
   * @async
   * @function resumeExport
   * @param {string} jobId - Export job ID to resume
   * @returns {Promise<void>}
   */
  async function resumeExport(jobId = exportProgress.jobId) {
    if (!jobId) return
    
    try {
      socket.emit('resume-export', { jobId })
    } catch (err) {
      console.error('Error resuming export:', err)
    }
  }
  
  /**
   * Retries a failed export job
   * @async
   * @function retryExport
   * @param {string} jobId - Export job ID to retry
   * @returns {Promise<void>}
   */
  async function retryExport(jobId) {
    if (!jobId) return
    
    try {
      socket.emit('retry-export', { jobId })
    } catch (err) {
      console.error('Error retrying export:', err)
    }
  }
  
  /**
   * Fetches export history
   * @async
   * @function getExportHistory
   * @param {number} [page=1] - Page number
   * @param {number} [limit=10] - Items per page
   * @returns {Promise<Object>} Export history with pagination
   */
  async function getExportHistory(page = 1, limit = 10) {
    loading.value = true
    try {
      const response = await apiClient.getExportHistory({ page, limit })
      // API returns { data: { jobs: [...], pagination: {...} } }
      exportHistory.value = response.data.jobs
      return response.data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching export history:', err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Sets up socket event listeners for export progress tracking
   * @function setupExportSocketListeners
   */
  function setupExportSocketListeners() {
    // Export progress updates
    socket.on('export-progress', (data) => {
      const { jobId, status, progress, processedItems, totalItems } = data
      
      // Update export progress if it's the current export
      if (jobId === exportProgress.jobId) {
        exportProgress.status = status
        exportProgress.progress = progress
        exportProgress.processedItems = processedItems
        exportProgress.totalItems = totalItems
      }
      
      // Update in active exports list
      if (activeExports[jobId]) {
        activeExports[jobId].status = status
        activeExports[jobId].progress = progress
      }
    })
    
    // Export completed
    socket.on('export-completed', (data) => {
      const { jobId, filename } = data
      
      console.log('Export completed event received:', data)
      
      // Update if it's the current export
      if (jobId === exportProgress.jobId) {
        exportProgress.status = 'completed'
        exportProgress.progress = 100
        exportProgress.filename = filename
        
        // Make sure the progress bar stays visible
        exportProgress.active = true
      }
      
      // Update in active exports list
      if (activeExports[jobId]) {
        activeExports[jobId].status = 'completed'
        activeExports[jobId].progress = 100
        activeExports[jobId].filename = filename
        activeExports[jobId].downloadReady = true
      }
    })
    
    // Export failed
    socket.on('export-failed', (data) => {
      const { jobId, error } = data
      
      // Update if it's the current export
      if (jobId === exportProgress.jobId) {
        exportProgress.status = 'failed'
        exportProgress.error = error
      }
      
      // Update in active exports list
      if (activeExports[jobId]) {
        activeExports[jobId].status = 'failed'
        activeExports[jobId].error = error
      }
    })
    
    // Export download ready
    socket.on('export-download-ready', (data) => {
      const { jobId, data: fileData, filename, format } = data
      
      // Update active exports
      if (activeExports[jobId]) {
        activeExports[jobId].downloadReady = true
        activeExports[jobId].filename = filename
      }
    })
    
    // Check for active exports on reconnection
    socket.on('connect', () => {
      socket.emit('reconnect-exports')
    })
    
    // Handle active exports on reconnection
    socket.on('active-exports', (data) => {
      const { jobs } = data
      
      // Update active exports
      jobs.forEach(job => {
        activeExports[job._id] = {
          id: job._id,
          format: job.format,
          status: job.status,
          progress: job.progress,
          createdAt: new Date(job.createdAt)
        }
        
        // If job was paused, update UI
        if (job.status === 'paused' && job._id === exportProgress.jobId) {
          exportProgress.status = 'paused'
        }
      })
    })
  }

  return {
    tasks,
    loading,
    error,
    pagination,
    filters,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    highPriorityTasks,
    tasksByStatus,
    tasksByPriority,
    fetchTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    updateFilters,
    setPage,
    handleTaskUpdate,
    initializeSocketListeners,
    cleanup,
    exportTasks,
    downloadExport,
    pauseExport,
    resumeExport,
    retryExport,
    getExportHistory,
    exportProgress,
    activeExports,
    exportHistory
  }
})
