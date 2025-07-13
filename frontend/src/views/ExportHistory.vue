<template>
  <div class="export-history">
    <div class="d-flex justify-space-between align-center mb-6">
      <h1 class="text-h4 text-primary">Export History</h1>
      <v-btn
        :loading="loading"
        color="primary"
        variant="outlined"
        prepend-icon="mdi-refresh"
        @click="refreshHistory"
      >
        Refresh
      </v-btn>
    </div>

    <!-- Stats Cards -->
    <v-row class="mb-6">
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-4">
          <div class="d-flex align-center">
            <v-icon color="primary" size="40" class="mr-4">mdi-download</v-icon>
            <div>
              <div class="text-h4 font-weight-bold">{{ stats.total }}</div>
              <div class="text-body-2 text-medium-emphasis">Total Exports</div>
            </div>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-4">
          <div class="d-flex align-center">
            <v-icon color="success" size="40" class="mr-4"
              >mdi-check-circle</v-icon
            >
            <div>
              <div class="text-h4 font-weight-bold text-success">
                {{ stats.completed }}
              </div>
              <div class="text-body-2 text-medium-emphasis">Completed</div>
            </div>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-4">
          <div class="d-flex align-center">
            <v-icon color="error" size="40" class="mr-4"
              >mdi-alert-circle</v-icon
            >
            <div>
              <div class="text-h4 font-weight-bold text-error">
                {{ stats.failed }}
              </div>
              <div class="text-body-2 text-medium-emphasis">Failed</div>
            </div>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-4">
          <div class="d-flex align-center">
            <v-icon color="warning" size="40" class="mr-4"
              >mdi-clock-outline</v-icon
            >
            <div>
              <div class="text-h4 font-weight-bold text-warning">
                {{ stats.pending }}
              </div>
              <div class="text-body-2 text-medium-emphasis">Pending</div>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Filters -->
    <v-card class="mb-6">
      <v-card-title>Filters</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="filters.status"
              :items="statusOptions"
              label="Status"
              clearable
              multiple
              chips
              closable-chips
            ></v-select>
          </v-col>

          <v-col cols="12" md="6">
            <v-select
              v-model="filters.sortOrder"
              :items="sortOrderOptions"
              label="Sort Order"
            ></v-select>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Export History Table -->
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>Export History</span>
        <div class="d-flex align-center">
          <span class="text-body-2 mr-4">
            {{ pagination.total }} total exports
          </span>
          <v-select
            v-model="pagination.limit"
            :items="[10, 25, 50, 100]"
            label="Per page"
            density="compact"
            style="max-width: 100px"
            variant="outlined"
            hide-details
          ></v-select>
        </div>
      </v-card-title>

      <v-data-table-server
        v-model:items-per-page="pagination.limit"
        v-model:page="pagination.page"
        :headers="headers"
        :items="exports"
        :items-length="pagination.total"
        :loading="loading"
        loading-text="Loading export history..."
        no-data-text="No exports found"
        @update:options="handleTableUpdate"
      >
        <template #item.filename="{ item }">
          <div class="d-flex align-center">
            <v-icon :color="getFormatColor(item.format)" class="mr-2">
              {{ getFormatIcon(item.format) }}
            </v-icon>
            <span class="font-weight-medium">{{ item.filename }}</span>
          </div>
        </template>

        <template #item.status="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            :variant="item.status === 'completed' ? 'flat' : 'outlined'"
            size="small"
            :prepend-icon="getStatusIcon(item.status)"
          >
            {{ item.status }}
          </v-chip>
        </template>

        <template #item.queryParameters="{ item }">
          <div v-if="item.queryParameters && Object.keys(item.queryParameters).length > 0">
            <v-tooltip>
              <template #activator="{ props }">
                <v-chip
                  v-bind="props"
                  size="small"
                  variant="outlined"
                  color="primary"
                >
                  {{ formatQuerySummary(item.queryParameters) }}
                </v-chip>
              </template>
              <div class="pa-2">
                <div class="text-caption font-weight-bold mb-2">Query Parameters:</div>
                <div v-for="(value, key) in item.queryParameters" :key="key" class="text-caption">
                  <strong>{{ key }}:</strong> {{ formatQueryValue(value) }}
                </div>
              </div>
            </v-tooltip>
          </div>
          <span v-else class="text-medium-emphasis">All data</span>
        </template>

        <template #item.totalRecords="{ item }">
          <span v-if="typeof item.totalRecords === 'number'" class="font-weight-medium">{{
            item.totalRecords.toLocaleString()
          }}</span>
          <span v-else class="text-medium-emphasis">-</span>
        </template>

        <template #item.fileSizeBytes="{ item }">
          <span v-if="item.fileSizeBytes">{{
            formatFileSize(item.fileSizeBytes)
          }}</span>
          <span v-else class="text-medium-emphasis">-</span>
        </template>

        <template #item.executionTimeMs="{ item }">
          <span v-if="item.executionTimeMs">{{
            formatDuration(item.executionTimeMs)
          }}</span>
          <span v-else class="text-medium-emphasis">-</span>
        </template>

        <template #item.createdAt="{ item }">
          <div>
            <div>{{ formatDate(item.createdAt) }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ formatTime(item.createdAt) }}
            </div>
          </div>
        </template>

        <template #item.errorMessage="{ item }">
          <div v-if="item.errorMessage">
            <v-tooltip :text="item.errorMessage">
              <template #activator="{ props }">
                <v-icon v-bind="props" color="error" size="small">
                  mdi-alert-circle-outline
                </v-icon>
              </template>
            </v-tooltip>
          </div>
          <span v-else class="text-medium-emphasis">-</span>
        </template>

        <template #item.actions="{ item }">
          <v-btn
            v-if="item.status === 'completed'"
            :loading="downloadingFiles.has(item.filename)"
            color="primary"
            variant="outlined"
            size="small"
            icon="mdi-download"
            @click="downloadExport(item.filename)"
          >
            <v-icon>mdi-download</v-icon>
            <v-tooltip activator="parent" text="Download export file" />
          </v-btn>
          <span v-else class="text-medium-emphasis">-</span>
        </template>
      </v-data-table-server>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import apiClient from '../api/client.js'
import { downloadExportFile } from '../utils/download.js'

const loading = ref(false)
const exports = ref([])
const isMounted = ref(false)
const downloadingFiles = ref(new Set())
const pagination = ref({
  page: 1,
  limit: 25,
  total: 0,
  pages: 0
})

const filters = ref({
  status: [],
  sortOrder: 'desc'
})

const statusOptions = [
  { title: 'Pending', value: 'pending' },
  { title: 'Completed', value: 'completed' },
  { title: 'Failed', value: 'failed' }
]


const sortOrderOptions = [
  { title: 'Newest First', value: 'desc' },
  { title: 'Oldest First', value: 'asc' }
]

const headers = [
  { title: 'Filename', key: 'filename', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Query', key: 'queryParameters', sortable: false, width: '150px' },
  { title: 'Records', key: 'totalRecords', sortable: false },
  { title: 'Size', key: 'fileSizeBytes', sortable: false },
  { title: 'Duration', key: 'executionTimeMs', sortable: false },
  { title: 'Created', key: 'createdAt', sortable: false },
  { title: 'Error', key: 'errorMessage', sortable: false, width: '80px' },
  { title: 'Actions', key: 'actions', sortable: false, width: '100px' }
]

const stats = computed(() => {
  if (!exports.value || !Array.isArray(exports.value)) {
    return { total: 0, completed: 0, failed: 0, pending: 0 }
  }
  
  const total = exports.value.length
  const completed = exports.value.filter(
    (exp) => exp.status === 'completed'
  ).length
  const failed = exports.value.filter((exp) => exp.status === 'failed').length
  const pending = exports.value.filter((exp) => exp.status === 'pending').length

  return { total, completed, failed, pending }
})

// Watch filters for changes
const stopFiltersWatch = watch(
  filters,
  () => {
    pagination.value.page = 1
    fetchExportHistory()
  },
  { deep: true }
)

const stopLimitWatch = watch(
  () => pagination.value.limit,
  () => {
    pagination.value.page = 1
    fetchExportHistory()
  }
)

async function fetchExportHistory() {
  if (!isMounted.value) return
  
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      limit: pagination.value.limit,
      sortBy: 'createdAt',
      sortOrder: filters.value.sortOrder
    }

    // Add status filter if it has values
    if (filters.value.status?.length > 0) {
      params.status = filters.value.status
    }

    const response = await apiClient.getExportHistory(params)
    
    // Only update if component is still mounted
    if (isMounted.value) {
      exports.value = response.data.exports
      pagination.value = {
        ...pagination.value,
        ...response.data.pagination
      }
    }
  } catch (error) {
    if (isMounted.value) {
      console.error('Failed to fetch export history:', error)
    }
  } finally {
    if (isMounted.value) {
      loading.value = false
    }
  }
}

function handleTableUpdate(options) {
  pagination.value.page = options.page
  fetchExportHistory()
}

function refreshHistory() {
  fetchExportHistory()
}

function getStatusColor(status) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'pending':
      return 'warning'
    default:
      return 'grey'
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'completed':
      return 'mdi-check-circle'
    case 'failed':
      return 'mdi-alert-circle'
    case 'pending':
      return 'mdi-clock-outline'
    default:
      return 'mdi-help-circle'
  }
}

function getFormatColor(format) {
  switch (format) {
    case 'csv':
      return 'green'
    case 'json':
      return 'blue'
    default:
      return 'grey'
  }
}

function getFormatIcon(format) {
  switch (format) {
    case 'csv':
      return 'mdi-file-table-outline'
    case 'json':
      return 'mdi-code-json'
    default:
      return 'mdi-file-outline'
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString()
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString()
}

function formatQuerySummary(queryParams) {
  const keys = Object.keys(queryParams).filter(key => queryParams[key] !== undefined && queryParams[key] !== null && queryParams[key] !== '');
  if (keys.length === 0) return 'All data';
  if (keys.length === 1) return keys[0];
  return `${keys.length} filters`;
}

function formatQueryValue(value) {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

async function downloadExport(filename) {
  try {
    downloadingFiles.value.add(filename)
    await downloadExportFile(filename, apiClient.downloadExport.bind(apiClient))
    console.log(`Successfully downloaded: ${filename}`)
  } catch (error) {
    console.error('Download failed:', error)
    // Could add a notification system here if available
    alert(`Download failed: ${error.message}`)
  } finally {
    downloadingFiles.value.delete(filename)
  }
}

onMounted(() => {
  isMounted.value = true
  fetchExportHistory()
})

onUnmounted(() => {
  isMounted.value = false
  // Stop watchers to prevent interference with other components
  stopFiltersWatch()
  stopLimitWatch()
})
</script>

<style scoped>
.export-history {
  max-width: 100%;
}

.v-data-table {
  border-radius: 8px;
}

.v-chip {
  text-transform: capitalize;
}
</style>
