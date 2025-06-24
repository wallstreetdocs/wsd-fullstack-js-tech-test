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

      <!-- Filter Toggle Button -->
      <v-btn
        :color="showFilters ? 'primary' : 'default'"
        variant="outlined"
        class="ml-4"
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

    <!-- Metrics Row -->
    <v-row>
      <v-col cols="12" md="3">
        <metric-card
          title="Total Tasks"
          :value="analyticsStore.analytics.totalTasks"
          icon="mdi-format-list-checks"
          color="primary"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Completion Rate"
          :value="`${analyticsStore.analytics.completionRate}%`"
          icon="mdi-check-circle"
          color="success"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Created Today"
          :value="analyticsStore.analytics.tasksCreatedToday"
          icon="mdi-plus-circle"
          color="info"
        />
      </v-col>
      <v-col cols="12" md="3">
        <metric-card
          title="Completed Today"
          :value="analyticsStore.analytics.tasksCompletedToday"
          icon="mdi-check-all"
          color="success"
        />
      </v-col>
    </v-row>

    <!-- Charts Row -->
    <v-row class="mt-4">
      <v-col cols="12" md="6">
        <v-card class="chart-container equal-height-chart">
          <v-card-title>Tasks by Status</v-card-title>
          <v-card-text>
            <task-status-chart
              :data="analyticsStore.statusData"
              :show-legend="true"
            />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card class="chart-container equal-height-chart">
          <v-card-title>Tasks by Priority</v-card-title>
          <v-card-text>
            <task-priority-chart :data="analyticsStore.priorityData" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Content Row -->
    <v-row class="mt-4">
      <v-col cols="12" md="8">
        <quick-task-list :filtered="taskStore.activeFiltersCount > 0" />
      </v-col>
      <v-col cols="12" md="4">
        <recent-activity />
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useAnalyticsStore } from '../stores/analyticsStore.js'
import { useTaskStore } from '../stores/taskStore.js'
import MetricCard from '../components/MetricCard.vue'
import TaskStatusChart from '../components/TaskStatusChart.vue'
import TaskPriorityChart from '../components/TaskPriorityChart.vue'
import QuickTaskList from '../components/QuickTaskList.vue'
import RecentActivity from '../components/RecentActivity.vue'

const analyticsStore = useAnalyticsStore()
const taskStore = useTaskStore()

// Reactive data
const showFilters = ref(false)
const showAdvancedFilters = ref(false)
const searchTerm = ref('')
const selectedPreset = ref(null)

// Filter options
const statusOptions = [
  { title: 'Pending', value: 'pending' },
  { title: 'In Progress', value: 'in-progress' },
  { title: 'Completed', value: 'completed' },
  { title: 'Cancelled', value: 'cancelled' }
]

const priorityOptions = [
  { title: 'Low', value: 'low' },
  { title: 'Medium', value: 'medium' },
  { title: 'High', value: 'high' }
]

const categoryOptions = [
  { title: 'Development', value: 'development' },
  { title: 'Design', value: 'design' },
  { title: 'Testing', value: 'testing' },
  { title: 'Documentation', value: 'documentation' },
  { title: 'Bug Fix', value: 'bug-fix' },
  { title: 'Feature', value: 'feature' }
]

const assigneeOptions = [
  { title: 'John Doe', value: 'john-doe' },
  { title: 'Jane Smith', value: 'jane-smith' },
  { title: 'Bob Johnson', value: 'bob-johnson' },
  { title: 'Alice Brown', value: 'alice-brown' }
]

const availableTags = [
  'urgent',
  'frontend',
  'backend',
  'database',
  'api',
  'ui-ux',
  'mobile',
  'desktop',
  'testing',
  'review'
]

// Computed
const filterPresets = computed(() => taskStore.getFilterPresets())

// Methods
function onSearchUpdate(value) {
  taskStore.updateSearch(value || '')
}

function clearSearch() {
  searchTerm.value = ''
  taskStore.updateSearch('')
}

function onFilterUpdate() {
  taskStore.updateFilters({})
}

function onDateRangeUpdate() {
  taskStore.updateDateRange(
    taskStore.filters.dateFrom,
    taskStore.filters.dateTo
  )
}

function onPresetChange(presetIndex) {
  if (presetIndex !== null && presetIndex !== undefined) {
    const preset = filterPresets.value[presetIndex]
    if (preset) {
      taskStore.applyFilterPreset(preset)
    }
  } else {
    selectedPreset.value = null
  }
}

function clearAllFilters() {
  taskStore.clearFilters()
  searchTerm.value = ''
  selectedPreset.value = null
}

function clearFilter(filterKey) {
  taskStore.clearFilter(filterKey)
  if (filterKey === 'search') {
    searchTerm.value = ''
  }
}

function removeTag(tag) {
  const currentTags = [...taskStore.filters.tags]
  const index = currentTags.indexOf(tag)
  if (index > -1) {
    currentTags.splice(index, 1)
    taskStore.updateFilters({ tags: currentTags })
  }
}

function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}

// Watch for search term changes and sync with store
watch(
  () => taskStore.filters.search,
  (newValue) => {
    searchTerm.value = newValue
  }
)

// Watch for filter changes and clear preset selection
watch(
  () => taskStore.activeFiltersCount,
  () => {
    // If filters are manually changed, clear preset selection
    const currentPreset =
      selectedPreset.value !== null
        ? filterPresets.value[selectedPreset.value]
        : null
    if (currentPreset) {
      // Check if current filters match the selected preset
      const presetMatches = Object.keys(currentPreset.filters).every((key) => {
        return taskStore.filters[key] === currentPreset.filters[key]
      })
      if (!presetMatches) {
        selectedPreset.value = null
      }
    }
  }
)

onMounted(() => {
  // Initialize task store socket listeners
  taskStore.initializeSocketListeners()

  // Fetch initial data
  taskStore.fetchTasks({ limit: 5 })

  // Sync search term with store
  searchTerm.value = taskStore.filters.search
})

// Cleanup on unmount
onUnmounted(() => {
  taskStore.cleanup()
})
</script>

<style scoped>
.equal-height-chart {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.equal-height-chart .v-card-text {
  flex: 1;
  display: flex;
  align-items: center;
}

.filter-panel {
  background: rgba(var(--v-theme-surface), 0.8);
  backdrop-filter: blur(10px);
}

.page-title {
  font-size: 2rem;
  font-weight: 300;
  color: rgb(var(--v-theme-on-surface));
}

/* Filter chips styling */
.v-chip-group {
  gap: 8px;
}

.v-chip {
  margin: 2px;
}

/* Search field styling */
.v-text-field {
  transition: all 0.3s ease;
}

.v-text-field:focus-within {
  transform: scale(1.02);
}

/* Filter panel animation */
.v-expand-transition-enter-active,
.v-expand-transition-leave-active {
  transition: all 0.3s ease;
}

.v-expand-transition-enter-from,
.v-expand-transition-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
