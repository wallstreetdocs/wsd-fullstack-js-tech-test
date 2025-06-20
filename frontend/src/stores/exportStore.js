/**
 * @fileoverview Export store for managing task exports, history, and real-time updates
 * @module stores/exportStore
 */

import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

/**
 * Pinia store for export management with real-time progress updates
 * @function useExportStore
 * @returns {Object} Export store with reactive state and methods
 */
export const useExportStore = defineStore('exports', () => {
  const loading = ref(false)
  const error = ref(null)
  const exportHistory = ref([])

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
   * @param {Object} filters - Filter parameters for tasks to export
   * @returns {Promise<Object>} Export job metadata
   */
  async function exportTasks(format, filters = {}) {
    loading.value = true
    error.value = null
    exportProgress.active = true
    exportProgress.format = format
    exportProgress.progress = 0
    exportProgress.error = null

    try {
      const queryParams = { ...filters }

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

      // Make sure socket listeners are initialized
      initializeSocketListeners()

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
      // Find the export job to get the filename
      const job = exportHistory.value.find((j) => j._id === jobId)
      const filename =
        job?.filename ||
        `tasks_export_${new Date().toISOString().split('T')[0]}.${job?.format || 'csv'}`

      // Use API client to get blob and create download
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
      window.setTimeout(() => {
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
   * @function initializeSocketListeners
   */
  function initializeSocketListeners() {
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
      const { jobId, filename } = data

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
      jobs.forEach((job) => {
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

  /**
   * Connects to Socket.IO server
   * @function connect
   */
  function connect() {
    if (!socket.connected) {
      socket.connect()
    }
  }

  /**
   * Disconnects from Socket.IO server
   * @function disconnect
   */
  function disconnect() {
    if (socket.connected) {
      socket.disconnect()
    }
  }

  /**
   * Removes Socket.IO event listeners
   * @function cleanup
   */
  function cleanup() {
    socket.off('export-progress')
    socket.off('export-completed')
    socket.off('export-failed')
    socket.off('export-download-ready')
    socket.off('active-exports')
    socket.off('connect')
  }

  return {
    loading,
    error,
    exportTasks,
    downloadExport,
    pauseExport,
    resumeExport,
    retryExport,
    getExportHistory,
    exportProgress,
    activeExports,
    exportHistory,
    initializeSocketListeners,
    cleanup,
    connect,
    disconnect
  }
})
