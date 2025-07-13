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
      <v-btn variant="outlined" @click="showExportDialog = true" class="mr-2">
        <v-icon left>mdi-download</v-icon>
        Export
      </v-btn>
      <v-btn variant="text" :to="'/exports'" class="mr-2">
        <v-icon left>mdi-history</v-icon>
        Export History
      </v-btn>
      <v-btn color="primary" @click="showCreateDialog = true">
        <v-icon left>mdi-plus</v-icon>
        New Task
      </v-btn>
    </div>

    <!-- Advanced Query Builder -->
    <task-query-builder
      v-model="advancedQuery"
      @query-updated="handleQueryUpdate"
      @search-executed="handleSearchExecute"
    />

    <!-- Search Bar -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="8">
            <v-text-field
              v-model="searchQuery"
              label="Search tasks..."
              placeholder="Enter search terms for title and description"
              prepend-inner-icon="mdi-magnify"
              clearable
              @keyup.enter="handleSearch"
              @update:model-value="handleSearchInput"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4" class="d-flex gap-2">
            <v-btn
              color="primary"
              @click="handleSearch"
              :loading="taskStore.loading"
            >
              Search
            </v-btn>
            <v-btn variant="outlined" @click="clearSearch"> Clear </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Basic Filters -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row>
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
      </v-card-text>
    </v-card>

    <!-- Query Mode Indicator -->
    <v-alert
      v-if="taskStore.queryMode !== 'basic'"
      :type="taskStore.queryMode === 'search' ? 'info' : 'warning'"
      variant="tonal"
      class="mb-4"
    >
      <template #prepend>
        <v-icon>
          {{
            taskStore.queryMode === 'search'
              ? 'mdi-magnify'
              : 'mdi-filter-variant'
          }}
        </v-icon>
      </template>
      <div class="d-flex align-center justify-space-between">
        <span>
          {{
            taskStore.queryMode === 'search'
              ? 'Search Results'
              : 'Advanced Query Results'
          }}
          <span
            v-if="taskStore.queryMode === 'search' && taskStore.searchQuery"
          >
            for "{{ taskStore.searchQuery }}"
          </span>
        </span>
        <v-btn size="small" variant="text" @click="taskStore.resetToBasic">
          Show All Tasks
        </v-btn>
      </div>
    </v-alert>

    <div v-if="taskStore.loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <div v-else-if="taskStore.error" class="text-center py-8">
      <v-alert type="error">{{ taskStore.error }}</v-alert>
    </div>

    <div v-else-if="taskStore.tasks.length === 0" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-1">mdi-format-list-checks</v-icon>
      <p class="text-grey mt-2">
        {{
          taskStore.queryMode === 'basic'
            ? 'No tasks found'
            : 'No tasks match your query'
        }}
      </p>
      <v-btn
        v-if="taskStore.queryMode !== 'basic'"
        variant="outlined"
        @click="taskStore.resetToBasic"
        class="mt-2"
      >
        Clear Filters
      </v-btn>
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
                <span v-if="task.estimatedTime" class="text-caption">
                  Est: {{ task.estimatedTime }}min
                </span>
                <span v-if="task.actualTime" class="text-caption">
                  Actual: {{ task.actualTime }}min
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

    <!-- Export Dialog -->
    <export-dialog
      v-model="showExportDialog"
      @export-created="handleExportCreated"
    />

    <!-- Export History -->
    <v-dialog v-model="showExportHistory" max-width="800px">
      <export-history />
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import { useExportStore } from '../stores/exportStore.js'
import TaskFormDialog from './TaskFormDialog.vue'
import TaskQueryBuilder from './TaskQueryBuilder.vue'
import ExportDialog from './ExportDialog.vue'
import ExportHistory from './ExportHistory.vue'

const taskStore = useTaskStore()
const exportStore = useExportStore()

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const showExportDialog = ref(false)
const showExportHistory = ref(false)
const selectedTask = ref(null)
const searchQuery = ref('')
const advancedQuery = ref({})

const filters = reactive({
  status: '',
  priority: '',
  sortBy: 'createdAt',
  sortOrder: 'desc'
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
  { title: 'Status', value: 'status' },
  { title: 'Priority', value: 'priority' },
  { title: 'Estimated Time', value: 'estimatedTime' },
  { title: 'Actual Time', value: 'actualTime' }
]

const orderOptions = [
  { title: 'Ascending', value: 'asc' },
  { title: 'Descending', value: 'desc' }
]

// Methods
function updateFilters() {
  taskStore.updateFilters(filters)
}

function handleSearch() {
  if (searchQuery.value.trim()) {
    taskStore.searchTasks(searchQuery.value.trim())
  }
}

function handleSearchInput() {
  // Debounced search could be implemented here
}

function clearSearch() {
  searchQuery.value = ''
  taskStore.resetToBasic()
}

function handleQueryUpdate(query) {
  // Store the current query in the task store for export functionality
  taskStore.setCurrentQuery(query)
}

function handleSearchExecute(queryData) {
  // Execute advanced query
  if (queryData.filters && queryData.options) {
    taskStore.queryTasks(queryData.filters, queryData.options)
  } else {
    // Backward compatibility for old format
    taskStore.queryTasks(queryData)
  }
}

function editTask(task) {
  selectedTask.value = task
  showEditDialog.value = true
}

function deleteTask(task) {
  selectedTask.value = task
  showDeleteDialog.value = true
}

async function confirmDelete() {
  try {
    await taskStore.deleteTask(selectedTask.value._id)
    showDeleteDialog.value = false
    selectedTask.value = null
  } catch (error) {
    console.error('Error deleting task:', error)
  }
}

async function handleSave(taskData) {
  try {
    if (selectedTask.value) {
      await taskStore.updateTask(selectedTask.value._id, taskData)
      showEditDialog.value = false
      selectedTask.value = null
    } else {
      await taskStore.createTask(taskData)
      showCreateDialog.value = false
    }
  } catch (error) {
    console.error('Error saving task:', error)
  }
}

function getStatusColor(status) {
  const colors = {
    pending: 'warning',
    'in-progress': 'info',
    completed: 'success'
  }
  return colors[status] || 'grey'
}

function formatStatus(status) {
  return status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function getPriorityColor(priority) {
  const colors = {
    low: 'success',
    medium: 'warning',
    high: 'error'
  }
  return colors[priority] || 'grey'
}

function formatPriority(priority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString()
}

function handleExportCreated(exportRecord) {
  console.log('Export created:', exportRecord)
  // Could show a notification here
}

onMounted(() => {
  taskStore.fetchTasks()
  taskStore.initializeSocketListeners()
  exportStore.initializeSocketListeners()
})
</script>

<style scoped>
.task-item {
  cursor: pointer;
  transition: all 0.2s ease;
}

.task-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.task-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  font-weight: 500;
}

.task-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.gap-2 {
  gap: 0.5rem;
}
</style>
