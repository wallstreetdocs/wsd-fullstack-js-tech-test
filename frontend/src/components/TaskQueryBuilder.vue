<!--
/**
 * @fileoverview Advanced task query builder component with comprehensive filtering options
 * @component TaskQueryBuilder
 * @description Dynamic form interface for building complex task queries using all API capabilities
 * @emits {Object} query-updated - Emitted when query parameters change
 * @emits {Object} search-executed - Emitted when search is performed
 */
-->

<template>
  <v-card class="query-builder">
    <v-card-title class="d-flex align-center">
      <v-icon left>mdi-filter-variant</v-icon>
      Advanced Query Builder
      <v-spacer></v-spacer>
      <v-btn
        size="small"
        variant="text"
        @click="toggleExpanded"
        :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"
      ></v-btn>
    </v-card-title>

    <v-expand-transition>
      <div v-show="expanded">
        <v-card-text>
          <v-form ref="queryForm" v-model="formValid">
            <!-- Text Search Section -->
            <v-expansion-panels v-model="activePanels" multiple>
              <v-expansion-panel value="text-search">
                <v-expansion-panel-title>
                  <v-icon left>mdi-text-search</v-icon>
                  Text Search
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="query.search"
                        label="Search in title and description"
                        placeholder="Enter search terms..."
                        clearable
                        @update:model-value="updateQuery"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="query.title"
                        label="Title filter (regex)"
                        placeholder="Filter by title..."
                        clearable
                        @update:model-value="updateQuery"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="query.description"
                        label="Description filter (regex)"
                        placeholder="Filter by description..."
                        clearable
                        @update:model-value="updateQuery"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Status and Priority Section -->
              <v-expansion-panel value="status-priority">
                <v-expansion-panel-title>
                  <v-icon left>mdi-tag-multiple</v-icon>
                  Status & Priority
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-select
                        v-model="query.status"
                        :items="statusOptions"
                        label="Status"
                        multiple
                        chips
                        clearable
                        @update:model-value="updateQuery"
                      ></v-select>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-select
                        v-model="query.priority"
                        :items="priorityOptions"
                        label="Priority"
                        multiple
                        chips
                        clearable
                        @update:model-value="updateQuery"
                      ></v-select>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-switch
                        v-model="query.isCompleted"
                        label="Completion Status"
                        :true-value="true"
                        :false-value="false"
                        :indeterminate="query.isCompleted === null"
                        @update:model-value="updateQuery"
                      ></v-switch>
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Date Ranges Section -->
              <v-expansion-panel value="date-ranges">
                <v-expansion-panel-title>
                  <v-icon left>mdi-calendar-range</v-icon>
                  Date Ranges
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-card variant="outlined" class="pa-3">
                        <v-card-title class="text-subtitle-2"
                          >Created Date Range</v-card-title
                        >
                        <v-row>
                          <v-col cols="6">
                            <v-text-field
                              v-model="query.createdAtRange.start"
                              label="Start Date"
                              type="date"
                              clearable
                              @update:model-value="updateQuery"
                            ></v-text-field>
                          </v-col>
                          <v-col cols="6">
                            <v-text-field
                              v-model="query.createdAtRange.end"
                              label="End Date"
                              type="date"
                              clearable
                              @update:model-value="updateQuery"
                            ></v-text-field>
                          </v-col>
                        </v-row>
                      </v-card>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-card variant="outlined" class="pa-3">
                        <v-card-title class="text-subtitle-2"
                          >Updated Date Range</v-card-title
                        >
                        <v-row>
                          <v-col cols="6">
                            <v-text-field
                              v-model="query.updatedAtRange.start"
                              label="Start Date"
                              type="date"
                              clearable
                              @update:model-value="updateQuery"
                            ></v-text-field>
                          </v-col>
                          <v-col cols="6">
                            <v-text-field
                              v-model="query.updatedAtRange.end"
                              label="End Date"
                              type="date"
                              clearable
                              @update:model-value="updateQuery"
                            ></v-text-field>
                          </v-col>
                        </v-row>
                      </v-card>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-card variant="outlined" class="pa-3">
                        <v-card-title class="text-subtitle-2"
                          >Completed Date Range</v-card-title
                        >
                        <v-row>
                          <v-col cols="6">
                            <v-text-field
                              v-model="query.completedAtRange.start"
                              label="Start Date"
                              type="date"
                              clearable
                              @update:model-value="updateQuery"
                            ></v-text-field>
                          </v-col>
                          <v-col cols="6">
                            <v-text-field
                              v-model="query.completedAtRange.end"
                              label="End Date"
                              type="date"
                              clearable
                              @update:model-value="updateQuery"
                            ></v-text-field>
                          </v-col>
                        </v-row>
                      </v-card>
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Time Ranges Section -->
              <v-expansion-panel value="time-ranges">
                <v-expansion-panel-title>
                  <v-icon left>mdi-clock-outline</v-icon>
                  Time Ranges
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-card variant="outlined" class="pa-3">
                        <v-card-title class="text-subtitle-2"
                          >Estimated Time Range (minutes)</v-card-title
                        >
                        <v-row>
                          <v-col cols="6">
                            <v-text-field
                              v-model.number="query.estimatedTimeRange.min"
                              label="Min Time"
                              type="number"
                              min="0"
                              clearable
                              @update:model-value="updateQuery"
                            ></v-text-field>
                          </v-col>
                          <v-col cols="6">
                            <v-text-field
                              v-model.number="query.estimatedTimeRange.max"
                              label="Max Time"
                              type="number"
                              min="0"
                              clearable
                              @update:model-value="updateQuery"
                            ></v-text-field>
                          </v-col>
                        </v-row>
                      </v-card>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-card variant="outlined" class="pa-3">
                        <v-card-title class="text-subtitle-2"
                          >Actual Time Range (minutes)</v-card-title
                        >
                        <v-row>
                          <v-col cols="6">
                            <v-text-field
                              v-model.number="query.actualTimeRange.min"
                              label="Min Time"
                              type="number"
                              min="0"
                              clearable
                              @update:model-value="updateQuery"
                            ></v-text-field>
                          </v-col>
                          <v-col cols="6">
                            <v-text-field
                              v-model.number="query.actualTimeRange.max"
                              label="Max Time"
                              type="number"
                              min="0"
                              clearable
                              @update:model-value="updateQuery"
                            ></v-text-field>
                          </v-col>
                        </v-row>
                      </v-card>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-switch
                        v-model="query.hasEstimatedTime"
                        label="Has Estimated Time"
                        :true-value="true"
                        :false-value="false"
                        :indeterminate="query.hasEstimatedTime === null"
                        @update:model-value="updateQuery"
                      ></v-switch>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-switch
                        v-model="query.hasActualTime"
                        label="Has Actual Time"
                        :true-value="true"
                        :false-value="false"
                        :indeterminate="query.hasActualTime === null"
                        @update:model-value="updateQuery"
                      ></v-switch>
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Time Efficiency Section -->
              <v-expansion-panel value="time-efficiency">
                <v-expansion-panel-title>
                  <v-icon left>mdi-trending-up</v-icon>
                  Time Efficiency
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-select
                        v-model="query.timeEfficiency"
                        :items="timeEfficiencyOptions"
                        label="Time Efficiency"
                        clearable
                        @update:model-value="updateQuery"
                      ></v-select>
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Custom Conditions Section -->
              <v-expansion-panel value="custom-conditions">
                <v-expansion-panel-title>
                  <v-icon left>mdi-code-json</v-icon>
                  Custom MongoDB Conditions
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-textarea
                        v-model="customWhere"
                        label="Custom WHERE conditions (JSON)"
                        placeholder='{"title": {"$regex": "urgent", "$options": "i"}}'
                        rows="3"
                        clearable
                        @update:model-value="updateCustomConditions"
                      ></v-textarea>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-textarea
                        v-model="customOrWhere"
                        label="Custom OR conditions (JSON array)"
                        placeholder='[{"status": "pending"}, {"priority": "high"}]'
                        rows="3"
                        clearable
                        @update:model-value="updateCustomConditions"
                      ></v-textarea>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-textarea
                        v-model="customAndWhere"
                        label="Custom AND conditions (JSON array)"
                        placeholder='[{"status": "completed"}, {"priority": "high"}]'
                        rows="3"
                        clearable
                        @update:model-value="updateCustomConditions"
                      ></v-textarea>
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>

              <!-- Sorting and Pagination Section -->
              <v-expansion-panel value="sorting-pagination">
                <v-expansion-panel-title>
                  <v-icon left>mdi-sort-variant</v-icon>
                  Sorting & Pagination
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row>
                    <v-col cols="12" md="3">
                      <v-select
                        v-model="query.sortBy"
                        :items="sortOptions"
                        label="Sort by"
                        @update:model-value="updateQuery"
                      ></v-select>
                    </v-col>
                    <v-col cols="12" md="3">
                      <v-select
                        v-model="query.sortOrder"
                        :items="orderOptions"
                        label="Sort order"
                        @update:model-value="updateQuery"
                      ></v-select>
                    </v-col>
                    <v-col cols="12" md="3">
                      <v-text-field
                        v-model.number="query.page"
                        label="Page"
                        type="number"
                        min="1"
                        @update:model-value="updateQuery"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" md="3">
                      <v-text-field
                        v-model.number="query.limit"
                        label="Items per page"
                        type="number"
                        min="1"
                        max="100"
                        @update:model-value="updateQuery"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="query.select"
                        label="Select fields (comma-separated)"
                        placeholder="title,status,priority"
                        clearable
                        @update:model-value="updateQuery"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>

            <!-- Action Buttons -->
            <v-row class="mt-4">
              <v-col cols="12" class="d-flex gap-2">
                <v-btn
                  color="primary"
                  @click="executeSearch"
                  :loading="loading"
                  :disabled="!formValid"
                >
                  <v-icon left>mdi-magnify</v-icon>
                  Search
                </v-btn>
                <v-btn variant="outlined" @click="clearQuery">
                  <v-icon left>mdi-refresh</v-icon>
                  Clear
                </v-btn>
                <v-btn variant="outlined" @click="saveQuery">
                  <v-icon left>mdi-content-save</v-icon>
                  Save Query
                </v-btn>
                <v-btn variant="outlined" @click="loadQuery">
                  <v-icon left>mdi-folder-open</v-icon>
                  Load Query
                </v-btn>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
      </div>
    </v-expand-transition>

    <!-- Saved Queries Dialog -->
    <v-dialog v-model="showSavedQueries" max-width="600">
      <v-card>
        <v-card-title>Saved Queries</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item
              v-for="(savedQuery, index) in savedQueries"
              :key="index"
              @click="loadSavedQuery(savedQuery)"
            >
              <v-list-item-title>{{ savedQuery.name }}</v-list-item-title>
              <v-list-item-subtitle>{{
                savedQuery.description
              }}</v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  size="small"
                  @click.stop="deleteSavedQuery(index)"
                ></v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showSavedQueries = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Save Query Dialog -->
    <v-dialog v-model="showSaveDialog" max-width="400">
      <v-card>
        <v-card-title>Save Query</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="queryName"
            label="Query Name"
            required
          ></v-text-field>
          <v-textarea
            v-model="queryDescription"
            label="Description (optional)"
            rows="2"
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showSaveDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="confirmSaveQuery">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'

// Props
const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits([
  'update:modelValue',
  'query-updated',
  'search-executed'
])

// Reactive state
const expanded = ref(false)
const loading = ref(false)
const formValid = ref(true)
const activePanels = ref(['text-search', 'status-priority'])
const showSavedQueries = ref(false)
const showSaveDialog = ref(false)
const queryName = ref('')
const queryDescription = ref('')
const customWhere = ref('')
const customOrWhere = ref('')
const customAndWhere = ref('')

// Query state
const query = reactive({
  // Text search
  search: '',
  title: '',
  description: '',

  // Status and priority
  status: [],
  priority: [],
  isCompleted: null,

  // Date ranges
  createdAtRange: { start: '', end: '' },
  updatedAtRange: { start: '', end: '' },
  completedAtRange: { start: '', end: '' },

  // Time ranges
  estimatedTimeRange: { min: null, max: null },
  actualTimeRange: { min: null, max: null },
  hasEstimatedTime: null,
  hasActualTime: null,

  // Time efficiency
  timeEfficiency: '',

  // Custom conditions
  where: null,
  orWhere: null,
  andWhere: null,

  // Sorting and pagination
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  limit: 10,
  select: ''
})

// Saved queries
const savedQueries = ref([])

// Options for selects
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

const timeEfficiencyOptions = [
  { title: 'Over-estimated', value: 'over-estimated' },
  { title: 'Under-estimated', value: 'under-estimated' },
  { title: 'Accurate', value: 'accurate' }
]

const sortOptions = [
  { title: 'Created Date', value: 'createdAt' },
  { title: 'Updated Date', value: 'updatedAt' },
  { title: 'Completed Date', value: 'completedAt' },
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
function toggleExpanded() {
  expanded.value = !expanded.value
}

function updateQuery() {
  // Clean up empty values
  const cleanQuery = { ...query }

  // Remove empty string values
  Object.keys(cleanQuery)
    .forEach((key) => {
      if (cleanQuery[key] === '' || cleanQuery[key] === null) {
        delete cleanQuery[key]
      }
    })

    [
      // Clean up date ranges
      ('createdAtRange', 'updatedAtRange', 'completedAtRange')
    ].forEach((rangeKey) => {
      if (cleanQuery[rangeKey]) {
        const range = cleanQuery[rangeKey]
        if (!range.start && !range.end) {
          delete cleanQuery[rangeKey]
        } else {
          if (!range.start) delete range.start
          if (!range.end) delete range.end
        }
      }
    })

    [
      // Clean up time ranges
      ('estimatedTimeRange', 'actualTimeRange')
    ].forEach((rangeKey) => {
      if (cleanQuery[rangeKey]) {
        const range = cleanQuery[rangeKey]
        if (range.min === null && range.max === null) {
          delete cleanQuery[rangeKey]
        } else {
          if (range.min === null) delete range.min
          if (range.max === null) delete range.max
        }
      }
    })

  emit('update:modelValue', cleanQuery)
  emit('query-updated', cleanQuery)
}

function updateCustomConditions() {
  try {
    if (customWhere.value) {
      query.where = JSON.parse(customWhere.value)
    } else {
      query.where = null
    }

    if (customOrWhere.value) {
      query.orWhere = JSON.parse(customOrWhere.value)
    } else {
      query.orWhere = null
    }

    if (customAndWhere.value) {
      query.andWhere = JSON.parse(customAndWhere.value)
    } else {
      query.andWhere = null
    }

    updateQuery()
  } catch (error) {
    console.warn('Invalid JSON in custom conditions:', error)
  }
}

function clearQuery() {
  // Reset all query fields
  Object.keys(query).forEach((key) => {
    if (Array.isArray(query[key])) {
      query[key] = []
    } else if (typeof query[key] === 'object' && query[key] !== null) {
      if (key.includes('Range')) {
        query[key] = { start: '', end: '' }
      } else {
        query[key] = null
      }
    } else if (typeof query[key] === 'string') {
      query[key] = ''
    } else if (typeof query[key] === 'number') {
      if (key === 'page') query[key] = 1
      else if (key === 'limit') query[key] = 10
      else query[key] = null
    } else {
      query[key] = null
    }
  })

  // Reset custom conditions
  customWhere.value = ''
  customOrWhere.value = ''
  customAndWhere.value = ''

  // Reset defaults
  query.sortBy = 'createdAt'
  query.sortOrder = 'desc'

  updateQuery()
}

async function executeSearch() {
  loading.value = true

  try {
    const cleanQuery = { ...query }
    const options = {}

    // Extract pagination and sorting options
    if (cleanQuery.sortBy) {
      options.sortBy = cleanQuery.sortBy
      delete cleanQuery.sortBy
    }
    if (cleanQuery.sortOrder) {
      options.sortOrder = cleanQuery.sortOrder
      delete cleanQuery.sortOrder
    }
    if (cleanQuery.page) {
      options.page = cleanQuery.page
      delete cleanQuery.page
    }
    if (cleanQuery.limit) {
      options.limit = cleanQuery.limit
      delete cleanQuery.limit
    }

    // Clean up empty values but keep arrays intact
    Object.keys(cleanQuery).forEach((key) => {
      if (cleanQuery[key] === '' || cleanQuery[key] === null) {
        delete cleanQuery[key]
      }
    })

    // Clean up empty arrays
    if (Array.isArray(cleanQuery.status) && cleanQuery.status.length === 0) {
      delete cleanQuery.status
    }
    if (Array.isArray(cleanQuery.priority) && cleanQuery.priority.length === 0) {
      delete cleanQuery.priority
    }

    // Clean up empty date ranges
    if (cleanQuery.createdAtRange) {
      if (!cleanQuery.createdAtRange.start && !cleanQuery.createdAtRange.end) {
        delete cleanQuery.createdAtRange
      } else {
        if (!cleanQuery.createdAtRange.start) delete cleanQuery.createdAtRange.start
        if (!cleanQuery.createdAtRange.end) delete cleanQuery.createdAtRange.end
      }
    }

    if (cleanQuery.updatedAtRange) {
      if (!cleanQuery.updatedAtRange.start && !cleanQuery.updatedAtRange.end) {
        delete cleanQuery.updatedAtRange
      } else {
        if (!cleanQuery.updatedAtRange.start) delete cleanQuery.updatedAtRange.start
        if (!cleanQuery.updatedAtRange.end) delete cleanQuery.updatedAtRange.end
      }
    }

    if (cleanQuery.completedAtRange) {
      if (!cleanQuery.completedAtRange.start && !cleanQuery.completedAtRange.end) {
        delete cleanQuery.completedAtRange
      } else {
        if (!cleanQuery.completedAtRange.start) delete cleanQuery.completedAtRange.start
        if (!cleanQuery.completedAtRange.end) delete cleanQuery.completedAtRange.end
      }
    }

    // Clean up empty time ranges
    if (cleanQuery.estimatedTimeRange) {
      if (cleanQuery.estimatedTimeRange.min === null && cleanQuery.estimatedTimeRange.max === null) {
        delete cleanQuery.estimatedTimeRange
      } else {
        if (cleanQuery.estimatedTimeRange.min === null) delete cleanQuery.estimatedTimeRange.min
        if (cleanQuery.estimatedTimeRange.max === null) delete cleanQuery.estimatedTimeRange.max
      }
    }

    if (cleanQuery.actualTimeRange) {
      if (cleanQuery.actualTimeRange.min === null && cleanQuery.actualTimeRange.max === null) {
        delete cleanQuery.actualTimeRange
      } else {
        if (cleanQuery.actualTimeRange.min === null) delete cleanQuery.actualTimeRange.min
        if (cleanQuery.actualTimeRange.max === null) delete cleanQuery.actualTimeRange.max
      }
    }

    emit('search-executed', { filters: cleanQuery, options })
  } catch (error) {
    console.error('Search execution error:', error)
  } finally {
    loading.value = false
  }
}

function saveQuery() {
  showSaveDialog.value = true
}

function confirmSaveQuery() {
  if (!queryName.value.trim()) return

  const savedQuery = {
    name: queryName.value,
    description: queryDescription.value,
    query: { ...query }
  }

  savedQueries.value.push(savedQuery)
  localStorage.setItem('savedQueries', JSON.stringify(savedQueries.value))

  queryName.value = ''
  queryDescription.value = ''
  showSaveDialog.value = false
}

function loadQuery() {
  showSavedQueries.value = true
}

function loadSavedQuery(savedQuery) {
  // Load the saved query into the form
  Object.keys(savedQuery.query).forEach((key) => {
    if (query.hasOwnProperty(key)) {
      query[key] = savedQuery.query[key]
    }
  })

  // Load custom conditions
  if (savedQuery.query.where) {
    customWhere.value = JSON.stringify(savedQuery.query.where, null, 2)
  }
  if (savedQuery.query.orWhere) {
    customOrWhere.value = JSON.stringify(savedQuery.query.orWhere, null, 2)
  }
  if (savedQuery.query.andWhere) {
    customAndWhere.value = JSON.stringify(savedQuery.query.andWhere, null, 2)
  }

  updateQuery()
  showSavedQueries.value = false
}

function deleteSavedQuery(index) {
  savedQueries.value.splice(index, 1)
  localStorage.setItem('savedQueries', JSON.stringify(savedQueries.value))
}

// Load saved queries on mount
onMounted(() => {
  const saved = localStorage.getItem('savedQueries')
  if (saved) {
    try {
      savedQueries.value = JSON.parse(saved)
    } catch (error) {
      console.error('Error loading saved queries:', error)
    }
  }
})

// Watch for prop changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue && Object.keys(newValue).length > 0) {
      Object.keys(newValue).forEach((key) => {
        if (query.hasOwnProperty(key)) {
          query[key] = newValue[key]
        }
      })
    }
  },
  { deep: true, immediate: true }
)
</script>

<style scoped>
.query-builder {
  margin-bottom: 1rem;
}

.gap-2 {
  gap: 0.5rem;
}
</style>
