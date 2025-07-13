/**
 * @fileoverview Export store for managing export functionality and real-time updates
 * @module stores/exportStore
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'

/**
 * Pinia store for export management with real-time progress updates
 * @function useExportStore
 * @returns {Object} Export store with reactive state and methods
 */
export const useExportStore = defineStore('exports', () => {
  const exports = ref([])
  const loading = ref(false)
  const error = ref(null)
  const connected = ref(false)
  const activeExports = ref(new Map()) // Track active exports with progress

  const exportStats = ref({
    summary: {
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      processing: 0,
      totalRecords: 0
    },
    byFormat: {},
    recent: []
  })

  // Computed properties
  const completedExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'completed')
  )

  const failedExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'failed')
  )

  const pendingExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'pending')
  )

  const processingExports = computed(() =>
    exports.value.filter((exp) => exp.status === 'processing')
  )

  /**
   * Fetches export history
   * @async
   * @function fetchExportHistory
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<void>}
   */
  async function fetchExportHistory(params = {}) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.getExportHistory(params)
      exports.value = response.data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching export history:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetches export statistics
   * @async
   * @function fetchExportStats
   * @returns {Promise<void>}
   */
  async function fetchExportStats() {
    try {
      const response = await apiClient.getExportStats()
      exportStats.value = response.data
    } catch (err) {
      console.error('Error fetching export stats:', err)
    }
  }

  /**
   * Creates a new export
   * @async
   * @function createExport
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format ('csv' or 'json')
   * @param {Object} params.filters - Task filters
   * @param {Object} params.options - Export options
   * @returns {Promise<Object>} Created export
   */
  async function createExport(params) {
    loading.value = true
    error.value = null

    try {
      const response = await apiClient.createExport(params)
      const exportRecord = response.data

      // Add to exports list
      exports.value.unshift(exportRecord)

      // Track active export
      if (
        exportRecord.status === 'pending' ||
        exportRecord.status === 'processing'
      ) {
        activeExports.value.set(exportRecord._id, {
          ...exportRecord,
          progress: 'Starting export...',
          percentage: 0
        })
      }

      // Emit initial progress update for pending status
      if (exportRecord.status === 'pending') {
        const event = new CustomEvent('export-progress-update', {
          detail: {
            status: 'pending',
            message: 'Export queued successfully',
            exportId: exportRecord._id
          }
        })
        window.dispatchEvent(event)
      }

      // Don't wait for completion - return immediately
      loading.value = false
      return exportRecord
    } catch (err) {
      error.value = err.message
      console.error('Error creating export:', err)
      loading.value = false
      throw err
    }
  }

  /**
   * Downloads an export file
   * @async
   * @function downloadExport
   * @param {string} exportId - Export ID
   * @returns {Promise<void>}
   */
  async function downloadExport(exportId) {
    try {
      const blob = await apiClient.downloadExport(exportId)

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url

      // Get filename from export record
      const exportRecord = exports.value.find((exp) => exp._id === exportId)
      const filename = exportRecord
        ? `tasks_export_${exportRecord._id}.${exportRecord.format}`
        : `export_${exportId}.${blob.type.includes('csv') ? 'csv' : 'json'}`

      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      error.value = err.message
      console.error('Error downloading export:', err)
      throw err
    }
  }

  /**
   * Cleans up old exports
   * @async
   * @function cleanupExports
   * @param {number} [daysOld=7] - Delete exports older than this many days
   * @returns {Promise<void>}
   */
  async function cleanupExports(daysOld = 7) {
    try {
      await apiClient.cleanupExports(daysOld)
      // Refresh export history after cleanup
      await fetchExportHistory()
      await fetchExportStats()
    } catch (err) {
      error.value = err.message
      console.error('Error cleaning up exports:', err)
      throw err
    }
  }

  /**
   * Updates export progress from real-time updates
   * @function updateExportProgress
   * @param {Object} progressData - Progress update data
   */
  function updateExportProgress(progressData) {
    const { exportId, status, message, percentage } = progressData
    console.log('🔄 Updating export progress:', { exportId, status, message, percentage })

    // Update in active exports
    if (activeExports.value.has(exportId)) {
      const activeExport = activeExports.value.get(exportId)
      activeExport.status = status
      activeExport.progress = message
      activeExport.percentage = percentage || 0

      if (status === 'completed' || status === 'failed') {
        activeExports.value.delete(exportId)
      }
    }

    // Update in exports list
    const exportIndex = exports.value.findIndex((exp) => exp._id === exportId)
    if (exportIndex !== -1) {
      exports.value[exportIndex].status = status
      if (status === 'completed') {
        exports.value[exportIndex].completedAt = new Date().toISOString()
      }
    }

    // Refresh stats if needed
    if (status === 'completed' || status === 'failed') {
      fetchExportStats()
    }

    // Emit custom event for App component to show snackbar
    console.log('📢 Dispatching export-progress-update event')
    const event = new CustomEvent('export-progress-update', {
      detail: { status, message, exportId, percentage }
    })
    window.dispatchEvent(event)
    console.log('📢 Event dispatched')
  }

  /**
   * Initializes socket listeners for export progress
   * @function initializeSocketListeners
   */
  function initializeSocketListeners() {
    console.log('🔧 Initializing export store socket listeners')

    // Ensure socket is connected
    if (!socket.connected) {
      console.log('🔌 Connecting socket...')
      socket.connect()
    } else {
      console.log('✅ Socket already connected')
    }

    // Force connection if not connected
    if (!socket.connected) {
      console.log('🔌 Forcing socket connection...')
      socket.connect()
    }

    // Track connection status
    socket.on('connect', () => {
      connected.value = true
      console.log('✅ Export store connected to socket')
    })

    socket.on('disconnect', () => {
      connected.value = false
      console.log('🔌 Export store disconnected from socket')
    })

    socket.on('export-progress', (progressData) => {
      console.log('📊 Export progress received:', progressData)
      console.log('📊 Socket connected:', socket.connected)
      console.log('📊 Socket ID:', socket.id)
      updateExportProgress(progressData)
    })

    console.log('🔧 Export store socket listeners initialized')
  }

  /**
   * Removes socket listeners
   * @function removeSocketListeners
   */
  function removeSocketListeners() {
    socket.off('connect')
    socket.off('disconnect')
    socket.off('export-progress')
  }

  return {
    // State
    exports,
    loading,
    error,
    connected,
    activeExports,
    exportStats,

    // Computed
    completedExports,
    failedExports,
    pendingExports,
    processingExports,

    // Methods
    fetchExportHistory,
    fetchExportStats,
    createExport,
    downloadExport,
    cleanupExports,
    updateExportProgress,
    initializeSocketListeners,
    removeSocketListeners
  }
})
