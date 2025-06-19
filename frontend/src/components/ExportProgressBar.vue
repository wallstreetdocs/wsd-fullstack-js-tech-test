<!--
/**
 * @fileoverview Component for displaying export job progress
 * @component ExportProgressBar
 * @description Progress bar and controls for active task exports
 * @emits {String} download - Emitted when user requests download of completed export
 * @emits {String} pause - Emitted when user requests to pause export
 * @emits {String} resume - Emitted when user requests to resume export
 * @emits {void} close - Emitted when user closes the progress bar
 */
-->

<template>
  <div v-if="isVisible" class="export-progress-container">
    <v-card class="export-progress-card">
      <v-card-text>
        <div class="d-flex align-center mb-2">
          <div>
            <span class="text-subtitle-1">Export Progress</span>
            <span class="text-caption ml-2">{{ formatStatus }}</span>
          </div>
          <v-spacer></v-spacer>
          <v-btn
            v-if="showDownloadButton"
            size="small"
            color="primary"
            variant="text"
            icon="mdi-download"
            @click="$emit('download', exportProgress.jobId)"
          ></v-btn>
          <v-btn
            v-if="showPauseButton"
            size="small"
            color="warning"
            variant="text"
            icon="mdi-pause"
            @click="$emit('pause', exportProgress.jobId)"
          ></v-btn>
          <v-btn
            v-if="showResumeButton"
            size="small"
            color="success"
            variant="text"
            icon="mdi-play"
            @click="$emit('resume', exportProgress.jobId)"
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
              :model-value="exportProgress.progress"
              :color="progressColor"
              height="10"
              striped
            ></v-progress-linear>
          </div>
          <div class="text-caption">
            {{ exportProgress.progress }}%
          </div>
        </div>
        
        <div class="d-flex justify-space-between mt-1">
          <div class="text-caption">
            <template v-if="exportProgress.totalItems > 0">
              {{ exportProgress.processedItems }} / {{ exportProgress.totalItems }} items
            </template>
            <template v-else>
              {{ exportProgress.format?.toUpperCase() }} Export
            </template>
          </div>
          <div class="text-caption" v-if="exportProgress.error">
            Error: {{ exportProgress.error }}
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

defineEmits(['download', 'pause', 'resume', 'close'])

const taskStore = useTaskStore()
const exportProgress = computed(() => taskStore.exportProgress)

const isVisible = computed(() => {
  return props.visible || exportProgress.value.active
})

const formatStatus = computed(() => {
  switch (exportProgress.value.status) {
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
    default:
      return ''
  }
})

const progressColor = computed(() => {
  switch (exportProgress.value.status) {
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
    default:
      return 'primary'
  }
})

const showDownloadButton = computed(() => {
  return exportProgress.value.status === 'completed'
})

const showPauseButton = computed(() => {
  return exportProgress.value.status === 'processing'
})

const showResumeButton = computed(() => {
  return exportProgress.value.status === 'paused'
})
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
</style>