<!--
/**
 * @fileoverview Export dialog component for task data export functionality
 * @component ExportDialog
 * @description Modal dialog for creating and managing task exports with format selection and filtering
 * @emits {Object} export-created - Emitted when a new export is created
 */
-->

<template>
  <v-dialog v-model="showDialog" max-width="600px" persistent>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon left>mdi-download</v-icon>
        Export Tasks
        <v-spacer></v-spacer>
        <v-btn icon @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-form ref="form" v-model="valid">
          <!-- Export Format Selection -->
          <v-card class="mb-4" variant="outlined">
            <v-card-title class="text-subtitle-1">Export Format</v-card-title>
            <v-card-text>
              <v-radio-group v-model="exportForm.format" mandatory>
                <v-radio
                  value="csv"
                  label="CSV (Comma Separated Values)"
                  hint="Best for spreadsheet applications like Excel"
                ></v-radio>
                <v-radio
                  value="json"
                  label="JSON (JavaScript Object Notation)"
                  hint="Best for data processing and APIs"
                ></v-radio>
              </v-radio-group>
            </v-card-text>
          </v-card>

          <!-- Current Query Information -->
          <v-card class="mb-4" variant="outlined">
            <v-card-title class="text-subtitle-1">
              <v-icon left>mdi-filter-variant</v-icon>
              Current Query Filters
            </v-card-title>
            <v-card-text>
              <div v-if="currentQueryInfo" class="query-info">
                <v-alert
                  :type="currentQueryInfo.type"
                  variant="tonal"
                  class="mb-3"
                >
                  <template #prepend>
                    <v-icon>{{ currentQueryInfo.icon }}</v-icon>
                  </template>
                  <div>
                    <strong>{{ currentQueryInfo.title }}</strong>
                    <div
                      v-if="currentQueryInfo.description"
                      class="text-caption mt-1"
                    >
                      {{ currentQueryInfo.description }}
                    </div>
                  </div>
                </v-alert>

                <div v-if="currentQueryInfo.filters" class="filter-summary">
                  <div class="text-subtitle-2 mb-2">Active Filters:</div>
                  <v-chip-group>
                    <v-chip
                      v-for="(value, key) in currentQueryInfo.filters"
                      :key="key"
                      size="small"
                      variant="outlined"
                      color="primary"
                    >
                      {{ key }}: {{ formatFilterValue(value) }}
                    </v-chip>
                  </v-chip-group>
                </div>
              </div>

              <div v-else class="text-center py-4">
                <v-icon size="48" color="grey-lighten-1">mdi-filter-off</v-icon>
                <p class="text-grey mt-2">
                  No active filters - all tasks will be exported
                </p>
              </div>
            </v-card-text>
          </v-card>

          <!-- Export Options -->
          <v-card class="mb-4" variant="outlined">
            <v-card-title class="text-subtitle-1">Export Options</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="exportForm.options.sortBy"
                    :items="sortOptions"
                    label="Sort By"
                  ></v-select>
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="exportForm.options.sortOrder"
                    :items="orderOptions"
                    label="Sort Order"
                  ></v-select>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Export Preview -->
          <v-card v-if="previewCount !== null" variant="outlined">
            <v-card-title class="text-subtitle-1">Export Preview</v-card-title>
            <v-card-text>
              <v-alert
                :type="previewCount > 0 ? 'info' : 'warning'"
                variant="tonal"
              >
                <template #prepend>
                  <v-icon>
                    {{ previewCount > 0 ? 'mdi-information' : 'mdi-alert' }}
                  </v-icon>
                </template>
                <div>
                  <strong>{{ previewCount }}</strong> tasks will be exported
                  <div v-if="previewCount === 0" class="text-caption mt-1">
                    No tasks match the current filters. Try adjusting your
                    criteria in the Advanced Query Builder.
                  </div>
                </div>
              </v-alert>
            </v-card-text>
          </v-card>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="closeDialog" :disabled="exportStore.loading">
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          @click="createExport"
          :loading="exportStore.loading"
          :disabled="!valid || previewCount === 0"
        >
          <v-icon left>mdi-download</v-icon>
          Export Tasks
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useExportStore } from '../stores/exportStore.js'
import { useTaskStore } from '../stores/taskStore.js'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'export-created'])

const exportStore = useExportStore()
const taskStore = useTaskStore()

const form = ref(null)
const valid = ref(true)
const previewCount = ref(null)

const showDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const exportForm = reactive({
  format: 'csv',
  options: {
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }
})

const sortOptions = [
  { title: 'Created Date', value: 'createdAt' },
  { title: 'Updated Date', value: 'updatedAt' },
  { title: 'Title', value: 'title' },
  { title: 'Status', value: 'status' },
  { title: 'Priority', value: 'priority' },
  { title: 'Estimated Time', value: 'estimatedTime' },
  { title: 'Actual Time', value: 'actualTime' }
]

const orderOptions = [
  { title: 'Ascending', value: 'asc' },
  { title: 'Descending', value: 'desc' }
]

// Computed property to get current query information
const currentQueryInfo = computed(() => {
  if (taskStore.queryMode === 'basic') {
    const hasBasicFilters =
      taskStore.filters.status || taskStore.filters.priority
    if (!hasBasicFilters) return null

    return {
      type: 'info',
      icon: 'mdi-filter',
      title: 'Basic Filters',
      description: 'Using basic status and priority filters',
      filters: {
        ...(taskStore.filters.status && { status: taskStore.filters.status }),
        ...(taskStore.filters.priority && {
          priority: taskStore.filters.priority
        })
      }
    }
  }

  if (taskStore.queryMode === 'search') {
    return {
      type: 'info',
      icon: 'mdi-magnify',
      title: 'Text Search',
      description: `Searching for "${taskStore.searchQuery}"`,
      filters: {
        search: taskStore.searchQuery
      }
    }
  }

  if (taskStore.queryMode === 'advanced' && taskStore.advancedQuery.filters) {
    const filters = taskStore.advancedQuery.filters
    const activeFilters = {}

    // Extract active filters
    Object.keys(filters).forEach((key) => {
      const value = filters[key]
      if (
        value &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0) &&
        !(
          typeof value === 'object' &&
          value !== null &&
          Object.keys(value).every((k) => !value[k])
        )
      ) {
        activeFilters[key] = value
      }
    })

    if (Object.keys(activeFilters).length === 0) return null

    return {
      type: 'success',
      icon: 'mdi-filter-variant',
      title: 'Advanced Query Builder',
      description: 'Using complex filters from Advanced Query Builder',
      filters: activeFilters
    }
  }

  return null
})

// Get current filters based on task store state
function getCurrentFilters() {
  if (taskStore.queryMode === 'basic') {
    const filters = {}
    if (taskStore.filters.status) filters.status = [taskStore.filters.status]
    if (taskStore.filters.priority)
      filters.priority = [taskStore.filters.priority]
    return filters
  }

  if (taskStore.queryMode === 'search') {
    return { search: taskStore.searchQuery }
  }

  if (taskStore.queryMode === 'advanced' && taskStore.advancedQuery.filters) {
    return { ...taskStore.advancedQuery.filters }
  }

  return {}
}

// Get current options based on task store state
function getCurrentOptions() {
  if (taskStore.queryMode === 'advanced' && taskStore.advancedQuery.options) {
    return { ...taskStore.advancedQuery.options }
  }

  return {
    sortBy: taskStore.filters.sortBy || 'createdAt',
    sortOrder: taskStore.filters.sortOrder || 'desc'
  }
}

function formatFilterValue(value) {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'object' && value !== null) {
    if (value.start && value.end) {
      return `${value.start} to ${value.end}`
    }
    if (value.min && value.max) {
      return `${value.min}-${value.max}`
    }
    if (value.min) return `≥ ${value.min}`
    if (value.max) return `≤ ${value.max}`
    return JSON.stringify(value)
  }
  return String(value)
}

async function createExport() {
  if (!form.value.validate()) return

  try {
    // Get current filters and options
    const currentFilters = getCurrentFilters()
    const currentOptions = getCurrentOptions()

    // Merge with export form options
    const finalOptions = {
      ...currentOptions,
      ...exportForm.options
    }

    // Clean up empty filters
    const cleanFilters = { ...currentFilters }
    Object.keys(cleanFilters).forEach((key) => {
      if (
        !cleanFilters[key] ||
        (Array.isArray(cleanFilters[key]) && cleanFilters[key].length === 0)
      ) {
        delete cleanFilters[key]
      }
    })

    // Close dialog immediately to show async behavior
    closeDialog()

    // Create export (this will be handled asynchronously)
    const exportRecord = await exportStore.createExport({
      format: exportForm.format,
      filters: cleanFilters,
      options: finalOptions
    })

    emit('export-created', exportRecord)
  } catch (error) {
    console.error('Error creating export:', error)
    // Reopen dialog if there was an error
    showDialog.value = true
  }
}

function closeDialog() {
  showDialog.value = false
  // Reset form
  exportForm.format = 'csv'
  exportForm.options = {
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }
  previewCount.value = null
}

// Watch for task store changes to update preview count
watch(
  () => [
    taskStore.queryMode,
    taskStore.filters,
    taskStore.searchQuery,
    taskStore.advancedQuery
  ],
  async () => {
    // Debounce preview count updates
    clearTimeout(previewCount.value)
    setTimeout(async () => {
      try {
        const currentFilters = getCurrentFilters()
        const cleanFilters = { ...currentFilters }

        Object.keys(cleanFilters).forEach((key) => {
          if (
            !cleanFilters[key] ||
            (Array.isArray(cleanFilters[key]) && cleanFilters[key].length === 0)
          ) {
            delete cleanFilters[key]
          }
        })

        const response = await taskStore.fetchTaskStats(cleanFilters)
        previewCount.value = response.total || 0
      } catch (error) {
        console.error('Error getting preview count:', error)
        previewCount.value = 0
      }
    }, 500)
  },
  { deep: true }
)

onMounted(() => {
  // Initialize with current task count
  previewCount.value = taskStore.pagination.total
})
</script>

<style scoped>
.v-card-title {
  font-size: 1.1rem;
  font-weight: 500;
}

.query-info {
  .filter-summary {
    margin-top: 1rem;
  }
}
</style>
