/**
 * @fileoverview Export store for managing task exports, history, and real-time updates
 * @module stores/exportStore
 */

import { defineStore } from 'pinia'
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import apiClient from '../api/client.js'
import socket from '../plugins/socket.js'
import { categorizeError, ErrorCategory } from '../utils/errorHandler.js'

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
    errorCategory: null,
    errorRecoverable: false,
    recoverySuggestion: null,
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
    
    // Completely reset export progress state to prevent carrying over values from previous exports
    Object.assign(exportProgress, {
      jobId: null,
      active: true,
      format: format,
      filters: filters,
      progress: 0,
      processedItems: 0,
      totalItems: null, // Use null instead of 0 to indicate uninitialized state
      error: null,
      errorCategory: null,
      errorRecoverable: false,
      recoverySuggestion: null,
      status: 'pending',
      filename: null
    })

    try {
      // Filters are already cleaned by the calling component
      const queryParams = { ...filters }

      // Start export job
      console.log("BEFORE SERVER!!!!!!!!!!!!!!!!!!!!!!!!!!")
      const response = await apiClient.exportTasks(format, queryParams)
      console.log("SERVER RESPONDED ??????????????????????????")
      // Store job ID for tracking
      const jobId = response.data.jobId
      exportProgress.jobId = jobId
      
      // Ensure we set status to 'processing' right away for better UI feedback
      exportProgress.status = 'processing'

      // Add to active exports - use actual values
      activeExports[jobId] = {
        id: jobId,
        format,
        status: 'processing',
        progress: 0,
        createdAt: new Date()
      }
      return response.data
    } catch (err) {
      // Categorize the error
      const categorizedError = categorizeError(err)
      
      // Update export progress with categorized error details
      exportProgress.error = categorizedError.message
      exportProgress.errorCategory = categorizedError.category
      exportProgress.errorRecoverable = categorizedError.recoverable
      exportProgress.recoverySuggestion = categorizedError.recoverySuggestion
      
      // Set appropriate status based on error category
      if (categorizedError.category === ErrorCategory.NETWORK) {
        exportProgress.status = 'connection-error'
        
        // Create a temporary job ID so we can retry later if needed
        if (!exportProgress.jobId) {
          exportProgress.jobId = 'pending-' + Date.now()
        }
      } else if (categorizedError.category === ErrorCategory.TIMEOUT) {
        exportProgress.status = 'timeout-error'
      } else if (categorizedError.category === ErrorCategory.SERVER) {
        exportProgress.status = 'server-error'
      } else {
        // For other errors
        exportProgress.status = 'failed'
      }
      
      // Still set the error value for internal tracking
      error.value = categorizedError.message
      console.error('Error starting export:', err, categorizedError)
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
      // Get format from the most reliable source
      const format = getExportFormat(jobId)
      
      // Set filename with correct extension
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `tasks_export_${timestamp}.${format}`

      // Download and trigger browser save
      const blob = await apiClient.downloadExport(jobId)
      triggerDownload(blob, filename)
      
      // Clear any error messages after a successful download
      if (jobId === exportProgress.jobId) {
        exportProgress.error = null
      }
      
      if (activeExports[jobId]) {
        activeExports[jobId].error = null
      }
      
      return true
    } catch (err) {
      console.error('Error downloading export:', err)
      
      // Categorize the error
      const categorizedError = categorizeError(err)
      
      // Update the error message but don't change the status
      // This way, users can still retry the download
      if (jobId === exportProgress.jobId) {
        exportProgress.error = categorizedError.message
        exportProgress.errorCategory = categorizedError.category
        exportProgress.errorRecoverable = categorizedError.recoverable
        exportProgress.recoverySuggestion = categorizedError.recoverySuggestion
      }
      
      if (activeExports[jobId]) {
        activeExports[jobId].error = categorizedError.message
        activeExports[jobId].errorCategory = categorizedError.category
        activeExports[jobId].errorRecoverable = categorizedError.recoverable
        activeExports[jobId].recoverySuggestion = categorizedError.recoverySuggestion
      }
      
      error.value = categorizedError.message
    }
  }
  
  /**
   * Helper to determine export format from available sources
   * @function getExportFormat
   * @param {string} jobId - Export job ID
   * @returns {string} Export format ('json' or 'csv')
   */
  function getExportFormat(jobId) {
    // Check active export progress first (for progress bar downloads)
    if (exportProgress.jobId === jobId && exportProgress.format) {
      return exportProgress.format
    }
    
    // Then check history (for audit list downloads)
    const job = exportHistory.value.find(j => j._id === jobId)
    if (job && job.format) {
      return job.format
    }
    
    // Default fallback
    return 'csv'
  }
  
  /**
   * Helper to trigger file download in browser
   * @function triggerDownload
   * @param {Blob} blob - File data as blob
   * @param {string} filename - Download filename
   */
  function triggerDownload(blob, filename) {
    const url = window.URL.createObjectURL(blob)
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
      // Only emit pause event - JobStateManager handles state updates and broadcasts
      socket.emit('export:pause', { jobId })
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
      // Only emit resume event - JobStateManager handles state updates and broadcasts
      socket.emit('export:resume', { jobId })
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
        // Start a completely new export with the same parameters
        const format = exportProgress.format || 'csv'
        const filters = exportProgress.filters || {}
        
        // Start a new export (this will reset progress automatically)
        await exportTasks(format, filters)

    } catch (err) {
      console.error('Error retrying export:', err)
      
      // Categorize the error
      const categorizedError = categorizeError(err)
      
      // Update export progress with categorized error details
      exportProgress.error = `Retry failed: ${categorizedError.message}`
      exportProgress.errorCategory = categorizedError.category
      exportProgress.errorRecoverable = categorizedError.recoverable
      exportProgress.recoverySuggestion = categorizedError.recoverySuggestion
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
    socket.on('export:progress', (data) => {
      const { jobId, status, progress, processedItems, totalItems } = data

      // If we got a progress event with a different jobId than our current one
      // and our current job is null or complete, this is a new export
      if (jobId !== exportProgress.jobId && 
          (!exportProgress.jobId || exportProgress.status === 'completed')) {

        // Completely reset state for the new job to prevent carrying over values
        Object.assign(exportProgress, {
          jobId: jobId,
          active: true,
          progress: 0,
          processedItems: 0,
          totalItems: null, // Use null to indicate uninitialized state
          error: null,
          errorCategory: null,
          errorRecoverable: false,
          recoverySuggestion: null,
          status: 'pending',
          filename: null
        });
      }
      
      // Update export progress if it's the current export
      if (jobId === exportProgress.jobId) {
        
        // If we're getting progress updates, we should clear any previous error
        // messages since the export is working again
        if (status === 'processing' && exportProgress.error) {
          exportProgress.error = null
        }
        
        // Always update status
        exportProgress.status = status
        
        // Always update progress - ensure it's a number between 0-100
        exportProgress.progress = Math.min(100, Math.max(0, progress || 0))
        
        // Ensure we have valid values for processedItems and totalItems
        if (processedItems !== undefined && processedItems !== null) {
          exportProgress.processedItems = Math.max(0, processedItems)
        }
        
        // Always update totalItems if provided, even if it's 0
        if (totalItems !== undefined && totalItems !== null) {
          exportProgress.totalItems = totalItems
        }
        
        // If we have processedItems but totalItems is still null, use processedItems as totalItems
        if (exportProgress.processedItems > 0 && exportProgress.totalItems === null) {
          exportProgress.totalItems = exportProgress.processedItems
        }
        
        // Always keep the export active while we're receiving updates
        exportProgress.active = true;
        
      } else {
        console.log(`[ExportStore] Ignoring progress update for job ${jobId} - current job is ${exportProgress.jobId}`);
      }

      // Update in active exports list
      if (activeExports[jobId]) {
        activeExports[jobId].status = status
        activeExports[jobId].progress = progress
        
        // Clear any errors in the active exports list
        if (status === 'processing') {
          activeExports[jobId].error = null
        }
      }
    })

    // Export completed
    socket.on('export:completed', (data) => {
      const { jobId, filename, totalItems } = data
      
      // If we got a completion event with a different jobId than our current one
      // and our current job is null, this could be a job that started before the page loaded
      if (jobId !== exportProgress.jobId && !exportProgress.jobId) {
        exportProgress.jobId = jobId;
      }
      
      // Update if it's the current export
      if (jobId === exportProgress.jobId) {
        console.log(`[ExportStore] Updating export progress to completed for job ${jobId}`)
        exportProgress.status = 'completed'
        exportProgress.progress = 100
        exportProgress.filename = filename
        
        // Get the actual total items count from the server if available
        let finalCount = 0;
        
        if (totalItems && totalItems > 0) {
          // Use the count from the server if provided
          console.log(`[ExportStore] Setting final item count from server data: ${totalItems}`);
          finalCount = totalItems;
        } else if (exportProgress.processedItems > 0) {
          // Use processed items as the final count if we have it
          console.log(`[ExportStore] Using processedItems (${exportProgress.processedItems}) as final count`);
          finalCount = exportProgress.processedItems;
        } else if (exportProgress.totalItems > 0) {
          // Fall back to the existing total if we have it
          console.log(`[ExportStore] Using existing totalItems (${exportProgress.totalItems}) as final count`);
          finalCount = exportProgress.totalItems;
        } else {
          // Last resort - fetch the actual count from the server
          console.log(`[ExportStore] No count available, fetching from server`);
          refreshExportStatus(jobId);
          finalCount = 1; // Temporary value until refresh completes
        }
        
        // Set both values to ensure consistency - use the server-provided totalItems
        exportProgress.totalItems = totalItems || finalCount;
        exportProgress.processedItems = finalCount;
        
        // Clear any error messages on completion
        exportProgress.error = null

        // IMPORTANT: Keep the progress bar visible and active
        exportProgress.active = true
        
        // Force Vue reactivity update on next tick
        nextTick(() => {
          console.log(`[ExportStore] Force update completed - status: ${exportProgress.status}`)
        })
      } else {
        console.log(`[ExportStore] Ignoring completion for job ${jobId} - current job is ${exportProgress.jobId}`);
      }

      // Update in active exports list
      if (activeExports[jobId]) {
        activeExports[jobId].status = 'completed'
        activeExports[jobId].progress = 100
        activeExports[jobId].filename = filename
        activeExports[jobId].downloadReady = true
        // Clear any error messages
        activeExports[jobId].error = null
      }
    })

    // Export failed
    socket.on('export:failed', (data) => {
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
    
    // Export cancelled
    socket.on('export:cancelled', (data) => {
      const { jobId } = data

      // Update if it's the current export
      if (jobId === exportProgress.jobId) {
        exportProgress.status = 'cancelled'
        exportProgress.active = false // Hide the progress bar
      }

      // Update in active exports list
      if (activeExports[jobId]) {
        activeExports[jobId].status = 'cancelled'
      }
    })

    // Export download ready
    socket.on('export:download-ready', (data) => {
      const { jobId, filename } = data

      // Update active exports
      if (activeExports[jobId]) {
        activeExports[jobId].downloadReady = true
        activeExports[jobId].filename = filename
      }
    })

    // Check for active exports on reconnection
    socket.on('connect', () => {
      console.log('Export store: Reconnected, checking for active exports...')
      socket.emit('export:reconnect')
      
      // If there was an active export that might have been interrupted
      if (exportProgress.active && exportProgress.jobId) {
        console.log(`Export store: Reconnected with active export job ${exportProgress.jobId}`)
        
        // Request latest status of the specific job
        socket.emit('export:get:client-jobs')
        
        // For jobs that were in progress or paused, we need to resume them
        if (['processing', 'paused'].includes(exportProgress.status)) {
          console.log(`Export store: Attempting to resume job ${exportProgress.jobId} after reconnection`)
          
          // Small delay to ensure server has time to process the reconnect-exports first
          setTimeout(() => {
            // If it was paused, explicitly resume it
            if (exportProgress.status === 'paused') {
              socket.emit('export:resume', { jobId: exportProgress.jobId })
            } else {
              // If it was in progress, re-request its status which will trigger updates
              socket.emit('export:get:status', { jobId: exportProgress.jobId })
            }
          }, 500)
        }
      }
    })

    // We removed these handlers in favor of the global handlers in App.vue
    // that update the export state when needed. This is more centralized and cleaner.

    // Handle active exports on reconnection
    socket.on('export:active-jobs', (data) => {
      console.log("HORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY")
      const { jobs } = data
      console.log(`Export store: Received ${jobs.length} active export(s) after reconnection`)

      // Update active exports
      jobs.forEach((job) => {
        activeExports[job._id] = {
          id: job._id,
          format: job.format,
          status: job.status,
          progress: job.progress,
          createdAt: new Date(job.createdAt),
          processedItems: job.processedItems || 0,
          totalItems: job.totalItems || 1
        }

        // Update current export progress if this is the active job
        if (job._id === exportProgress.jobId) {
          // Restore the active flag if it was previously active
          exportProgress.active = true
          exportProgress.status = job.status
          exportProgress.progress = job.progress
          exportProgress.processedItems = job.processedItems || 0
          
          // Always update totalItems if the job provides it, regardless of value
          if (job.totalItems !== undefined && job.totalItems !== null) {
            exportProgress.totalItems = job.totalItems
          } else if (exportProgress.totalItems === null) {
            // Only set to 0 if we haven't received any totalItems yet
            console.log(`[ExportStore DEBUG] No totalItems in active job, setting to 0`);
            exportProgress.totalItems = 0;
          }
          
          // For completed jobs, ensure we have the filename for download
          if (job.status === 'completed' && job.filename) {
            exportProgress.filename = job.filename
          }
          
          // If the job is paused or still processing, we might need to resume it
          if (['paused', 'processing'].includes(job.status)) {
            console.log(`Active job ${job._id} is ${job.status}, might need resuming`)
          }
        }
      })
      
      // Handle case where current export isn't in active jobs (might be complete or failed)
      if (exportProgress.active && exportProgress.jobId && 
          !jobs.some(job => job._id === exportProgress.jobId)) {
        // The job might be complete or failed, get its current status
        socket.emit('export:get:status', { jobId: exportProgress.jobId })
      }
    })
    
    // Add handler for export status check
    socket.on('export:status', (data) => {
      if (data.jobId === exportProgress.jobId) {
        console.log(`Received export status update for job ${data.jobId}: ${data.status}`)
        exportProgress.status = data.status
        exportProgress.progress = data.progress
        
        // For completed jobs that were interrupted
        if (data.status === 'completed' && !exportProgress.filename) {
          exportProgress.filename = data.filename
        }
      }
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
   * Checks and refreshes the status of an export job
   * @async
   * @function refreshExportStatus
   * @param {string} jobId - Export job ID to refresh
   */
  async function refreshExportStatus(jobId = exportProgress.jobId) {
    if (!jobId) return
    
    // Skip refresh for temporary pending job IDs - they don't exist on the server
    if (jobId.startsWith('pending-')) {
      console.log(`Skipping refresh for temporary job ID: ${jobId}`)
      return
    }
    
    try {
      console.log(`Refreshing export status for job ${jobId}`)
      const response = await apiClient.getExportStatus(jobId)
      
      console.log("ALOHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
      if (response.success) {
        const jobData = response.data
        
        // Update the export progress
        exportProgress.status = jobData.status
        exportProgress.progress = jobData.progress
        exportProgress.processedItems = jobData.processedItems || 0
        
        // Always update totalItems if the job data provides it, regardless of value
        if (jobData.totalItems !== undefined && jobData.totalItems !== null) {
          exportProgress.totalItems = jobData.totalItems
        } else if (exportProgress.totalItems === null) {
          // Only set to 0 if we haven't received any totalItems yet
          console.log(`[ExportStore DEBUG] No totalItems in job data, setting to 0`);
          exportProgress.totalItems = 0;
        }
        
        // Clear error message if job is working fine
        if (['processing', 'completed', 'paused'].includes(jobData.status)) {
          exportProgress.error = null
        }
        
        // For completed jobs, ensure we have the filename
        if (jobData.status === 'completed' && jobData.filename) {
          exportProgress.filename = jobData.filename
          exportProgress.active = true // Keep the progress bar visible
        }
        
        // Update active exports
        if (activeExports[jobId]) {
          activeExports[jobId].status = jobData.status
          activeExports[jobId].progress = jobData.progress
          
          // Clear error in active exports list
          if (['processing', 'completed', 'paused'].includes(jobData.status)) {
            activeExports[jobId].error = null
          }
        }
        
        // If job was in progress but appears to be stalled, try to resume it
        if (jobData.status === 'processing') {
          const lastUpdated = new Date(jobData.updatedAt).getTime()
          const now = Date.now()
          
          if (now - lastUpdated > 30000) { // 30 seconds with no update
            console.log(`Job ${jobId} appears stalled, attempting to resume`)
            resumeExport(jobId)
          }
        }
      }
    } catch (err) {
      console.error(`Error refreshing export status for job ${jobId}:`, err)
      
      // Categorize the error but don't update UI for network errors
      const categorizedError = categorizeError(err)
      
      // Only update the UI for non-network errors that might need user attention
      if (categorizedError.category !== ErrorCategory.NETWORK) {
        if (jobId === exportProgress.jobId) {
          // Keep the previous status but update the error details
          exportProgress.error = categorizedError.message
          exportProgress.errorCategory = categorizedError.category
          exportProgress.errorRecoverable = categorizedError.recoverable
          exportProgress.recoverySuggestion = categorizedError.recoverySuggestion
        }
      }
      // We don't update the status - we'll keep the previous state
      // This avoids disrupting the UI for temporary issues
    }
  }

  initializeSocketListeners()

  /**
   * Removes Socket.IO event listeners
   * @function cleanup
   */
  function cleanup() {
    socket.off('export:progress')
    socket.off('export:completed')
    socket.off('export:failed')
    socket.off('export:download-ready')
    socket.off('export:active-jobs')
    socket.off('export:status')
    socket.off('connect')
    socket.off('connect_error')
    socket.off('disconnect')
    socket.off('reconnecting')
  }

  /**
   * Cancels an export job
   * @async
   * @function cancelExport
   * @param {string} jobId - Export job ID to cancel
   * @returns {Promise<void>}
   */
  async function cancelExport(jobId = exportProgress.jobId) {
    if (!jobId) return;

    try {
      // Only emit cancel event - JobStateManager handles state updates and broadcasts
      socket.emit('export:cancel', { jobId });
    } catch (err) {
      console.error('Error canceling export:', err);
    }
  }

  return {
    loading,
    error,
    exportTasks,
    downloadExport,
    pauseExport,
    resumeExport,
    cancelExport,
    retryExport,
    getExportHistory,
    refreshExportStatus,
    exportProgress,
    activeExports,
    exportHistory,
    initializeSocketListeners,
    cleanup,
    connect,
    disconnect,
    resetConnection: socket.resetConnection
  }
})
