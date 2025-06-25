<!--
/**
 * @fileoverview Task management component with CRUD operations, filtering, and pagination
 * @component TaskList
 * @description Comprehensive task list interface with create, edit, delete, filter, and sort capabilities
 * @emits {Object} task-created - Emitted when a new task is created
 * @emits {Object} task-updated - Emitted when a task is updated
 * @emits {String} task-deleted - Emitted when a task is deleted
 */
-->

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h2 class="page-title">Tasks</h2>
      <v-spacer></v-spacer>
      <v-btn color="primary" @click="showCreateDialog = true">
        <v-icon left>mdi-plus</v-icon>
        New Task
      </v-btn>
      <template v-if="enableExport">
        <div class="ml-2"></div>
        <v-menu>
          <template #activator="{ props }">
            <v-btn color="primary" v-bind="props">
              <v-icon left>mdi-download</v-icon>
              Export Tasks
            </v-btn>
          </template>
          <v-list>
            <v-list-item @click="exportTasks('csv')">
              <v-list-item-title>CSV Format</v-list-item-title>
            </v-list-item>
            <v-list-item @click="exportTasks('json')">
              <v-list-item-title>JSON Format</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </div>

    <v-card class="mb-4">
      <v-card-text>
        <v-row>
          <!-- Basic filters -->
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.status"
              :items="statusOptions"
              label="Status"
              clearable
              @update:model-value="updateFilters"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.priority"
              :items="priorityOptions"
              label="Priority"
              clearable
              @update:model-value="updateFilters"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.sortBy"
              :items="sortOptions"
              label="Sort by"
              @update:model-value="updateFilters"
            ></v-select>
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filters.sortOrder"
              :items="orderOptions"
              label="Order"
              @update:model-value="updateFilters"
            ></v-select>
          </v-col>
        </v-row>

        <!-- Advanced filters toggle -->
        <v-row>
          <v-col cols="12">
            <v-btn
              variant="text"
              color="primary"
              class="px-0"
              @click="showAdvancedFilters = !showAdvancedFilters"
            >
              <v-icon
                :icon="
                  showAdvancedFilters ? 'mdi-chevron-up' : 'mdi-chevron-down'
                "
                class="mr-1"
              ></v-icon>
              {{
                showAdvancedFilters
                  ? 'Hide Advanced Filters'
                  : 'Show Advanced Filters'
              }}
            </v-btn>
          </v-col>
        </v-row>

        <!-- Advanced filters -->
        <v-expand-transition>
          <div v-if="showAdvancedFilters">
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="filters.search"
                  label="Search in title/description"
                  clearable
                  hide-details
                  prepend-inner-icon="mdi-magnify"
                  @update:model-value="updateFilters"
                ></v-text-field>
              </v-col>

              <v-col cols="12" md="6">
                <v-select
                  v-model="filters.estimatedTimeRange"
                  :items="timeRangeOptions"
                  label="Estimated Time"
                  clearable
                  hide-details
                  @update:model-value="updateFilters"
                ></v-select>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="filters.createdAfter"
                  label="Created after"
                  type="date"
                  clearable
                  hide-details
                  @update:model-value="updateFilters"
                ></v-text-field>
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="filters.createdBefore"
                  label="Created before"
                  type="date"
                  clearable
                  hide-details
                  @update:model-value="updateFilters"
                ></v-text-field>
              </v-col>
            </v-row>

            <v-row v-if="filters.status === 'completed'">
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="filters.completedAfter"
                  label="Completed after"
                  type="date"
                  clearable
                  hide-details
                  @update:model-value="updateFilters"
                ></v-text-field>
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="filters.completedBefore"
                  label="Completed before"
                  type="date"
                  clearable
                  hide-details
                  @update:model-value="updateFilters"
                ></v-text-field>
              </v-col>
            </v-row>
          </div>
        </v-expand-transition>
      </v-card-text>
    </v-card>

    <div v-if="taskStore.loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <div v-else-if="taskStore.error" class="text-center py-8">
      <v-alert type="error">{{ taskStore.error }}</v-alert>
    </div>

    <div v-else-if="taskStore.tasks.length === 0" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-1">mdi-format-list-checks</v-icon>
      <p class="text-grey mt-2">No tasks found</p>
    </div>

    <div v-else>
      <v-card
        v-for="task in taskStore.tasks"
        :key="task._id"
        class="task-item mb-3"
        @click="editTask(task)"
      >
        <v-card-text>
          <div class="d-flex align-start">
            <div class="flex-grow-1">
              <h3 class="task-title">{{ task.title }}</h3>
              <p v-if="task.description" class="text-body-2 mb-2">
                {{ task.description }}
              </p>
              <div class="task-meta">
                <v-chip
                  :color="getStatusColor(task.status)"
                  size="small"
                  variant="flat"
                >
                  {{ formatStatus(task.status) }}
                </v-chip>
                <v-chip
                  :color="getPriorityColor(task.priority)"
                  size="small"
                  variant="outlined"
                >
                  {{ formatPriority(task.priority) }}
                </v-chip>
                <span class="text-caption">
                  Created {{ formatDate(task.createdAt) }}
                </span>
                <span v-if="task.completedAt" class="text-caption">
                  Completed {{ formatDate(task.completedAt) }}
                </span>
              </div>
            </div>
            <v-menu>
              <template #activator="{ props }">
                <v-btn icon size="small" v-bind="props" @click.stop>
                  <v-icon>mdi-dots-vertical</v-icon>
                </v-btn>
              </template>
              <v-list>
                <v-list-item @click="editTask(task)">
                  <v-list-item-title>Edit</v-list-item-title>
                </v-list-item>
                <v-list-item @click="deleteTask(task)">
                  <v-list-item-title>Delete</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </v-card-text>
      </v-card>

      <div class="text-center mt-4">
        <v-pagination
          v-model="taskStore.pagination.page"
          :length="taskStore.pagination.pages"
          @update:model-value="taskStore.setPage"
        ></v-pagination>
      </div>
    </div>

    <task-form-dialog v-model="showCreateDialog" @save="handleSave" />

    <task-form-dialog
      v-model="showEditDialog"
      :task="selectedTask"
      @save="handleSave"
    />

    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title>Delete Task</v-card-title>
        <v-card-text>
          Are you sure you want to delete "{{ selectedTask?.title }}"?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Export Progress Bar -->
    <export-progress-bar
      @download="handleDownloadExport"
      @pause="handlePauseExport"
      @resume="handleResumeExport"
      @cancel="handleCancelExport"
      @close="closeExportProgress"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, defineProps } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import { useExportStore } from '../stores/exportStore.js'
import TaskFormDialog from './TaskFormDialog.vue'
import ExportProgressBar from './ExportProgressBar.vue'

const props = defineProps({
  enableExport: {
    type: Boolean,
    default: false
  }
})

const taskStore = useTaskStore()
const exportStore = useExportStore()

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const selectedTask = ref(null)
const showAdvancedFilters = ref(false)

// Use local filter state synced with the store
const filters = reactive({
  // Basic filters
  status: '',
  priority: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',

  // Advanced filters
  search: '',
  createdAfter: '',
  createdBefore: '',
  completedAfter: '',
  completedBefore: '',
  estimatedTimeRange: null // This will be transformed to estimatedTimeLt/estimatedTimeGte
})

const statusOptions = [
  { title: 'Pending', value: 'pending' },
  { title: 'In Progress', value: 'in-progress' },
  { title: 'Completed', value: 'completed' }
]

const priorityOptions = [
  { title: 'Low', value: 'low' },
  { title: 'Medium', value: 'medium' },
  { title: 'High', value: 'high' }
]

const sortOptions = [
  { title: 'Created Date', value: 'createdAt' },
  { title: 'Updated Date', value: 'updatedAt' },
  { title: 'Title', value: 'title' },
  { title: 'Priority', value: 'priority' },
  { title: 'Status', value: 'status' }
]

const orderOptions = [
  { title: 'Newest First', value: 'desc' },
  { title: 'Oldest First', value: 'asc' }
]

const timeRangeOptions = [
  { title: 'Less than 30 minutes', value: 'lt30' },
  { title: '30-60 minutes', value: '30to60' },
  { title: '1-2 hours', value: '60to120' },
  { title: '2-4 hours', value: '120to240' },
  { title: 'More than 4 hours', value: 'gt240' }
]

function updateFilters() {
  taskStore.updateFilters(filters)
}

// Transform filters into API-compatible format for export
function transformFiltersForExport() {
  const transformed = { ...filters }

  // Convert date strings to ISO format
  if (filters.createdAfter) {
    transformed.createdAfter = new Date(filters.createdAfter).toISOString()
  }

  if (filters.createdBefore) {
    transformed.createdBefore = new Date(
      `${filters.createdBefore}T23:59:59`
    ).toISOString()
  }

  if (filters.completedAfter) {
    transformed.completedAfter = new Date(filters.completedAfter).toISOString()
  }

  if (filters.completedBefore) {
    transformed.completedBefore = new Date(
      `${filters.completedBefore}T23:59:59`
    ).toISOString()
  }

  // Handle estimated time range transformation
  if (filters.estimatedTimeRange) {
    // Remove the range property since it's just for UI
    delete transformed.estimatedTimeRange

    // Add the appropriate time range filters
    switch (filters.estimatedTimeRange) {
      case 'lt30':
        transformed.estimatedTimeLt = 30
        break
      case '30to60':
        transformed.estimatedTimeGte = 30
        transformed.estimatedTimeLt = 60
        break
      case '60to120':
        transformed.estimatedTimeGte = 60
        transformed.estimatedTimeLt = 120
        break
      case '120to240':
        transformed.estimatedTimeGte = 120
        transformed.estimatedTimeLt = 240
        break
      case 'gt240':
        transformed.estimatedTimeGte = 240
        break
    }
  }

  // Remove any empty filters
  Object.keys(transformed).forEach((key) => {
    if (transformed[key] === '' || transformed[key] === null) {
      delete transformed[key]
    }
  })

  return transformed
}

function editTask(task) {
  selectedTask.value = task
  showEditDialog.value = true
}

function deleteTask(task) {
  selectedTask.value = task
  showDeleteDialog.value = true
}

async function handleSave() {
  showCreateDialog.value = false
  showEditDialog.value = false
  selectedTask.value = null
  await taskStore.fetchTasks()
}

async function confirmDelete() {
  if (selectedTask.value) {
    await taskStore.deleteTask(selectedTask.value._id)
    showDeleteDialog.value = false
    selectedTask.value = null
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'in-progress':
      return 'info'
    case 'completed':
      return 'success'
    default:
      return 'grey'
  }
}

function getPriorityColor(priority) {
  switch (priority) {
    case 'low':
      return 'success'
    case 'medium':
      return 'warning'
    case 'high':
      return 'error'
    default:
      return 'grey'
  }
}

function formatStatus(status) {
  return status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function formatPriority(priority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

function formatDate(date) {
  return new Date(date).toLocaleDateString()
}

async function exportTasks(format) {
  try {
    // Use the filter transformation for export
    const cleanedFilters = transformFiltersForExport()

    // Use transformed and cleaned filters
    await exportStore.exportTasks(format, cleanedFilters)

    // No need to show alert, progress bar will appear automatically
  } catch (error) {
    console.error('Export failed to start:', error)
    window.alert(`Export failed to start: ${error.message}`)
  }
}

function handleDownloadExport(jobId) {
  console.log('TaskList download handler for job:', jobId)
  
  // Use the direct store method like in the audit page
  exportStore.downloadExport(jobId)
  
  // Reset active status (but keep details visible for a while)
  window.setTimeout(() => {
    exportStore.exportProgress.active = false
  }, 3000)
}

function handlePauseExport(jobId) {
  exportStore.pauseExport(jobId)
}

function handleResumeExport(jobId) {
  exportStore.resumeExport(jobId)
}

function handleCancelExport(jobId) {
  exportStore.cancelExport(jobId)
}

function closeExportProgress() {
  exportStore.exportProgress.active = false
}

onMounted(() => {
  taskStore.fetchTasks()
})
</script>
