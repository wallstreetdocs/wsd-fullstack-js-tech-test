<!--
/**
 * @fileoverview Main dashboard view with metrics overview, analytics charts, and advanced filtering
 * @component Dashboard
 * @description Displays key performance indicators, task status/priority charts,
 * quick task list, recent activity, and advanced filter controls in a responsive grid layout
 */
-->

<template>
  <div>
    <div class="d-flex justify-space-between align-center mb-4">
      <h1 class="page-title">Dashboard</h1>

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
                v-model="taskStore.filters.status"
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
                v-model="taskStore.filters.priority"
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
                v-model="taskStore.filters.dateFrom"
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
                v-model="taskStore.filters.dateTo"
                label="To Date"
                type="date"
                variant="outlined"
                density="compact"
                clearable
                @update:model-value="onDateRangeUpdate"
              />
            </v-col>
          </v-row>

          <!-- Additional Filters Row -->
          <v-row v-if="showAdvancedFilters">
            <!-- Category Filter -->
            <v-col cols="12" sm="6" md="4">
              <v-select
                v-model="taskStore.filters.category"
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
                v-model="taskStore.filters.assignedTo"
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
                v-model="taskStore.filters.tags"
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
          <v-row>
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
          </v-row>

          <!-- Active Filters Display -->
          <v-row v-if="taskStore.activeFiltersCount > 0">
            <v-col cols="12">
              <div class="text-caption text-medium-emphasis mb-2">
                Active Filters:
              </div>
              <v-chip-group column>
                <v-chip
                  v-if="taskStore.filters.search"
                  size="small"
                  closable
                  @click:close="clearFilter('search')"
                >
                  Search: "{{ taskStore.filters.search }}"
                </v-chip>

                <v-chip
                  v-if="taskStore.filters.status"
                  size="small"
                  closable
                  @click:close="clearFilter('status')"
                >
                  Status: {{ taskStore.filters.status }}
                </v-chip>

                <v-chip
                  v-if="taskStore.filters.priority"
                  size="small"
                  closable
                  @click:close="clearFilter('priority')"
                >
                  Priority: {{ taskStore.filters.priority }}
                </v-chip>

                <v-chip
                  v-if="taskStore.filters.dateFrom"
                  size="small"
                  closable
                  @click:close="clearFilter('dateFrom')"
                >
                  From: {{ formatDate(taskStore.filters.dateFrom) }}
                </v-chip>

                <v-chip
                  v-if="taskStore.filters.dateTo"
                  size="small"
                  closable
                  @click:close="clearFilter('dateTo')"
                >
                  To: {{ formatDate(taskStore.filters.dateTo) }}
                </v-chip>

                <v-chip
                  v-if="taskStore.filters.category"
                  size="small"
                  closable
                  @click:close="clearFilter('category')"
                >
                  Category: {{ taskStore.filters.category }}
                </v-chip>

                <v-chip
                  v-if="taskStore.filters.assignedTo"
                  size="small"
                  closable
                  @click:close="clearFilter('assignedTo')"
                >
                  Assigned: {{ taskStore.filters.assignedTo }}
                </v-chip>

                <v-chip
                  v-for="tag in taskStore.filters.tags"
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

    <!-- Dashboard Content -->
    <v-row>
      <!-- Metrics Overview -->
      <v-col cols="12" lg="8">
        <v-card class="mb-4">
          <v-card-title>
            <v-icon left>mdi-chart-box</v-icon>
            Overview
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <div class="text-h4 text-primary">{{ metrics.total }}</div>
                  <div class="text-caption text-medium-emphasis">
                    Total Tasks
                  </div>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <div class="text-h4 text-warning">{{ metrics.pending }}</div>
                  <div class="text-caption text-medium-emphasis">Pending</div>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <div class="text-h4 text-info">{{ metrics.inProgress }}</div>
                  <div class="text-caption text-medium-emphasis">
                    In Progress
                  </div>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <div class="text-h4 text-success">
                    {{ metrics.completed }}
                  </div>
                  <div class="text-caption text-medium-emphasis">Completed</div>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Quick Task List -->
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <div>
              <v-icon left>mdi-format-list-bulleted</v-icon>
              Recent Tasks
            </div>
            <v-btn size="small" variant="text" to="/tasks"> View All </v-btn>
          </v-card-title>
          <v-card-text>
            <v-list v-if="recentTasks.length > 0" density="compact">
              <v-list-item
                v-for="task in recentTasks"
                :key="task.id"
                :to="`/tasks/${task.id}`"
              >
                <template #prepend>
                  <v-chip
                    :color="getStatusColor(task.status)"
                    size="x-small"
                    variant="dot"
                  >
                    {{ task.status }}
                  </v-chip>
                </template>
                <v-list-item-title>{{ task.title }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ formatDate(task.createdAt) }}
                </v-list-item-subtitle>
                <template #append>
                  <v-chip
                    :color="getPriorityColor(task.priority)"
                    size="x-small"
                  >
                    {{ task.priority }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center py-8 text-medium-emphasis">
              No tasks found
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Charts and Analytics -->
      <v-col cols="12" lg="4">
        <v-card class="mb-4">
          <v-card-title>
            <v-icon left>mdi-chart-pie</v-icon>
            Task Status
          </v-card-title>
          <v-card-text>
            <div class="chart-container">
              <!-- Simple status chart representation -->
              <v-progress-circular
                :model-value="metrics.completionRate"
                :size="120"
                :width="8"
                color="success"
                class="mx-auto d-block mb-4"
              >
                <span class="text-h6"
                  >{{ Math.round(metrics.completionRate) }}%</span
                >
              </v-progress-circular>
              <div class="text-center text-caption">Completion Rate</div>
            </div>
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-title>
            <v-icon left>mdi-clock-outline</v-icon>
            Recent Activity
          </v-card-title>
          <v-card-text>
            <v-timeline density="compact" align="start" truncate-line="both">
              <v-timeline-item
                v-for="activity in recentActivity"
                :key="activity.id"
                :dot-color="getActivityColor(activity.type)"
                size="x-small"
              >
                <div class="text-body-2">{{ activity.description }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatRelativeTime(activity.timestamp) }}
                </div>
              </v-timeline-item>
            </v-timeline>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import ExportTasks from '../components/ExportTasks.vue'
import apiClient from '../api/client'

const taskStore = useTaskStore()

// Reactive state
const showFilters = ref(false)
const showAdvancedFilters = ref(false)
const searchTerm = ref('')
const selectedPreset = ref(null)
const loading = ref(false)
const metrics = ref({
  total: 0,
  pending: 0,
  inProgress: 0,
  completed: 0,
  completionRate: 0
})
const recentTasks = ref([])
const recentActivity = ref([])

// Filter options
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

// Filter presets
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
      dateTo: new Date(Date.now() - 86400000).toISOString().split('T')[0] // Yesterday
    }
  }
]

// Computed properties
const debounceTimeout = ref(null)

// Methods
function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}

function formatRelativeTime(timestamp) {
  const now = new Date()
  const time = new Date(timestamp)
  const diffMs = now - time
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(timestamp)
}

function getStatusColor(status) {
  const colors = {
    pending: 'warning',
    'in-progress': 'info',
    completed: 'success',
    cancelled: 'error'
  }
  return colors[status] || 'default'
}

function getPriorityColor(priority) {
  const colors = {
    low: 'success',
    medium: 'warning',
    high: 'error',
    critical: 'purple'
  }
  return colors[priority] || 'default'
}

function getActivityColor(type) {
  const colors = {
    created: 'success',
    updated: 'info',
    completed: 'primary',
    deleted: 'error'
  }
  return colors[type] || 'default'
}

function onSearchUpdate(value) {
  searchTerm.value = value
  if (debounceTimeout.value) {
    // eslint-disable-next-line no-undef
    clearTimeout(debounceTimeout.value)
  }
  // eslint-disable-next-line no-undef
  debounceTimeout.value = setTimeout(() => {
    taskStore.updateFilter('search', value)
    loadData()
  }, 300)
}

function clearSearch() {
  searchTerm.value = ''
  taskStore.updateFilter('search', '')
  loadData()
}

function onFilterUpdate() {
  selectedPreset.value = null
  loadData()
}

function onDateRangeUpdate() {
  selectedPreset.value = null
  loadData()
}

function onPresetChange(presetIndex) {
  if (presetIndex !== null && filterPresets[presetIndex]) {
    const preset = filterPresets[presetIndex]
    taskStore.clearFilters()
    Object.entries(preset.filters).forEach(([key, value]) => {
      taskStore.updateFilter(key, value)
    })
    loadData()
  }
}

function clearFilter(filterKey) {
  taskStore.updateFilter(filterKey, null)
  if (filterKey === 'search') {
    searchTerm.value = ''
  }
  selectedPreset.value = null
  loadData()
}

function clearAllFilters() {
  taskStore.clearFilters()
  searchTerm.value = ''
  selectedPreset.value = null
  loadData()
}

function removeTag(tag) {
  const currentTags = taskStore.filters.tags || []
  const updatedTags = currentTags.filter((t) => t !== tag)
  taskStore.updateFilter('tags', updatedTags.length > 0 ? updatedTags : null)
  loadData()
}

async function loadData() {
  if (loading.value) return

  loading.value = true
  try {
    // Load tasks with current filters
    await taskStore.fetchTasks()

    // Load dashboard metrics
    await loadMetrics()

    // Load recent activity
    await loadRecentActivity()
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  } finally {
    loading.value = false
  }
}

async function loadMetrics() {
  try {
    const response = await apiClient.getAnalytics()
    metrics.value = {
      total: response.data.totalTasks || 0,
      pending: response.data.pendingTasks || 0,
      inProgress: response.data.inProgressTasks || 0,
      completed: response.data.completedTasks || 0,
      completionRate: response.data.completionRate || 0
    }

    // Get recent tasks from filtered results
    recentTasks.value = taskStore.filteredTasks
      .slice(0, 5)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  } catch (error) {
    console.error('Failed to load metrics:', error)
    // Fallback to store data
    const tasks = taskStore.filteredTasks
    metrics.value = {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in-progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      completionRate:
        tasks.length > 0
          ? (tasks.filter((t) => t.status === 'completed').length /
              tasks.length) *
            100
          : 0
    }
    recentTasks.value = tasks.slice(0, 5)
  }
}

async function loadRecentActivity() {
  try {
    // Mock recent activity data - replace with actual API call
    recentActivity.value = [
      {
        id: 1,
        type: 'created',
        description: 'New task "Implement user authentication" created',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago
      },
      {
        id: 2,
        type: 'completed',
        description: 'Task "Fix login validation" completed',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
      },
      {
        id: 3,
        type: 'updated',
        description: 'Task "Dashboard redesign" updated',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() // 4 hours ago
      },
      {
        id: 4,
        type: 'created',
        description: 'New task "API documentation" created',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() // 6 hours ago
      }
    ]
  } catch (error) {
    console.error('Failed to load recent activity:', error)
    recentActivity.value = []
  }
}

// Initialize search term from store
watch(
  () => taskStore.filters.search,
  (newValue) => {
    if (newValue !== searchTerm.value) {
      searchTerm.value = newValue || ''
    }
  },
  { immediate: true }
)

// Load data on component mount
onMounted(() => {
  loadData()
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

.chart-container {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.v-timeline {
  max-height: 300px;
  overflow-y: auto;
}

.v-chip-group {
  gap: 8px;
}

@media (max-width: 960px) {
  .page-title {
    font-size: 1.5rem;
  }
}
</style>
