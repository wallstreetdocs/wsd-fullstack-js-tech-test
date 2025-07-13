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
    </div>

    <!-- Advanced Filters Card -->
    <v-card class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon class="me-2">mdi-filter-variant</v-icon>
        Filters
        <v-spacer></v-spacer>
        <v-btn 
          v-if="hasActiveFilters"
          variant="text" 
          size="small" 
          color="error"
          @click="clearAllFilters"
        >
          <v-icon start>mdi-filter-remove</v-icon>
          Clear All
        </v-btn>
        <v-btn 
          :icon="showAdvancedFilters ? 'mdi-chevron-up' : 'mdi-chevron-down'"
          variant="text"
          @click="showAdvancedFilters = !showAdvancedFilters"
        ></v-btn>
      </v-card-title>
      
      <!-- Active Filters Display -->
      <v-card-text v-if="hasActiveFilters" class="pt-0">
        <div class="d-flex flex-wrap ga-2">
          <!-- Status Chips -->
          <v-chip
            v-for="status in filters.status"
            :key="`status-${status}`"
            :color="getStatusColor(status)"
            size="small"
            closable
            @click:close="removeFilter('status', status)"
          >
            <v-icon start>mdi-circle</v-icon>
            {{ formatStatus(status) }}
          </v-chip>
          
          <!-- Priority Chips -->
          <v-chip
            v-for="priority in filters.priority"
            :key="`priority-${priority}`"
            :color="getPriorityColor(priority)"
            size="small"
            variant="outlined"
            closable
            @click:close="removeFilter('priority', priority)"
          >
            <v-icon start>mdi-flag</v-icon>
            {{ formatPriority(priority) }}
          </v-chip>

          <!-- Date Range Chips -->
          <v-chip
            v-if="filters.createdWithin"
            color="blue"
            size="small"
            variant="tonal"
            closable
            @click:close="clearFilter('createdWithin')"
          >
            <v-icon start>mdi-calendar</v-icon>
            Created: {{ formatDateRange(filters.createdWithin) }}
          </v-chip>

          <v-chip
            v-if="filters.completedWithin"
            color="green"
            size="small"
            variant="tonal"
            closable
            @click:close="clearFilter('completedWithin')"
          >
            <v-icon start>mdi-calendar-check</v-icon>
            Completed: {{ formatDateRange(filters.completedWithin) }}
          </v-chip>

          <!-- Special Filters -->
          <v-chip
            v-if="filters.overdueTasks"
            color="red"
            size="small"
            variant="tonal"
            closable
            @click:close="clearFilter('overdueTasks')"
          >
            <v-icon start>mdi-clock-alert</v-icon>
            Overdue Tasks
          </v-chip>

          <v-chip
            v-if="filters.recentlyCompleted"
            color="green"
            size="small"
            variant="tonal"
            closable
            @click:close="clearFilter('recentlyCompleted')"
          >
            <v-icon start>mdi-check-circle</v-icon>
            Recently Completed
          </v-chip>

          <!-- Time Range Filters -->
          <v-chip
            v-if="filters.estimatedTimeMin || filters.estimatedTimeMax"
            color="purple"
            size="small"
            variant="tonal"
            closable
            @click:close="clearTimeFilter('estimated')"
          >
            <v-icon start>mdi-timer-outline</v-icon>
            Est. Time: {{ formatTimeRange('estimated') }}
          </v-chip>

          <v-chip
            v-if="filters.actualTimeMin || filters.actualTimeMax"
            color="orange"
            size="small"
            variant="tonal"
            closable
            @click:close="clearTimeFilter('actual')"
          >
            <v-icon start>mdi-timer</v-icon>
            Actual Time: {{ formatTimeRange('actual') }}
          </v-chip>
        </div>
      </v-card-text>

      <!-- Filter Controls -->
      <v-card-text>
        <!-- Quick Filters Row -->
        <v-row class="mb-4">
          <v-col cols="12" md="4">
            <v-select
              v-model="filters.status"
              :items="statusOptions"
              label="Status"
              multiple
              chips
              clearable
              @update:model-value="updateFilters"
            >
              <template #selection="{ item, index }">
                <v-chip
                  v-if="index < 2"
                  :color="getStatusColor(item.value)"
                  size="small"
                  closable
                  @click:close="removeFilter('status', item.value)"
                >
                  {{ item.title }}
                </v-chip>
                <span v-if="index === 2" class="text-grey text-caption align-self-center">
                  (+{{ filters.status.length - 2 }} others)
                </span>
              </template>
            </v-select>
          </v-col>
          
          <v-col cols="12" md="4">
            <v-select
              v-model="filters.priority"
              :items="priorityOptions"
              label="Priority"
              multiple
              chips
              clearable
              @update:model-value="updateFilters"
            >
              <template #selection="{ item, index }">
                <v-chip
                  v-if="index < 2"
                  :color="getPriorityColor(item.value)"
                  size="small"
                  variant="outlined"
                  closable
                  @click:close="removeFilter('priority', item.value)"
                >
                  {{ item.title }}
                </v-chip>
                <span v-if="index === 2" class="text-grey text-caption align-self-center">
                  (+{{ filters.priority.length - 2 }} others)
                </span>
              </template>
            </v-select>
          </v-col>

          <v-col cols="12" md="4">
            <div class="d-flex ga-2">
              <v-select
                v-model="filters.sortBy"
                :items="sortOptions"
                label="Sort by"
                @update:model-value="updateFilters"
              ></v-select>
              <v-btn-toggle
                v-model="sortOrderToggle"
                mandatory
                variant="outlined"
                divided
                @update:model-value="updateSortOrder"
              >
                <v-btn value="desc" icon="mdi-sort-descending"></v-btn>
                <v-btn value="asc" icon="mdi-sort-ascending"></v-btn>
              </v-btn-toggle>
            </div>
          </v-col>
        </v-row>

        <!-- Advanced Filters (Expandable) -->
        <v-expand-transition>
          <div v-if="showAdvancedFilters">
            <v-divider class="mb-4"></v-divider>
            
            <!-- Date Filters -->
            <v-row class="mb-4">
              <v-col cols="12" md="6">
                <v-select
                  v-model="filters.createdWithin"
                  :items="dateRangeOptions"
                  label="Created Within"
                  clearable
                  @update:model-value="updateFilters"
                >
                  <template #prepend-inner>
                    <v-icon>mdi-calendar-plus</v-icon>
                  </template>
                </v-select>
              </v-col>
              
              <v-col cols="12" md="6">
                <v-select
                  v-model="filters.completedWithin"
                  :items="dateRangeOptions"
                  label="Completed Within"
                  clearable
                  @update:model-value="updateFilters"
                >
                  <template #prepend-inner>
                    <v-icon>mdi-calendar-check</v-icon>
                  </template>
                </v-select>
              </v-col>
            </v-row>

            <!-- Special Filters -->
            <v-row class="mb-4">
              <v-col cols="12">
                <div class="d-flex flex-wrap ga-3">
                  <v-switch
                    v-model="filters.overdueTasks"
                    label="Show overdue tasks only"
                    color="error"
                    hide-details
                    @update:model-value="updateFilters"
                  ></v-switch>
                  
                  <v-switch
                    v-model="filters.recentlyCompleted"
                    label="Recently completed (last 7 days)"
                    color="success"
                    hide-details
                    @update:model-value="updateFilters"
                  ></v-switch>

                  <v-switch
                    v-model="filters.noEstimate"
                    label="Tasks without estimated time"
                    color="warning"
                    hide-details
                    @update:model-value="updateFilters"
                  ></v-switch>
                </div>
              </v-col>
            </v-row>

            <!-- Time Range Filters -->
            <v-row class="mb-4">
              <v-col cols="12" md="6">
                <v-card variant="outlined">
                  <v-card-subtitle>Estimated Time (minutes)</v-card-subtitle>
                  <v-card-text>
                    <v-row>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="filters.estimatedTimeMin"
                          label="Min"
                          type="number"
                          min="0"
                          hide-details
                          @update:model-value="updateFilters"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="filters.estimatedTimeMax"
                          label="Max"
                          type="number"
                          min="0"
                          hide-details
                          @update:model-value="updateFilters"
                        ></v-text-field>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </v-col>

              <v-col cols="12" md="6">
                <v-card variant="outlined">
                  <v-card-subtitle>Actual Time (minutes)</v-card-subtitle>
                  <v-card-text>
                    <v-row>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="filters.actualTimeMin"
                          label="Min"
                          type="number"
                          min="0"
                          hide-details
                          @update:model-value="updateFilters"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="6">
                        <v-text-field
                          v-model.number="filters.actualTimeMax"
                          label="Max"
                          type="number"
                          min="0"
                          hide-details
                          @update:model-value="updateFilters"
                        ></v-text-field>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <!-- Performance Filters -->
            <v-row>
              <v-col cols="12">
                <v-card variant="outlined">
                  <v-card-subtitle>Performance Filters</v-card-subtitle>
                  <v-card-text>
                    <div class="d-flex flex-wrap ga-3">
                      <v-switch
                        v-model="filters.underEstimated"
                        label="Under-estimated (took longer than expected)"
                        color="orange"
                        hide-details
                        @update:model-value="updateFilters"
                      ></v-switch>
                      
                      <v-switch
                        v-model="filters.overEstimated"
                        label="Over-estimated (took less than expected)"
                        color="blue"
                        hide-details
                        @update:model-value="updateFilters"
                      ></v-switch>
                    </div>
                  </v-card-text>
                </v-card>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import TaskFormDialog from './TaskFormDialog.vue'

const taskStore = useTaskStore()

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const selectedTask = ref(null)
const showAdvancedFilters = ref(false)

// Enhanced filters with all advanced options
const filters = reactive({
  status: [],
  priority: [],
  sortBy: 'createdAt',
  sortOrder: 'desc',
  createdWithin: '',
  completedWithin: '',
  overdueTasks: false,
  recentlyCompleted: false,
  noEstimate: false,
  estimatedTimeMin: null,
  estimatedTimeMax: null,
  actualTimeMin: null,
  actualTimeMax: null,
  underEstimated: false,
  overEstimated: false
})

// Sort order toggle for visual feedback
const sortOrderToggle = ref('desc')

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
  { title: 'Status', value: 'status' },
  { title: 'Completion Date', value: 'completedAt' }
]

const dateRangeOptions = [
  { title: 'Last 7 days', value: 'last-7-days' },
  { title: 'Last 30 days', value: 'last-30-days' },
  { title: 'Last 90 days', value: 'last-90-days' }
]

// Computed property to check if any filters are active
const hasActiveFilters = computed(() => {
  return (
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    filters.createdWithin ||
    filters.completedWithin ||
    filters.overdueTasks ||
    filters.recentlyCompleted ||
    filters.noEstimate ||
    filters.estimatedTimeMin ||
    filters.estimatedTimeMax ||
    filters.actualTimeMin ||
    filters.actualTimeMax ||
    filters.underEstimated ||
    filters.overEstimated
  )
})

function updateFilters() {
  // Clean up empty values before sending
  const cleanFilters = { ...filters }
  
  // Remove empty arrays and null values
  Object.keys(cleanFilters).forEach(key => {
    if (Array.isArray(cleanFilters[key]) && cleanFilters[key].length === 0) {
      delete cleanFilters[key]
    } else if (cleanFilters[key] === null || cleanFilters[key] === '') {
      delete cleanFilters[key]
    } else if (typeof cleanFilters[key] === 'boolean' && !cleanFilters[key]) {
      delete cleanFilters[key]
    }
  })
  
  taskStore.updateFilters(cleanFilters)
}

function updateSortOrder(order) {
  filters.sortOrder = order
  updateFilters()
}

function removeFilter(filterType, value) {
  if (Array.isArray(filters[filterType])) {
    const index = filters[filterType].indexOf(value)
    if (index > -1) {
      filters[filterType].splice(index, 1)
    }
  }
  updateFilters()
}

function clearFilter(filterType) {
  if (Array.isArray(filters[filterType])) {
    filters[filterType] = []
  } else if (typeof filters[filterType] === 'boolean') {
    filters[filterType] = false
  } else {
    filters[filterType] = ''
  }
  updateFilters()
}

function clearTimeFilter(type) {
  if (type === 'estimated') {
    filters.estimatedTimeMin = null
    filters.estimatedTimeMax = null
  } else if (type === 'actual') {
    filters.actualTimeMin = null
    filters.actualTimeMax = null
  }
  updateFilters()
}

function clearAllFilters() {
  filters.status = []
  filters.priority = []
  filters.createdWithin = ''
  filters.completedWithin = ''
  filters.overdueTasks = false
  filters.recentlyCompleted = false
  filters.noEstimate = false
  filters.estimatedTimeMin = null
  filters.estimatedTimeMax = null
  filters.actualTimeMin = null
  filters.actualTimeMax = null
  filters.underEstimated = false
  filters.overEstimated = false
  updateFilters()
}

function formatDateRange(range) {
  switch (range) {
    case 'last-7-days': return 'Last 7 days'
    case 'last-30-days': return 'Last 30 days'
    case 'last-90-days': return 'Last 90 days'
    default: return range
  }
}

function formatTimeRange(type) {
  const min = type === 'estimated' ? filters.estimatedTimeMin : filters.actualTimeMin
  const max = type === 'estimated' ? filters.estimatedTimeMax : filters.actualTimeMax
  
  if (min && max) {
    return `${min}-${max} min`
  } else if (min) {
    return `${min}+ min`
  } else if (max) {
    return `≤${max} min`
  }
  return ''
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

onMounted(() => {
  taskStore.fetchTasks()
})
</script>
