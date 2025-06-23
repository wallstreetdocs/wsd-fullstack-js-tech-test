<!--
/**
 * @fileoverview Component for displaying export job progress
 * @component ExportProgressBar
 * @description Progress bar and controls for active task exports
 * @emits {String} download - Emitted when user requests download of completed export
 * @emits {String} pause - Emitted when user requests to pause export
 * @emits {String} resume - Emitted when user requests to resume export
 * @emits {String} cancel - Emitted when user requests to cancel export
 * @emits {void} close - Emitted when user closes the progress bar
 */
-->

<template>
  <!-- Export progress bar (floating notification) -->
  <div v-if="isVisible" class="export-progress-container">
    <v-card class="export-progress-card">
      <v-card-text>
        <div class="d-flex align-center mb-2">
          <div>
            <span class="text-subtitle-1">Export Progress</span>
            <span class="text-caption ml-2">{{ formattedStatus }}</span>
          </div>
          <v-spacer></v-spacer>
          <v-btn
            v-if="showDownloadButton"
            size="small"
            color="primary"
            variant="text"
            icon="mdi-download"
            @click="$emit('download', getJobId())"
            title="Download export"
          ></v-btn>
          <!-- Always show these buttons when exportProgress.status is not null or undefined -->
          <template v-if="exportProgress.status">
            <v-btn
              v-if="currentStatus === 'processing'"
              size="small"
              color="warning"
              variant="text"
              icon="mdi-pause"
              @click="handlePauseExport(getJobId())"
              title="Pause export"
            ></v-btn>
            <v-btn
              v-if="currentStatus === 'paused'"
              size="small"
              color="success" 
              variant="text"
              icon="mdi-play"
              @click="handleResumeExport(getJobId())"
              title="Resume export"
            ></v-btn>
            <v-btn
              size="small"
              color="error"
              variant="text"
              icon="mdi-cancel"
              @click="handleCancel(getJobId())"
              title="Cancel export (Always visible for testing)"
            ></v-btn>
          </template>
          <v-btn
            v-if="showReconnectButton"
            size="small"
            color="info"
            variant="text"
            icon="mdi-reload"
            @click="handleReconnect"
          ></v-btn>
          <v-btn
            v-if="showRetryButton"
            size="small"
            color="warning"
            variant="text"
            icon="mdi-refresh"
            @click="handleRetry"
          ></v-btn>
          <v-btn
            size="small"
            color="default"
            variant="text"
            icon="mdi-close"
            @click="$emit('close')"
          ></v-btn>
        </div>

        <div class="d-flex align-center">
          <div class="flex-grow-1 mr-2">
            <v-progress-linear
              :model-value="displayProgress"
              :color="progressBarColor"
              height="10"
              striped
            ></v-progress-linear>
          </div>
          <div class="text-caption">{{ displayProgress }}%</div>
        </div>

        <div class="d-flex justify-space-between mt-1">
          <div class="text-caption">
            <!-- SIMPLIFIED: Always show the actual count - much simpler -->
            {{ getProcessedItems() }} / {{ getTotalItems() }} items
          </div>
          <div v-if="getError() && currentStatus !== 'completed'" class="text-caption error-message">
            <span>{{ errorMessage }}</span>
            <template v-if="getRecoverySuggestion()">
              <br>
              <span class="suggestion">{{ getRecoverySuggestion() }}</span>
            </template>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useExportStore } from '../stores/exportStore.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['download', 'pause', 'resume', 'cancel', 'close'])

const exportStore = useExportStore()
const exportProgress = computed(() => exportStore.exportProgress)

// Visibility for progress bar
const isVisible = computed(() => {
  return props.visible || exportProgress.value.active
})

// Current export status
const currentStatus = computed(() => {
  const status = exportProgress.value.status;
  console.log(`ExportProgressBar - status: ${status}, active: ${exportProgress.value.active}, jobId: ${exportProgress.value.jobId}`);
  return status;
})

// Show accurate progress without artificial minimums or alterations
const displayProgress = computed(() => {
  const status = currentStatus.value;
  const progress = exportProgress.value.progress;
  
  // Always show 100% for completed exports, otherwise show actual progress
  return status === 'completed' ? 100 : progress;
})

// Get formatted status based on current status
const formattedStatus = computed(() => {
  switch (currentStatus.value) {
    case 'pending':
      return 'Preparing export...'
    case 'processing':
      return 'Exporting...'
    case 'paused':
      return 'Paused'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'connection-error':
      return 'Connection lost - waiting to reconnect...'
    case 'timeout-error':
      return 'Request timed out'
    case 'server-error':
      return 'Server error'
    case 'reconnecting':
      return 'Reconnecting...'
    default:
      return ''
  }
})

// Get error message based on error category
const errorMessage = computed(() => {
  if (!getError()) return ''
  
  // For specific error categories, provide a more user-friendly message
  switch (exportProgress.value.errorCategory) {
    case 'network':
      return 'Connection issue'
    case 'server':
      return 'Server error'
    case 'timeout':
      return 'Request timed out'
    case 'not_found':
      return 'Export not found'
    case 'auth':
      return 'Authentication error'
    case 'validation':
      return 'Invalid request'
    default:
      return getError()
  }
})

// Get progress bar color based on status
const progressBarColor = computed(() => {
  switch (currentStatus.value) {
    case 'pending':
      return 'info'
    case 'processing':
      return 'primary'
    case 'paused':
      return 'warning'
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'cancelled':
      return 'grey-darken-1'
    case 'connection-error':
      return 'grey'
    case 'timeout-error':
      return 'amber'
    case 'server-error':
      return 'deep-orange'
    case 'reconnecting':
      return 'orange'
    default:
      return 'primary'
  }
})

// Control button visibility
const showDownloadButton = computed(() => {
  return currentStatus.value === 'completed'
})

const showPauseButton = computed(() => {
  // Only show pause button when processing (not paused or other states)
  const shouldShow = currentStatus.value === 'processing';
  console.log(`showPauseButton: ${shouldShow}, status: ${currentStatus.value}`);
  return shouldShow;
})

const showResumeButton = computed(() => {
  // Only show resume button when paused
  const shouldShow = currentStatus.value === 'paused';
  console.log(`showResumeButton: ${shouldShow}, status: ${currentStatus.value}`);
  return shouldShow;
})

// Show cancel button for jobs that are processing or paused
const showCancelButton = computed(() => {
  // Always show cancel button when export is active and not completed/failed/cancelled
  const validStatuses = ['processing', 'paused'];
  const shouldShow = validStatuses.includes(currentStatus.value);
  console.log(`showCancelButton: ${shouldShow}, status: ${currentStatus.value}, includes: ${validStatuses.includes(currentStatus.value)}`);
  return shouldShow;
})

// Single button for connection issues - combines reconnect and retry functionality
const showReconnectButton = computed(() => {
  return currentStatus.value === 'connection-error'
})

// Show retry button for failed exports and server errors that are recoverable
const showRetryButton = computed(() => {
  return (
    currentStatus.value === 'failed' || 
    currentStatus.value === 'server-error' || 
    currentStatus.value === 'timeout-error' ||
    (exportProgress.value.errorRecoverable && currentStatus.value !== 'connection-error')
  )
})

// Helper functions to get data
function getJobId() {
  return exportProgress.value.jobId
}

function getTotalItems() {
  // Return the actual value without modification
  return exportProgress.value.totalItems || 0;
}

function getProcessedItems() {
  // Return the actual processed items
  return exportProgress.value.processedItems || 0;
}

function getError() {
  return exportProgress.value.error
}

function getRecoverySuggestion() {
  return exportProgress.value.recoverySuggestion
}

function getFormat() {
  return exportProgress.value.format
}

// Event handlers
function handleReconnect() {
  // Reset the socket connection first
  exportStore.resetConnection()
  
  // If we have a job ID, also try to resume/retry the export after reconnection
  if (exportProgress.value.jobId) {
    // Small delay to allow reconnection to complete
    setTimeout(() => {
      exportStore.refreshExportStatus(exportProgress.value.jobId)
    }, 1000)
  }
}

function handleRetry() {
  // Use the retry function from export store
  if (exportProgress.value.jobId) {
    exportStore.retryExport(exportProgress.value.jobId)
  }
}

// Handler functions that both emit events and call store methods directly
function handlePauseExport(jobId) {
  console.log(`Pausing export for job: ${jobId}`);
  emit('pause', jobId);
  exportStore.pauseExport(jobId);
  // Force the status to paused for immediate UI feedback
  exportProgress.value.status = 'paused';
}

function handleResumeExport(jobId) {
  console.log(`Resuming export for job: ${jobId}`);
  emit('resume', jobId);
  exportStore.resumeExport(jobId);
  // Force the status to processing for immediate UI feedback
  exportProgress.value.status = 'processing';
}

function handleCancel(jobId) {
  // First emit the cancel event for parent components
  console.log(`Emitting cancel event for job: ${jobId}`);
  emit('cancel', jobId);
  
  // Also use the cancel function from export store directly
  exportStore.cancelExport(jobId);
}
</script>

<style scoped>
.export-progress-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  width: 400px;
  max-width: 100%;
}

.export-progress-card {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.error-message {
  color: rgba(var(--v-theme-error), 0.8);
  font-size: 0.75rem;
  margin-top: 4px;
}

.suggestion {
  color: rgba(var(--v-theme-primary), 0.8);
  font-style: italic;
}
</style>
