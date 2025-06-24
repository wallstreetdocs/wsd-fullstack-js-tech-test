<!--
/**
 * @fileoverview Enhanced task management component with advanced filtering, export, and CRUD operations
 * @component TaskList
 * @description Comprehensive task list interface with advanced filters, export functionality,
 * create, edit, delete, filter, and sort capabilities matching Dashboard functionality
 * @emits {Object} task-created - Emitted when a new task is created
 * @emits {Object} task-updated - Emitted when a task is updated
 * @emits {String} task-deleted - Emitted when a task is deleted
 */
-->

<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-4">
      <h2 class="page-title">Tasks</h2>

      <div class="d-flex align-center ga-2">
        <!-- Export Button -->
        <export-tasks />

        <!-- Filter Toggle Button -->
        <v-btn
          :color="showFilters ? 'primary' : 'default'"
          variant="outlined"
          @click="showFilters = !showFilters"
        >
          <v-icon left>mdi-filter</v-icon>
          Filters
          <v-badge
            v-if="taskStore.activeFiltersCount > 0"
            :content="taskStore.activeFiltersCount"
            color="error"
            inline
          />
        </v-btn>

        <!-- New Task Button -->
        <v-btn color="primary" @click="showCreateDialog = true">
          <v-icon left>mdi-plus</v-icon>
          New Task
        </v-btn>
      </div>
    </div>

    <!-- Advanced Filters Panel -->
    <v-expand-transition>
      <v-card v-show="showFilters" class="mb-4 filter-panel">
        <v-card-title class="pb-2">
          <v-icon left>mdi-filter-outline</v-icon>
          Advanced Filters
          <v-spacer />
          <v-btn
            size="small"
            variant="text"
            color="error"
            :disabled="taskStore.activeFiltersCount === 0"
            @click="clearAllFilters"
          >
            Clear All
          </v-btn>
        </v-card-title>

        <v-card-text>
          <!-- Search Bar -->
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="searchTerm"
                label="Search tasks..."
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                clearable
                placeholder="Search by title, description, or tags..."
                @update:model-value="onSearchUpdate"
                @click:clear="clearSearch"
              />
            </v-col>

            <!-- Quick Filter Buttons -->
            <v-col cols="12" md="6" class="d-flex align-center">
              <v-chip-group
                v-model="selectedPreset"
                column
                @update:model-value="onPresetChange"
              >
                <v-chip
                  v-for="(preset, index) in filterPresets"
                  :key="index"
                  :value="index"
                  size="small"
                  variant="outlined"
                  filter
                >
                  {{ preset.name }}
                </v-chip>
              </v-chip-group>
            </v-col>
          </v-row>

          <!-- Filter Controls -->
          <v-row>
            <!-- Status Filter -->
            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="filters.status"
                :items="statusOptions"
                label="Status"
                variant="outlined"
                density="compact"
                clearable
                @update:model-value="onFilterUpdate"
              />
            </v-col>

            <!-- Priority Filter -->
            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="filters.priority"
                :items="priorityOptions"
                label="Priority"
                variant="outlined"
                density="compact"
                clearable
                @update:model-value="onFilterUpdate"
              />
            </v-col>

            <!-- Date From -->
            <v-col cols="12" sm="6" md="3">
              <v-text-field
                v-model="filters.dateFrom"
                label="From Date"
                type="date"
                variant="outlined"
                density="compact"
                clearable
                @update:model-value="onDateRangeUpdate"
              />
            </v-col>

            <!-- Date To -->
            <v-col cols="12" sm="6" md="3">
              <v-text-field
                v-model="filters.dateTo"
                label="To Date"
                type="date"
                variant="outlined"
                density="compact"
                clearable
                @update:model-value="onDateRangeUpdate"
              />
            </v-col>
          </v-row>

          <!-- Sort Controls Row -->
          <v-row>
            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="filters.sortBy"
                :items="sortOptions"
                label="Sort by"
                variant="outlined"
                density="compact"
                @update:model-value="onFilterUpdate"
              />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="filters.sortOrder"
                :items="orderOptions"
                label="Order"
                variant="outlined"
                density="compact"
                @update:model-value="onFilterUpdate"
              />
            </v-col>
          </v-row>

          <!-- Additional Filters Row -->
          <v-row v-if="showAdvancedFilters">
            <!-- Category Filter -->
            <v-col cols="12" sm="6" md="4">
              <v-select
                v-model="filters.category"
                :items="categoryOptions"
                label="Category"
                variant="outlined"
                density="compact"
                clearable
                @update:model-value="onFilterUpdate"
              />
            </v-col>

            <!-- Assigned To Filter -->
            <v-col cols="12" sm="6" md="4">
              <v-select
                v-model="filters.assignedTo"
                :items="assigneeOptions"
                label="Assigned To"
                variant="outlined"
                density="compact"
                clearable
                @update:model-value="onFilterUpdate"
              />
            </v-col>

            <!-- Tags Filter -->
            <v-col cols="12" md="4">
              <v-combobox
                v-model="filters.tags"
                :items="availableTags"
                label="Tags"
                variant="outlined"
                density="compact"
                multiple
                chips
                clearable
                @update:model-value="onFilterUpdate"
              />
            </v-col>
          </v-row>

          <!-- Advanced Filters Toggle -->
          <!-- <v-row>
            <v-col cols="12" class="text-center">
              <v-btn
                variant="text"
                size="small"
                @click="showAdvancedFilters = !showAdvancedFilters"
              >
                {{ showAdvancedFilters ? 'Less' : 'More' }} Filters
                <v-icon right>
                  {{
                    showAdvancedFilters ? 'mdi-chevron-up' : 'mdi-chevron-down'
                  }}
                </v-icon>
              </v-btn>
            </v-col>
          </v-row> -->

          <!-- Active Filters Display -->
          <v-row v-if="activeFiltersCount > 0">
            <v-col cols="12">
              <div class="text-caption text-medium-emphasis mb-2">
                Active Filters:
              </div>
              <v-chip-group column>
                <v-chip
                  v-if="filters.search"
                  size="small"
                  closable
                  @click:close="clearFilter('search')"
                >
                  Search: "{{ filters.search }}"
                </v-chip>

                <v-chip
                  v-if="filters.status"
                  size="small"
                  closable
                  @click:close="clearFilter('status')"
                >
                  Status: {{ formatFilterValue('status', filters.status) }}
                </v-chip>

                <v-chip
                  v-if="filters.priority"
                  size="small"
                  closable
                  @click:close="clearFilter('priority')"
                >
                  Priority:
                  {{ formatFilterValue('priority', filters.priority) }}
                </v-chip>

                <v-chip
                  v-if="filters.dateFrom"
                  size="small"
                  closable
                  @click:close="clearFilter('dateFrom')"
                >
                  From: {{ formatDate(filters.dateFrom) }}
                </v-chip>

                <v-chip
                  v-if="filters.dateTo"
                  size="small"
                  closable
                  @click:close="clearFilter('dateTo')"
                >
                  To: {{ formatDate(filters.dateTo) }}
                </v-chip>

                <v-chip
                  v-if="filters.category"
                  size="small"
                  closable
                  @click:close="clearFilter('category')"
                >
                  Category:
                  {{ formatFilterValue('category', filters.category) }}
                </v-chip>

                <v-chip
                  v-if="filters.assignedTo"
                  size="small"
                  closable
                  @click:close="clearFilter('assignedTo')"
                >
                  Assigned:
                  {{ formatFilterValue('assignedTo', filters.assignedTo) }}
                </v-chip>

                <v-chip
                  v-for="tag in filters.tags || []"
                  :key="tag"
                  size="small"
                  closable
                  @click:close="removeTag(tag)"
                >
                  Tag: {{ tag }}
                </v-chip>
              </v-chip-group>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-expand-transition>

    <!-- Task List Content -->
    <div v-if="taskStore.loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <div v-else-if="taskStore.error" class="text-center py-8">
      <v-alert type="error">{{ taskStore.error }}</v-alert>
    </div>

    <div v-else-if="filteredTasks.length === 0" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-1">mdi-format-list-checks</v-icon>
      <p class="text-grey mt-2">No tasks found</p>
      <p v-if="activeFiltersCount > 0" class="text-caption">
        Try adjusting your filters or
        <v-btn variant="text" size="small" @click="clearAllFilters"
          >clear all filters</v-btn
        >
      </p>
    </div>

    <div v-else>
      <!-- Results Summary -->
      <div class="d-flex justify-space-between align-center mb-3">
        <div class="text-body-2 text-medium-emphasis">
          Showing {{ filteredTasks.length }} of
          {{ taskStore.tasks.length }} tasks
        </div>
        <div class="text-body-2 text-medium-emphasis">
          Page {{ taskStore.pagination.page }} of
          {{ taskStore.pagination.pages }}
        </div>
      </div>

      <v-card
        v-for="task in filteredTasks"
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
                <!-- Show category and tags if available -->
                <v-chip
                  v-if="task.category"
                  size="x-small"
                  variant="outlined"
                  class="ml-2"
                >
                  {{ task.category }}
                </v-chip>
                <v-chip
                  v-for="tag in task.tags || []"
                  :key="tag"
                  size="x-small"
                  variant="outlined"
                  class="ml-1"
                >
                  {{ tag }}
                </v-chip>
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

    <!-- Dialogs -->
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
import ExportTasks from './ExportTasks.vue' // Assuming this exists

const taskStore = useTaskStore()

// Dialog states
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const selectedTask = ref(null)

// Filter panel states
const showFilters = ref(false)
const showAdvancedFilters = ref(false)
const searchTerm = ref('')
const selectedPreset = ref(null)

// Enhanced filters with all options from Dashboard
const filters = reactive({
  status: '',
  priority: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  search: '',
  dateFrom: '',
  dateTo: '',
  category: '',
  assignedTo: '',
  tags: []
})

// Filter options (matching Dashboard)
const statusOptions = [
  { title: 'All', value: '' },
  { title: 'Pending', value: 'pending' },
  { title: 'In Progress', value: 'in-progress' },
  { title: 'Completed', value: 'completed' },
  { title: 'Cancelled', value: 'cancelled' }
]

const priorityOptions = [
  { title: 'All', value: '' },
  { title: 'Low', value: 'low' },
  { title: 'Medium', value: 'medium' },
  { title: 'High', value: 'high' },
  { title: 'Critical', value: 'critical' }
]

const categoryOptions = [
  { title: 'All', value: '' },
  { title: 'Development', value: 'development' },
  { title: 'Design', value: 'design' },
  { title: 'Testing', value: 'testing' },
  { title: 'Documentation', value: 'documentation' },
  { title: 'Bug Fix', value: 'bug-fix' },
  { title: 'Feature Request', value: 'feature-request' }
]

const assigneeOptions = [
  { title: 'All', value: '' },
  { title: 'John Doe', value: 'john-doe' },
  { title: 'Jane Smith', value: 'jane-smith' },
  { title: 'Mike Johnson', value: 'mike-johnson' },
  { title: 'Sarah Wilson', value: 'sarah-wilson' }
]

const availableTags = [
  'frontend',
  'backend',
  'ui',
  'ux',
  'api',
  'database',
  'security',
  'performance',
  'mobile',
  'web',
  'urgent',
  'research'
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

// Filter presets (matching Dashboard)
const filterPresets = [
  {
    name: 'High Priority',
    filters: { priority: 'high' }
  },
  {
    name: 'Due Today',
    filters: { dateTo: new Date().toISOString().split('T')[0] }
  },
  {
    name: 'In Progress',
    filters: { status: 'in-progress' }
  },
  {
    name: 'Overdue',
    filters: {
      status: 'pending',
      dateTo: new Date(Date.now() - 86400000).toISOString().split('T')[0]
    }
  }
]

// Computed properties
const activeFiltersCount = computed(() => {
  let count = 0
  if (filters.search) count++
  if (filters.status) count++
  if (filters.priority) count++
  if (filters.dateFrom) count++
  if (filters.dateTo) count++
  if (filters.category) count++
  if (filters.assignedTo) count++
  if (filters.tags && filters.tags.length > 0) count += filters.tags.length
  return count
})

const filteredTasks = computed(() => {
  let tasks = [...taskStore.tasks]

  // Apply search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase()
    tasks = tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(searchLower) ||
        (task.description &&
          task.description.toLowerCase().includes(searchLower)) ||
        (task.tags &&
          task.tags.some((tag) => tag.toLowerCase().includes(searchLower)))
    )
  }

  // Apply status filter
  if (filters.status) {
    tasks = tasks.filter((task) => task.status === filters.status)
  }

  // Apply priority filter
  if (filters.priority) {
    tasks = tasks.filter((task) => task.priority === filters.priority)
  }

  // Apply category filter
  if (filters.category) {
    tasks = tasks.filter((task) => task.category === filters.category)
  }

  // Apply assignee filter
  if (filters.assignedTo) {
    tasks = tasks.filter((task) => task.assignedTo === filters.assignedTo)
  }

  // Apply tags filter
  if (filters.tags && filters.tags.length > 0) {
    tasks = tasks.filter(
      (task) => task.tags && filters.tags.some((tag) => task.tags.includes(tag))
    )
  }

  // Apply date filters
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom)
    tasks = tasks.filter((task) => new Date(task.createdAt) >= fromDate)
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo)
    toDate.setHours(23, 59, 59, 999) // End of day
    tasks = tasks.filter((task) => new Date(task.createdAt) <= toDate)
  }

  // Apply sorting
  tasks.sort((a, b) => {
    let aVal = a[filters.sortBy]
    let bVal = b[filters.sortBy]

    if (filters.sortBy === 'priority') {
      const priorityOrder = { low: 1, medium: 2, high: 3, critical: 4 }
      aVal = priorityOrder[aVal] || 0
      bVal = priorityOrder[bVal] || 0
    }

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }

    if (filters.sortOrder === 'desc') {
      return bVal > aVal ? 1 : -1
    } else {
      return aVal > bVal ? 1 : -1
    }
  })

  return tasks
})

// Debounce for search
const debounceTimeout = ref(null)

// Methods
function updateFilters() {
  taskStore.updateFilters(filters)
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

function onSearchUpdate(value) {
  searchTerm.value = value
  if (debounceTimeout.value) {
    // eslint-disable-next-line no-undef
    clearTimeout(debounceTimeout.value)
  }
  // eslint-disable-next-line no-undef
  debounceTimeout.value = setTimeout(() => {
    filters.search = value
    updateFilters()
  }, 300)
}

function clearSearch() {
  searchTerm.value = ''
  filters.search = ''
  updateFilters()
}

function onFilterUpdate() {
  selectedPreset.value = null
  updateFilters()
}

function onDateRangeUpdate() {
  selectedPreset.value = null
  updateFilters()
}

function onPresetChange(presetIndex) {
  if (presetIndex !== null && filterPresets[presetIndex]) {
    const preset = filterPresets[presetIndex]
    clearAllFilters()
    Object.entries(preset.filters).forEach(([key, value]) => {
      filters[key] = value
    })
    updateFilters()
  }
}

function clearFilter(filterKey) {
  if (filterKey === 'search') {
    searchTerm.value = ''
  }
  if (filterKey === 'tags') {
    filters[filterKey] = []
  } else {
    filters[filterKey] = ''
  }
  selectedPreset.value = null
  updateFilters()
}

function clearAllFilters() {
  Object.keys(filters).forEach((key) => {
    if (key === 'tags') {
      filters[key] = []
    } else if (key === 'sortBy') {
      filters[key] = 'createdAt'
    } else if (key === 'sortOrder') {
      filters[key] = 'desc'
    } else {
      filters[key] = ''
    }
  })
  searchTerm.value = ''
  selectedPreset.value = null
  updateFilters()
}

function removeTag(tag) {
  const currentTags = filters.tags || []
  filters.tags = currentTags.filter((t) => t !== tag)
  updateFilters()
}

function formatFilterValue(filterType, value) {
  const optionMaps = {
    status: statusOptions,
    priority: priorityOptions,
    category: categoryOptions,
    assignedTo: assigneeOptions
  }

  const options = optionMaps[filterType]
  if (options) {
    const option = options.find((opt) => opt.value === value)
    return option ? option.title : value
  }
  return value
}

// Existing utility functions
function getStatusColor(status) {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'in-progress':
      return 'info'
    case 'completed':
      return 'success'
    case 'cancelled':
      return 'error'
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
    case 'critical':
      return 'purple'
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
  if (!date) return ''
  return new Date(date).toLocaleDateString()
}

onMounted(() => {
  taskStore.fetchTasks()
})
</script>

<style scoped>
.page-title {
  font-size: 2rem;
  font-weight: 500;
}

.filter-panel {
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
}

.task-item {
  cursor: pointer;
  transition: all 0.2s ease;
}

.task-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.task-title {
  margin-bottom: 0.5rem;
}

.task-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.v-chip-group {
  gap: 8px;
}

@media (max-width: 960px) {
  .page-title {
    font-size: 1.5rem;
  }

  .d-flex.ga-2 {
    flex-direction: column;
    gap: 8px !important;
    align-items: stretch;
  }
}
</style>
