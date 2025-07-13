<!--
/**
 * @fileoverview Export History view with comprehensive export management
 * @component ExportHistory
 * @description Dedicated page for viewing export history, statistics, and managing exports
 */
-->

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="page-title mr-4">Export History</h1>
      <v-chip
        v-if="exportStore.connected"
        color="success"
        variant="flat"
        size="small"
      >
        <v-icon start>mdi-wifi</v-icon>
        Live
      </v-chip>
      <v-chip v-else color="error" variant="flat" size="small">
        <v-icon start>mdi-wifi-off</v-icon>
        Offline
      </v-chip>
      <v-chip
        v-if="exportStore.activeExports.size > 0"
        color="info"
        variant="flat"
        size="small"
        class="ml-2"
      >
        <v-icon start>mdi-progress-clock</v-icon>
        {{ exportStore.activeExports.size }} Active
      </v-chip>
      <v-spacer></v-spacer>
      <v-btn color="primary" @click="showExportDialog = true" class="mr-2">
        <v-icon left>mdi-download</v-icon>
        New Export
      </v-btn>
      <v-btn
        variant="outlined"
        @click="refreshData"
        :loading="exportStore.loading"
        class="mr-2"
      >
        <v-icon left>mdi-refresh</v-icon>
        Refresh
      </v-btn>
      <v-btn
        variant="outlined"
        @click="testSnackbar"
        color="warning"
      >
        <v-icon left>mdi-test-tube</v-icon>
        Test Snackbar
      </v-btn>
    </div>

    <!-- Export Statistics Cards -->
    <v-row class="mb-6">
      <v-col cols="12" md="3">
        <v-card variant="outlined" class="text-center">
          <v-card-text>
            <div class="text-h4 text-primary">
              {{ exportStore.exportStats.summary.total }}
            </div>
            <div class="text-subtitle-1">Total Exports</div>
            <div class="text-caption text-grey">All time</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card variant="outlined" class="text-center">
          <v-card-text>
            <div class="text-h4 text-success">
              {{ exportStore.exportStats.summary.completed }}
            </div>
            <div class="text-subtitle-1">Completed</div>
            <div class="text-caption text-grey">Ready for download</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card variant="outlined" class="text-center">
          <v-card-text>
            <div class="text-h4 text-warning">
              {{ exportStore.exportStats.summary.processing }}
            </div>
            <div class="text-subtitle-1">Processing</div>
            <div class="text-caption text-grey">Currently active</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card variant="outlined" class="text-center">
          <v-card-text>
            <div class="text-h4 text-error">
              {{ exportStore.exportStats.summary.failed }}
            </div>
            <div class="text-subtitle-1">Failed</div>
            <div class="text-caption text-grey">Needs attention</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Format Distribution Chart -->
    <v-row class="mb-6">
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Export Format Distribution</v-card-title>
          <v-card-text>
            <div
              v-if="Object.keys(exportStore.exportStats.byFormat).length > 0"
            >
              <div
                v-for="(count, format) in exportStore.exportStats.byFormat"
                :key="format"
                class="d-flex align-center justify-space-between mb-2"
              >
                <div class="d-flex align-center">
                  <v-icon
                    :color="getFormatColor(format)"
                    :icon="getFormatIcon(format)"
                    class="mr-2"
                  ></v-icon>
                  <span class="text-capitalize">{{ format }}</span>
                </div>
                <v-chip :color="getFormatColor(format)" variant="flat">
                  {{ count }}
                </v-chip>
              </div>
            </div>
            <div v-else class="text-center py-4">
              <v-icon size="48" color="grey-lighten-1">mdi-chart-pie</v-icon>
              <p class="text-grey mt-2">No export data available</p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Recent Activity</v-card-title>
          <v-card-text>
            <div v-if="exportStore.exportStats.recent.length > 0">
              <div
                v-for="exportRecord in exportStore.exportStats.recent.slice(
                  0,
                  5
                )"
                :key="exportRecord._id"
                class="d-flex align-center justify-space-between mb-2"
              >
                <div class="d-flex align-center">
                  <v-icon
                    :color="getFormatColor(exportRecord.format)"
                    :icon="getFormatIcon(exportRecord.format)"
                    size="small"
                    class="mr-2"
                  ></v-icon>
                  <div>
                    <div class="text-body-2">
                      {{ exportRecord.format.toUpperCase() }} Export
                    </div>
                    <div class="text-caption text-grey">
                      {{ formatDate(exportRecord.createdAt) }}
                    </div>
                  </div>
                </div>
                <v-chip
                  :color="getStatusColor(exportRecord.status)"
                  size="small"
                  variant="flat"
                >
                  {{ formatStatus(exportRecord.status) }}
                </v-chip>
              </div>
            </div>
            <div v-else class="text-center py-4">
              <v-icon size="48" color="grey-lighten-1">mdi-history</v-icon>
              <p class="text-grey mt-2">No recent exports</p>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Active Exports -->
    <v-card v-if="exportStore.activeExports.size > 0" class="mb-6">
      <v-card-title class="d-flex align-center">
        <v-icon left>mdi-progress-clock</v-icon>
        Active Exports
        <v-spacer></v-spacer>
        <v-chip color="warning" variant="flat">
          {{ exportStore.activeExports.size }} processing
        </v-chip>
      </v-card-title>
      <v-card-text>
        <v-list>
          <v-list-item
            v-for="[id, exportData] in exportStore.activeExports"
            :key="id"
            class="mb-2"
          >
            <template #prepend>
              <v-progress-circular
                :model-value="exportData.percentage || 0"
                size="24"
                color="primary"
                :indeterminate="!exportData.percentage"
              ></v-progress-circular>
            </template>

            <v-list-item-title>
              {{ exportData.format.toUpperCase() }} Export
            </v-list-item-title>

            <v-list-item-subtitle>
              <div class="d-flex align-center">
                <span>{{ exportData.progress }}</span>
                <v-progress-linear
                  v-if="exportData.status === 'processing'"
                  :model-value="exportData.percentage || 0"
                  color="primary"
                  class="ml-2"
                  style="max-width: 100px"
                  :indeterminate="!exportData.percentage"
                ></v-progress-linear>
                <span v-if="exportData.percentage" class="ml-2 text-caption">
                  {{ exportData.percentage }}%
                </span>
              </div>
            </v-list-item-subtitle>

            <template #append>
              <v-chip
                :color="getStatusColor(exportData.status)"
                size="small"
                variant="flat"
              >
                {{ formatStatus(exportData.status) }}
              </v-chip>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- Export History Table -->
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon left>mdi-history</v-icon>
        Export History
        <v-spacer></v-spacer>

        <!-- Filters -->
        <v-select
          v-model="filters.status"
          :items="statusFilterOptions"
          label="Status"
          clearable
          density="compact"
          class="mr-2"
          style="max-width: 150px"
          @update:model-value="applyFilters"
        ></v-select>

        <v-select
          v-model="filters.format"
          :items="formatFilterOptions"
          label="Format"
          clearable
          density="compact"
          class="mr-2"
          style="max-width: 150px"
          @update:model-value="applyFilters"
        ></v-select>

        <v-btn
          variant="outlined"
          size="small"
          @click="clearFilters"
          :disabled="!hasActiveFilters"
        >
          Clear Filters
        </v-btn>
      </v-card-title>

      <v-card-text>
        <div v-if="exportStore.loading" class="text-center py-8">
          <v-progress-circular
            indeterminate
            color="primary"
          ></v-progress-circular>
          <p class="text-grey mt-2">Loading export history...</p>
        </div>

        <div v-else-if="filteredExports.length === 0" class="text-center py-8">
          <v-icon size="64" color="grey-lighten-1">mdi-history</v-icon>
          <p class="text-grey mt-2">
            {{
              hasActiveFilters
                ? 'No exports match your filters'
                : 'No export history found'
            }}
          </p>
          <v-btn
            v-if="hasActiveFilters"
            variant="outlined"
            @click="clearFilters"
            class="mt-2"
          >
            Clear Filters
          </v-btn>
        </div>

        <div v-else>
          <v-data-table
            :headers="tableHeaders"
            :items="filteredExports"
            :items-per-page="10"
            class="elevation-1"
          >
            <template #item.format="{ item }">
              <div class="d-flex align-center">
                <v-icon
                  :color="getFormatColor(item.format)"
                  :icon="getFormatIcon(item.format)"
                  size="small"
                  class="mr-2"
                ></v-icon>
                <span class="text-capitalize">{{ item.format }}</span>
              </div>
            </template>

            <template #item.status="{ item }">
              <div class="d-flex align-center">
                <v-chip
                  :color="getStatusColor(item.status)"
                  size="small"
                  variant="flat"
                >
                  {{ formatStatus(item.status) }}
                </v-chip>
                <v-progress-circular
                  v-if="item.status === 'processing'"
                  indeterminate
                  size="16"
                  width="2"
                  color="primary"
                  class="ml-2"
                ></v-progress-circular>
                <v-icon
                  v-else-if="item.status === 'completed'"
                  color="success"
                  size="small"
                  class="ml-2"
                >
                  mdi-check-circle
                </v-icon>
                <v-icon
                  v-else-if="item.status === 'failed'"
                  color="error"
                  size="small"
                  class="ml-2"
                >
                  mdi-alert-circle
                </v-icon>
              </div>
            </template>

            <template #item.createdAt="{ item }">
              {{ formatDate(item.createdAt) }}
            </template>

            <template #item.completedAt="{ item }">
              {{ item.completedAt ? formatDate(item.completedAt) : '-' }}
            </template>

            <template #item.recordCount="{ item }">
              <span v-if="item.recordCount"
                >{{ item.recordCount }} records</span
              >
              <span v-else>-</span>
            </template>

            <template #item.actions="{ item }">
              <div class="d-flex gap-2">
                <v-btn
                  v-if="item.status === 'completed'"
                  size="small"
                  variant="outlined"
                  @click="downloadExport(item._id)"
                  :loading="downloading === item._id"
                >
                  <v-icon left size="small">mdi-download</v-icon>
                  Download
                </v-btn>

                <v-btn
                  v-if="item.status === 'failed'"
                  size="small"
                  variant="text"
                  @click="showError(item.error)"
                >
                  <v-icon left size="small">mdi-alert</v-icon>
                  Error
                </v-btn>

                <v-btn
                  v-if="item.status === 'completed'"
                  size="small"
                  variant="text"
                  @click="repeatExport(item)"
                >
                  <v-icon left size="small">mdi-refresh</v-icon>
                  Repeat
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </div>
      </v-card-text>
    </v-card>

    <!-- Export Dialog -->
    <export-dialog
      v-model="showExportDialog"
      @export-created="handleExportCreated"
    />

    <!-- Error Dialog -->
    <v-dialog v-model="showErrorDialog" max-width="500px">
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon color="error" class="mr-2">mdi-alert</v-icon>
          Export Error
        </v-card-title>
        <v-card-text>
          <p class="text-body-1">{{ errorMessage }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showErrorDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Cleanup Dialog -->
    <v-dialog v-model="showCleanupDialog" max-width="400px">
      <v-card>
        <v-card-title>Clean Up Old Exports</v-card-title>
        <v-card-text>
          <p>
            This will permanently delete exports older than the specified number
            of days.
          </p>
          <v-text-field
            v-model="cleanupDays"
            label="Days to keep"
            type="number"
            min="1"
            max="365"
            variant="outlined"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showCleanupDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="performCleanup" :loading="cleaning">
            Clean Up
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useExportStore } from '../stores/exportStore.js'
import ExportDialog from '../components/ExportDialog.vue'

const exportStore = useExportStore()

// State
const showExportDialog = ref(false)
const showErrorDialog = ref(false)
const showCleanupDialog = ref(false)
const errorMessage = ref('')
const downloading = ref(null)
const cleaning = ref(false)
const cleanupDays = ref(7)

const filters = reactive({
  status: '',
  format: ''
})

// Table headers
const tableHeaders = [
  { title: 'Format', key: 'format', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Created', key: 'createdAt', sortable: true },
  { title: 'Completed', key: 'completedAt', sortable: true },
  { title: 'Records', key: 'recordCount', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]

// Filter options
const statusFilterOptions = [
  { title: 'All Statuses', value: '' },
  { title: 'Pending', value: 'pending' },
  { title: 'Processing', value: 'processing' },
  { title: 'Completed', value: 'completed' },
  { title: 'Failed', value: 'failed' }
]

const formatFilterOptions = [
  { title: 'All Formats', value: '' },
  { title: 'CSV', value: 'csv' },
  { title: 'JSON', value: 'json' }
]

// Computed properties
const filteredExports = computed(() => {
  let filtered = exportStore.exports

  if (filters.status) {
    filtered = filtered.filter((exp) => exp.status === filters.status)
  }

  if (filters.format) {
    filtered = filtered.filter((exp) => exp.format === filters.format)
  }

  return filtered
})

const hasActiveFilters = computed(() => {
  return filters.status || filters.format
})

// Methods
function getStatusColor(status) {
  const colors = {
    pending: 'warning',
    processing: 'info',
    completed: 'success',
    failed: 'error'
  }
  return colors[status] || 'grey'
}

function formatStatus(status) {
  return status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function getFormatColor(format) {
  const colors = {
    csv: 'green',
    json: 'blue'
  }
  return colors[format] || 'grey'
}

function getFormatIcon(format) {
  const icons = {
    csv: 'mdi-file-delimited',
    json: 'mdi-code-json'
  }
  return icons[format] || 'mdi-file'
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString()
}

async function downloadExport(exportId) {
  downloading.value = exportId

  try {
    await exportStore.downloadExport(exportId)
  } catch (error) {
    console.error('Error downloading export:', error)
    errorMessage.value = error.message
    showErrorDialog.value = true
  } finally {
    downloading.value = null
  }
}

function showError(error) {
  errorMessage.value = error
  showErrorDialog.value = true
}

function repeatExport(exportRecord) {
  // Pre-fill the export dialog with the same filters and options
  showExportDialog.value = true
  // You could emit an event to pre-fill the export dialog
}

async function refreshData() {
  await exportStore.fetchExportHistory()
  await exportStore.fetchExportStats()
}

function applyFilters() {
  // Filters are applied automatically through computed property
}

function clearFilters() {
  filters.status = ''
  filters.format = ''
}

async function performCleanup() {
  cleaning.value = true

  try {
    await exportStore.cleanupExports(parseInt(cleanupDays.value))
    showCleanupDialog.value = false
    await refreshData()
  } catch (error) {
    console.error('Error cleaning up exports:', error)
    errorMessage.value = error.message
    showErrorDialog.value = true
  } finally {
    cleaning.value = false
  }
}

function handleExportCreated(exportRecord) {
  console.log('Export created:', exportRecord)
  
  // Show initial progress notification
  if (exportRecord.status === 'pending' || exportRecord.status === 'processing') {
    // The snackbar will be shown by the App component via socket events
    console.log('Export started:', exportRecord._id)
  }
  
  // Refresh data to show the new export
  refreshData()
}

function testSnackbar() {
  console.log('🧪 Testing snackbar...')
  // Dispatch a test event
  const event = new CustomEvent('export-progress-update', {
    detail: { status: 'processing', message: 'Test export processing...', exportId: 'test-123' }
  })
  window.dispatchEvent(event)
}

// Lifecycle
onMounted(() => {
  refreshData()
  exportStore.initializeSocketListeners()
})

onUnmounted(() => {
  exportStore.removeSocketListeners()
})
</script>

<style scoped>
.gap-2 {
  gap: 0.5rem;
}
</style>
