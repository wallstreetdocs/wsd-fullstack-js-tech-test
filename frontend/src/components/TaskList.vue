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
      <v-btn class="ml-2" color="secondary" @click="exportTasks('csv')">
        <v-icon left>mdi-download</v-icon>
        Export CSV
      </v-btn>
      <v-btn class="ml-2" color="secondary" @click="exportTasks('json')">
        <v-icon left>mdi-code-json</v-icon>
        Export JSON
      </v-btn>
      <!-- Export History Button -->
      <v-btn class="ml-2" color="info" @click="showExportHistory = true">
        <v-icon left>mdi-history</v-icon>
        Export History
      </v-btn>
    </div>

    <v-card class="mb-4">
      <v-card-text>
        <!-- Active Filter Chips -->
        <div v-if="activeFilterChips.length" class="mb-2">
          <v-chip v-for="chip in activeFilterChips" :key="chip.key" closable @click:close="clearFilter(chip.key)"
            class="mr-2">
            {{ chip.label }}
          </v-chip>
          <v-btn text small @click="clearAllFilters">Clear All</v-btn>
        </div>
        <v-row>
          <v-col cols="12" md="2">
            <v-select v-model="filters.status" :items="statusOptions" label="Status" clearable
              @update:model-value="updateFilters"></v-select>
          </v-col>
          <v-col cols="12" md="2">
            <v-select v-model="filters.priority" :items="priorityOptions" label="Priority" clearable
              @update:model-value="updateFilters"></v-select>
          </v-col>
          <v-col cols="12" md="2">
            <v-select v-model="filters.sortBy" :items="sortOptions" label="Sort by"
              @update:model-value="updateFilters"></v-select>
          </v-col>
          <v-col cols="12" md="2">
            <v-select v-model="filters.sortOrder" :items="orderOptions" label="Order"
              @update:model-value="updateFilters"></v-select>
          </v-col>
        </v-row>
        <!-- Advanced Filters Toggle -->
        <v-btn text small @click="showAdvanced = !showAdvanced">
          {{ showAdvanced ? 'Hide' : 'Show' }} Advanced Filters
        </v-btn>
        <v-expand-transition>
          <div v-show="showAdvanced">
            <v-row class="mt-2">
              <v-col cols="12" md="4">
                <v-text-field v-model="filters.keyword" label="Keyword" clearable
                  @update:model-value="updateFilters"></v-text-field>
              </v-col>
              <!-- Add more advanced filters here -->
              <!-- Date Range Picker -->
              <v-col cols="12" sm="6" md="4">
                <v-menu v-model="dateMenu" :close-on-content-click="false" transition="scale-transition" offset-y
                  min-width="auto">
                  <template #activator="{ props }">
                    <v-text-field v-model="dateRangeText" label="Created Date Range" prepend-icon="mdi-calendar"
                      readonly v-bind="props"></v-text-field>
                  </template>
                  <v-date-picker v-model="filters.dateRange" show-adjacent-months color="pink-accent-4" multiple="true"
                    @update:model-value="onDateRangeChange"></v-date-picker>
                </v-menu>
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
      <v-card v-for="task in taskStore.tasks" :key="task._id" class="task-item mb-3" @click="editTask(task)">
        <v-card-text>
          <div class="d-flex align-start">
            <div class="flex-grow-1">
              <h3 class="task-title">{{ task.title }}</h3>
              <p v-if="task.description" class="text-body-2 mb-2">
                {{ task.description }}
              </p>
              <div class="task-meta">
                <v-chip :color="getStatusColor(task.status)" size="small" variant="flat">
                  {{ formatStatus(task.status) }}
                </v-chip>
                <v-chip :color="getPriorityColor(task.priority)" size="small" variant="outlined">
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
        <v-pagination v-model="taskStore.pagination.page" :length="taskStore.pagination.pages"
          @update:model-value="taskStore.setPage"></v-pagination>
      </div>
    </div>

    <task-form-dialog v-model="showCreateDialog" @save="handleSave" />

    <task-form-dialog v-model="showEditDialog" :task="selectedTask" @save="handleSave" />

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

    <!-- Export History Dialog -->
    <v-dialog v-model="showExportHistory" max-width="800">
      <v-card>
        <v-card-title>
          Export History
          <v-spacer></v-spacer>
          <v-btn icon @click="showExportHistory = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-data-table
            :headers="exportHistoryHeadersWithDownload"
            :items="exportHistory"
            :loading="exportHistoryLoading"
            class="elevation-1"
            :items-per-page="5"
          >
            <template #item.status="{ item }">
              <v-chip :color="getExportStatusColor(item.status)" small>{{ item.status }}</v-chip>
            </template>
            <template #item.requestedAt="{ item }">
              {{ formatDate(item.requestedAt) }}
            </template>
            <template #item.completedAt="{ item }">
              {{ item.completedAt ? formatDate(item.completedAt) : '-' }}
            </template>
            <template #item.error="{ item }">
              <span v-if="item.status === 'failed'" class="text-error">{{ item.error }}</span>
            </template>
            <template #item.download="{ item }">
              <v-btn
                v-if="item.status === 'completed'"
                icon
                size="small"
                @click="downloadExport(item._id, item.format)"
                :title="`Download ${item.format.toUpperCase()}`"
              >
                <v-icon>mdi-download</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import TaskFormDialog from './TaskFormDialog.vue'
import apiClient from '../api/client.js'

import dayjs from 'dayjs'

// const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const taskStore = useTaskStore()

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const showExportHistory = ref(false)
const selectedTask = ref(null)
const dateMenu = ref(false)
const showAdvanced = ref(false)
const filters = reactive({
  status: '',
  priority: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  dateRange: [], // [start, end]
  keyword: ''
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

const dateRangeText = computed(() => {
  if (filters.dateRange && filters.dateRange.length === 2) {
    const [start, end] = filters.dateRange

    return `${dayjs(start).format('DD/MM/YYYY')} - ${dayjs(end).format('DD/MM/YYYY')}`
  }
  return ''
})

function updateFilters() {
  taskStore.updateFilters(filters)
  console.log('Filters updated:', filters)
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

function onDateRangeChange(val) {
  console.log(val)
  if (val.length > 1) {
    dateMenu.value = false
    updateFilters()
  }
}

// Active filter chips
const activeFilterChips = computed(() => {
  const chips = []
  if (filters.status) chips.push({ key: 'status', label: `Status: ${formatStatus(filters.status)}` })
  if (filters.priority) chips.push({ key: 'priority', label: `Priority: ${formatPriority(filters.priority)}` })
  if (filters.keyword) chips.push({ key: 'keyword', label: `Keyword: "${filters.keyword}"` })
  if (filters.dateRange && filters.dateRange.length === 2)
    chips.push({ key: 'dateRange', label: `Created: ${dayjs(filters.dateRange[0]).format('DD/MM/YYYY')} - ${dayjs(filters.dateRange[1]).format('DD/MM/YYYY')}` })
  return chips
})

function clearFilter(key) {
  filters[key] = key === 'dateRange' ? [] : ''
  updateFilters()
}

function clearAllFilters() {
  Object.keys(filters).forEach(key => {
    filters[key] = Array.isArray(filters[key]) ? [] : ''
  })
  updateFilters()
}

const snackbar = ref({
  show: false,
  color: 'success',
  text: ''
})

async function exportTasks(format) {
  // Build query params from current filters
  const params = new URLSearchParams()
  if (filters.status) params.append('status', filters.status)
  if (filters.priority) params.append('priority', filters.priority)
  if (filters.sortBy) params.append('sortBy', filters.sortBy)
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)
  if (filters.keyword) params.append('keyword', filters.keyword)
  if (filters.dateRange && filters.dateRange.length === 2) {
    const [start, end] = filters.dateRange
    params.append(
      'dateRange',
      encodeURIComponent(
        `${new Date(start).toString()},${new Date(end).toString()}`
      )
    )
  }
  params.append('format', format)

  try {
    const response = await fetch(`${apiClient.baseURL}/tasks/export?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: format === 'csv' ? 'text/csv' : 'application/json'
      }
    })

    if (!response.ok) throw new Error('Export failed')

    // Get filename from Content-Disposition header if available
    const disposition = response.headers.get('Content-Disposition')
    let filename = `tasks.${format}`
    if (disposition && disposition.includes('filename=')) {
      filename = disposition.split('filename=')[1].replace(/"/g, '')
    }

    // Stream the response as a blob and trigger download
    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    snackbar.value = {
      show: true,
      color: 'success',
      text: `Exported tasks as ${format.toUpperCase()} successfully!`
    }
  } catch (err) {
    console.error('Export failed:', err)
    snackbar.value = {
      show: true,
      color: 'error',
      text: 'Failed to export tasks.'
    }
  }
}

const exportHistory = ref([])
const exportHistoryLoading = ref(false)
const exportHistoryHeaders = [
  { text: 'Requested At', value: 'requestedAt' },
  { text: 'Completed At', value: 'completedAt' },
  { text: 'Format', value: 'format' },
  { text: 'Status', value: 'status' },
  { text: 'Error', value: 'error' }
]

const exportHistoryHeadersWithDownload = [
  { text: 'Requested At', value: 'requestedAt' },
  { text: 'Completed At', value: 'completedAt' },
  { text: 'Format', value: 'format' },
  { text: 'Status', value: 'status' },
  { text: 'Error', value: 'error' },
  { text: 'Download', value: 'download', sortable: false }
]

async function fetchExportHistory() {
  exportHistoryLoading.value = true
  try {
    const res = await fetch(`${apiClient.baseURL}/tasks/export/history`)
    const data = await res.json()
    exportHistory.value = data.data?.history || []
  } catch (e) {
    exportHistory.value = []
  }
  exportHistoryLoading.value = false
}

async function downloadExport(id, format) {
  try {
    const response = await fetch(`${apiClient.baseURL}/tasks/export/${id}/download`, {
      method: 'GET',
      headers: {
        Accept: format === 'csv' ? 'text/csv' : 'application/json'
      }
    })
    if (!response.ok) throw new Error('Download failed')

    // Always use export id as filename
    const filename = `${id}.${format}`

    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    snackbar.value = {
      show: true,
      color: 'success',
      text: `Downloaded export as ${filename}!`
    }
  } catch (err) {
    snackbar.value = {
      show: true,
      color: 'error',
      text: 'Failed to download export.'
    }
  }
}

function getExportStatusColor(status) {
  switch (status) {
    case 'completed': return 'success'
    case 'processing': return 'info'
    case 'failed': return 'error'
    default: return 'grey'
  }
}

// Watch dialog open to fetch history
watch(showExportHistory, (val) => {
  if (val) fetchExportHistory()
})

onMounted(() => {
  taskStore.fetchTasks()
})
</script>
