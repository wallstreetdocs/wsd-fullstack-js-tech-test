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
            @click="handleDownloadExport(getJobId())"
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
              v-if="showCancelButton"
              size="small"
              color="error"
              variant="text"
              icon="mdi-cancel"
              @click="handleCancel(getJobId())"
              title="Cancel export"
            ></v-btn>
          </template>
          <v-btn
            v-if="showRetryButton"
            size="small"
            color="warning"
            variant="text"
            icon="mdi-refresh"
            @click="handleRetry"
            title="Retry export"
          ></v-btn>
          <v-btn
            size="small"
            color="default"
            variant="text"
            icon="mdi-close"
            @click="closeExportProgress()"
          ></v-btn>
        </div>

        <div class="d-flex align-center">
          <div class="flex-grow-1 mr-2">
            <v-progress-linear
              :model-value="displayProgress"
              :color="progressBarColor"
              height="10"
              striped
              :active="currentStatus === 'processing'"
              :indeterminate="currentStatus === 'processing' && displayProgress < 5"
            ></v-progress-linear>
          </div>
          <div class="text-caption">{{ displayProgress }}%</div>
        </div>

        <div class="d-flex justify-space-between mt-1">
          <div class="text-caption">
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

// Show cancel button for jobs that are processing or paused
const showCancelButton = computed(() => {
  // Always show cancel button when export is active and not completed/failed/cancelled
  const validStatuses = ['processing', 'paused'];
  const shouldShow = validStatuses.includes(currentStatus.value);
  return shouldShow;
})


// Show retry button for any export that's not processing or completed
const showRetryButton = computed(() => {
  return (
    currentStatus.value !== 'processing' && 
    currentStatus.value !== 'completed'
  )
})

// Helper functions to get data
function getJobId() {
  return exportProgress.value.jobId
}

function getTotalItems() {
  // Return the actual value without modification
  const total = exportProgress.value.totalItems;
  return total !== undefined && total !== null ? total : 0;
}

function getProcessedItems() {
  // Return the actual processed items
  const processed = exportProgress.value.processedItems;
  return processed !== undefined && processed !== null ? processed : 0;
}

function getError() {
  return exportProgress.value.error
}

function getRecoverySuggestion() {
  return exportProgress.value.recoverySuggestion
}

//** For all handlers, it's a design decision to not emit to parent
// since this component is very specific and I do not see any use case
// where these handlers would need some overwriting from the parent.
// So I'm giving up some of the concern seperation, for less boilerplate.**/

function handleDownloadExport(jobId) {
  // Use the direct store method like in the audit page
  exportStore.downloadExport(jobId)
  
  // Reset active status (but keep details visible for a while)
  window.setTimeout(() => {
    exportStore.exportProgress.active = false
  }, 3000)
}

// Retry handler
function handleRetry() {
  // Reset the socket connection first for all retry scenarios
  exportStore.resetConnection()
  
  // Use the retry function from export store
  if (exportProgress.value.jobId) {
    exportStore.retryExport(exportProgress.value.jobId)
  }
}

function closeExportProgress() {
  exportStore.exportProgress.active = false
}

// Pause handler
function handlePauseExport(jobId) {
  exportStore.pauseExport(jobId);
}

// Resume handler
function handleResumeExport(jobId) {
  exportStore.resumeExport(jobId);
}

// Cancel handler
function handleCancel(jobId) {
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
