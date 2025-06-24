<!--
/**
 * @fileoverview Export Tasks Component with format selection and progress tracking
 * @component ExportTasks
 * @description Modal dialog for exporting tasks with various format options and current filter application
 */
-->

<template>
  <v-dialog v-model="dialog" max-width="600px" persistent>
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        color="primary"
        variant="outlined"
        prepend-icon="mdi-download"
        :loading="exporting"
        :disabled="exporting"
      >
        Export Tasks
      </v-btn>
    </template>

    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2">mdi-export</v-icon>
        Export Tasks
      </v-card-title>

      <v-card-text>
        <!-- Export Format Selection -->
        <v-row>
          <v-col cols="12">
            <v-label class="text-subtitle-2 mb-2">Export Format</v-label>
            <v-radio-group v-model="exportFormat" inline density="comfortable">
              <v-radio label="JSON" value="json">
                <template #label>
                  <div class="d-flex flex-column">
                    <span class="text-body-2 font-weight-medium">JSON</span>
                    <span class="text-caption text-medium-emphasis">
                      Structured data with metadata
                    </span>
                  </div>
                </template>
              </v-radio>
              <v-radio label="CSV" value="csv">
                <template #label>
                  <div class="d-flex flex-column">
                    <span class="text-body-2 font-weight-medium">CSV</span>
                    <span class="text-caption text-medium-emphasis">
                      Spreadsheet compatible
                    </span>
                  </div>
                </template>
              </v-radio>
            </v-radio-group>
          </v-col>
        </v-row>

        <!-- Current Filters Summary -->
        <v-row v-if="hasActiveFilters">
          <v-col cols="12">
            <v-alert type="info" variant="tonal" density="compact" class="mb-4">
              <template #title>
                <span class="text-body-2">Current Filters Will Be Applied</span>
              </template>
              <div class="text-caption mt-1">
                <v-chip-group density="comfortable" class="ma-0">
                  <v-chip
                    v-if="filters.search"
                    size="x-small"
                    variant="outlined"
                  >
                    Search: "{{ filters.search }}"
                  </v-chip>
                  <v-chip
                    v-if="filters.status"
                    size="x-small"
                    variant="outlined"
                  >
                    Status: {{ filters.status }}
                  </v-chip>
                  <v-chip
                    v-if="filters.priority"
                    size="x-small"
                    variant="outlined"
                  >
                    Priority: {{ filters.priority }}
                  </v-chip>
                  <v-chip
                    v-if="filters.dateFrom"
                    size="x-small"
                    variant="outlined"
                  >
                    From: {{ formatDate(filters.dateFrom) }}
                  </v-chip>
                  <v-chip
                    v-if="filters.dateTo"
                    size="x-small"
                    variant="outlined"
                  >
                    To: {{ formatDate(filters.dateTo) }}
                  </v-chip>
                  <v-chip
                    v-if="filters.category"
                    size="x-small"
                    variant="outlined"
                  >
                    Category: {{ filters.category }}
                  </v-chip>
                  <v-chip
                    v-if="filters.assignedTo"
                    size="x-small"
                    variant="outlined"
                  >
                    Assigned: {{ filters.assignedTo }}
                  </v-chip>
                  <v-chip
                    v-for="tag in filters.tags"
                    :key="tag"
                    size="x-small"
                    variant="outlined"
                  >
                    Tag: {{ tag }}
                  </v-chip>
                </v-chip-group>
              </div>
            </v-alert>
          </v-col>
        </v-row>

        <!-- Export Options -->
        <v-row>
          <v-col cols="12">
            <v-checkbox
              v-model="includeCompleted"
              label="Include completed tasks"
              density="compact"
              hide-details
            />
            <v-checkbox
              v-model="includeMetadata"
              label="Include export metadata"
              density="compact"
              hide-details
              class="mt-2"
            />
          </v-col>
        </v-row>

        <!-- Export Preview -->
        <v-row v-if="exportPreview">
          <v-col cols="12">
            <v-card variant="outlined" class="mt-4">
              <v-card-title class="text-body-2">Export Preview</v-card-title>
              <v-card-text class="pa-3">
                <div class="d-flex justify-space-between text-caption">
                  <span>Estimated file size:</span>
                  <span class="font-weight-medium">{{
                    exportPreview.fileSize
                  }}</span>
                </div>
                <div class="d-flex justify-space-between text-caption mt-1">
                  <span>Total tasks to export:</span>
                  <span class="font-weight-medium">{{
                    exportPreview.taskCount
                  }}</span>
                </div>
                <div class="d-flex justify-space-between text-caption mt-1">
                  <span>Format:</span>
                  <span class="font-weight-medium text-uppercase">{{
                    exportFormat
                  }}</span>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Progress Bar -->
        <v-row v-if="exporting">
          <v-col cols="12">
            <v-progress-linear
              :model-value="exportProgress"
              color="primary"
              height="6"
              rounded
              class="mt-4"
            />
            <div class="text-center text-caption mt-2">
              {{ exportStatus }}
            </div>
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="exporting" @click="closeDialog">
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="exporting"
          :disabled="exporting"
          @click="startExport"
        >
          <v-icon left>mdi-download</v-icon>
          Export
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Success/Error Snackbar -->
    <v-snackbar
      v-model="showNotification"
      :color="notificationType"
      location="top"
      timeout="5000"
    >
      {{ notificationMessage }}
      <template #actions>
        <v-btn variant="text" @click="showNotification = false"> Close </v-btn>
      </template>
    </v-snackbar>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import apiClient from '../api/client'

const taskStore = useTaskStore()

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['update:modelValue'])

// Reactive state
const dialog = ref(false)
const exportFormat = ref('json')
const includeCompleted = ref(true)
const includeMetadata = ref(true)
const exporting = ref(false)
const exportProgress = ref(0)
const exportStatus = ref('')
const exportPreview = ref(null)
const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

// Computed
const filters = computed(() => taskStore.filters)
const hasActiveFilters = computed(() => taskStore.activeFiltersCount > 0)

// Watch dialog state
watch(dialog, (newValue) => {
  emit('update:modelValue', newValue)
  if (newValue) {
    generatePreview()
  }
})

watch(
  () => props.modelValue,
  (newValue) => {
    dialog.value = newValue
  }
)

// Methods
function closeDialog() {
  if (!exporting.value) {
    dialog.value = false
  }
}

function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}

async function generatePreview() {
  const filteredTasks = taskStore.filteredTasks
  const taskCount = includeCompleted.value
    ? filteredTasks.length
    : filteredTasks.filter((task) => task.status !== 'completed').length

  // Estimate file size (rough calculation)
  const avgTaskSize = 500 // bytes per task (estimate)
  const estimatedBytes = taskCount * avgTaskSize
  let fileSize = ''

  if (estimatedBytes < 1024) {
    fileSize = `${estimatedBytes} B`
  } else if (estimatedBytes < 1024 * 1024) {
    fileSize = `${(estimatedBytes / 1024).toFixed(1)} KB`
  } else {
    fileSize = `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`
  }

  exportPreview.value = {
    taskCount,
    fileSize
  }
}

async function startExport() {
  if (exporting.value) return

  exporting.value = true
  exportProgress.value = 0
  exportStatus.value = 'Preparing export...'

  try {
    // Build export parameters from current filters
    const exportParams = {
      format: exportFormat.value,
      ...filters.value
    }

    // Remove empty values
    Object.keys(exportParams).forEach((key) => {
      if (
        !exportParams[key] ||
        (Array.isArray(exportParams[key]) && exportParams[key].length === 0)
      ) {
        delete exportParams[key]
      }
    })

    // Handle completed tasks filter
    if (!includeCompleted.value) {
      exportParams.status = exportParams.status || 'pending,in-progress'
    }

    // Update progress
    exportProgress.value = 25
    exportStatus.value = 'Fetching tasks...'

    // Simulate some delay for UX
    // eslint-disable-next-line no-undef
    await new Promise((resolve) => setTimeout(resolve, 500))

    exportProgress.value = 50
    exportStatus.value = 'Processing data...'

    // eslint-disable-next-line no-undef
    await new Promise((resolve) => setTimeout(resolve, 300))

    exportProgress.value = 75
    exportStatus.value = 'Generating file...'

    // Perform the actual export
    await apiClient.exportAndDownloadTasks(exportParams)

    exportProgress.value = 100
    exportStatus.value = 'Export completed!'

    // Show success notification
    showSuccessNotification('Tasks exported successfully!')

    // Close dialog after short delay
    // eslint-disable-next-line no-undef
    setTimeout(() => {
      closeDialog()
    }, 1000)
  } catch (error) {
    console.error('Export failed:', error)
    showErrorNotification(`Export failed: ${error.message}`)
  } finally {
    // eslint-disable-next-line no-undef
    setTimeout(() => {
      exporting.value = false
      exportProgress.value = 0
      exportStatus.value = ''
    }, 1500)
  }
}

function showSuccessNotification(message) {
  notificationMessage.value = message
  notificationType.value = 'success'
  showNotification.value = true
}

function showErrorNotification(message) {
  notificationMessage.value = message
  notificationType.value = 'error'
  showNotification.value = true
}

// Update preview when format or options change
watch([exportFormat, includeCompleted], generatePreview)
</script>

<style scoped>
.v-radio-group :deep(.v-selection-control) {
  margin-bottom: 8px;
}

.v-chip-group {
  gap: 4px;
}

.export-preview {
  background: rgba(var(--v-theme-primary), 0.05);
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 8px;
}
</style>
