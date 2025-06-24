<template>
  <v-card class="mb-4">
    <v-card-title class="d-flex align-center">
      <v-icon class="me-2">mdi-filter</v-icon>
      Filters
      <v-spacer></v-spacer>
      <v-btn
        variant="text"
        size="small"
        :disabled="!hasActiveFilters"
        @click="clearAllFilters"
      >
        Clear All
      </v-btn>
    </v-card-title>

    <v-card-text>
      <v-row dense>
        <!-- Search -->
        <v-col cols="12" md="4">
          <v-text-field
            v-model="localFilters.search"
            label="Search tasks..."
            placeholder="Search by title or description"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            clearable
            @input="onSearchChange"
          />
        </v-col>

        <!-- Status Filter -->
        <v-col cols="12" sm="6" md="2">
          <v-select
            v-model="localFilters.status"
            label="Status"
            :items="statusOptions"
            variant="outlined"
            density="compact"
            clearable
            @update:model-value="onFiltersChange"
          />
        </v-col>

        <!-- Priority Filter -->
        <v-col cols="12" sm="6" md="2">
          <v-select
            v-model="localFilters.priority"
            label="Priority"
            :items="priorityOptions"
            variant="outlined"
            density="compact"
            clearable
            @update:model-value="onFiltersChange"
          />
        </v-col>

        <!-- Start Date -->
        <v-col cols="12" sm="6" md="2">
          <v-text-field
            v-model="localFilters.startDate"
            label="Start Date"
            type="date"
            variant="outlined"
            density="compact"
            clearable
            @update:model-value="onFiltersChange"
          />
        </v-col>

        <!-- End Date -->
        <v-col cols="12" sm="6" md="2">
          <v-text-field
            v-model="localFilters.endDate"
            label="End Date"
            type="date"
            variant="outlined"
            density="compact"
            clearable
            @update:model-value="onFiltersChange"
          />
        </v-col>
      </v-row>

      <!-- Sort Options -->
      <v-row dense class="mt-2">
        <v-col cols="12" sm="6" md="3">
          <v-select
            v-model="localFilters.sortBy"
            label="Sort By"
            :items="sortByOptions"
            variant="outlined"
            density="compact"
            @update:model-value="onFiltersChange"
          />
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-select
            v-model="localFilters.sortOrder"
            label="Sort Order"
            :items="sortOrderOptions"
            variant="outlined"
            density="compact"
            @update:model-value="onFiltersChange"
          />
        </v-col>

        <v-col cols="12" md="6" class="d-flex align-center">
          <v-chip-group v-if="hasActiveFilters" class="flex-wrap">
            <v-chip
              v-if="localFilters.search"
              closable
              size="small"
              @click:close="clearFilter('search')"
            >
              Search: {{ localFilters.search }}
            </v-chip>
            <v-chip
              v-if="localFilters.status"
              closable
              size="small"
              @click:close="clearFilter('status')"
            >
              Status: {{ getStatusLabel(localFilters.status) }}
            </v-chip>
            <v-chip
              v-if="localFilters.priority"
              closable
              size="small"
              @click:close="clearFilter('priority')"
            >
              Priority: {{ getPriorityLabel(localFilters.priority) }}
            </v-chip>
            <v-chip
              v-if="localFilters.startDate"
              closable
              size="small"
              @click:close="clearFilter('startDate')"
            >
              From: {{ formatDate(localFilters.startDate) }}
            </v-chip>
            <v-chip
              v-if="localFilters.endDate"
              closable
              size="small"
              @click:close="clearFilter('endDate')"
            >
              To: {{ formatDate(localFilters.endDate) }}
            </v-chip>
          </v-chip-group>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useTaskStore } from '../stores/taskStore'
import { debounce } from 'lodash'

const taskStore = useTaskStore()

// Local filters state
const localFilters = ref({
  search: '',
  status: '',
  priority: '',
  startDate: '',
  endDate: '',
  sortBy: 'createdAt',
  sortOrder: 'desc'
})

// Filter options
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

const sortByOptions = [
  { title: 'Created Date', value: 'createdAt' },
  { title: 'Updated Date', value: 'updatedAt' },
  { title: 'Title', value: 'title' },
  { title: 'Priority', value: 'priority' },
  { title: 'Status', value: 'status' }
]

const sortOrderOptions = [
  { title: 'Newest First', value: 'desc' },
  { title: 'Oldest First', value: 'asc' }
]

// Computed
const hasActiveFilters = computed(() => {
  return (
    localFilters.value.search ||
    localFilters.value.status ||
    localFilters.value.priority ||
    localFilters.value.startDate ||
    localFilters.value.endDate ||
    localFilters.value.sortBy !== 'createdAt' ||
    localFilters.value.sortOrder !== 'desc'
  )
})

// Methods
const onFiltersChange = () => {
  taskStore.updateFilters(localFilters.value)
}

const onSearchChange = debounce(() => {
  onFiltersChange()
}, 500)

const clearFilter = (filterKey) => {
  if (filterKey === 'sortBy') {
    localFilters.value[filterKey] = 'createdAt'
  } else if (filterKey === 'sortOrder') {
    localFilters.value[filterKey] = 'desc'
  } else {
    localFilters.value[filterKey] = ''
  }
  onFiltersChange()
}

const clearAllFilters = () => {
  localFilters.value = {
    search: '',
    status: '',
    priority: '',
    startDate: '',
    endDate: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }
  taskStore.clearFilters()
}

const getStatusLabel = (status) => {
  const option = statusOptions.find((opt) => opt.value === status)
  return option ? option.title : status
}

const getPriorityLabel = (priority) => {
  const option = priorityOptions.find((opt) => opt.value === priority)
  return option ? option.title : priority
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString()
}

// Initialize local filters from store
onMounted(() => {
  localFilters.value = { ...taskStore.filters }
})

// Watch store filters and update local state
watch(
  () => taskStore.filters,
  (newFilters) => {
    localFilters.value = { ...newFilters }
  },
  { deep: true }
)
</script>

<style scoped>
.advanced-filters {
  margin-bottom: 20px;
}
</style>
