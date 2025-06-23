<template>
  <div class="mt-4">
    <v-card>
      <v-card-title class="d-flex align-center">
        <div>Export Activity Log</div>
        <v-spacer></v-spacer>
        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          label="Search"
          single-line
          hide-details
          density="compact"
          class="search-field"
        ></v-text-field>
      </v-card-title>

      <v-data-table
        :headers="headers"
        :items="exportJobs"
        :search="search"
        :loading="loading"
        loading-text="Loading export history..."
      >
        <template #item.format="{ item }">
          <v-chip :color="getFormatColor(item.format)" size="small">
            {{ item.format.toUpperCase() }}
          </v-chip>
        </template>

        <template #item.status="{ item }">
          <v-chip :color="getStatusColor(item.status)" size="small">
            {{ item.status }}
          </v-chip>
        </template>

        <template #item.progress="{ item }">
          <export-progress-bar
            v-if="['processing', 'paused'].includes(item.status)"
            :progress="item.progress"
            :status="item.status"
            :jobId="item._id"
            :simple="true"
            @pause="pauseExport"
            @resume="resumeExport"
          />
          <span v-else>{{ item.progress }}%</span>
        </template>

        <template #item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>

        <template #item.filters="{ item }">
          <v-tooltip>
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-information-outline"
                size="small"
                variant="text"
              ></v-btn>
            </template>
            <div>
              <strong>Filters:</strong>
              <ul class="ps-4 mb-0">
                <!-- Basic filters -->
                <li v-if="item.filters?.status">
                  Status: {{ item.filters.status }}
                </li>
                <li v-if="item.filters?.priority">
                  Priority: {{ item.filters.priority }}
                </li>
                <li v-if="item.filters?.sortBy">
                  Sort by: {{ item.filters.sortBy }}
                </li>
                <li v-if="item.filters?.sortOrder">
                  Order: {{ item.filters.sortOrder }}

                  <!-- Advanced filters -->
                </li>

                <li v-if="item.filters?.search">
                  Search: "{{ item.filters.search }}"

                  <!-- Date filters -->
                </li>

                <li v-if="item.filters?.createdAfter">
                  Created after: {{ formatDate(item.filters.createdAfter) }}
                </li>
                <li v-if="item.filters?.createdBefore">
                  Created before: {{ formatDate(item.filters.createdBefore) }}
                </li>
                <li v-if="item.filters?.completedAfter">
                  Completed after: {{ formatDate(item.filters.completedAfter) }}
                </li>
                <li v-if="item.filters?.completedBefore">
                  Completed before:
                  {{ formatDate(item.filters.completedBefore) }}

                  <!-- Time estimate filters -->
                </li>

                <li v-if="item.filters?.estimatedTimeLt">
                  Estimated time less than:
                  {{ item.filters.estimatedTimeLt }} minutes
                </li>
                <li v-if="item.filters?.estimatedTimeGte">
                  Estimated time at least:
                  {{ item.filters.estimatedTimeGte }} minutes
                </li>
              </ul>
            </div>
          </v-tooltip>
        </template>

        <template #item.actions="{ item }">
          <v-tooltip text="Download">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon
                variant="text"
                size="small"
                :disabled="item.status !== 'completed'"
                @click="downloadExport(item._id)"
              >
                <v-icon>mdi-download</v-icon>
              </v-btn>
            </template>
          </v-tooltip>

          <v-tooltip text="Pause">
            <template #activator="{ props }">
              <v-btn
                v-if="item.status === 'processing'"
                v-bind="props"
                icon
                variant="text"
                size="small"
                @click="pauseExport(item._id)"
              >
                <v-icon>mdi-pause</v-icon>
              </v-btn>
            </template>
          </v-tooltip>

          <v-tooltip text="Resume">
            <template #activator="{ props }">
              <v-btn
                v-if="item.status === 'paused'"
                v-bind="props"
                icon
                variant="text"
                size="small"
                @click="resumeExport(item._id)"
              >
                <v-icon>mdi-play</v-icon>
              </v-btn>
            </template>
          </v-tooltip>

          <v-tooltip text="Retry">
            <template #activator="{ props }">
              <v-btn
                v-if="item.status === 'failed' || item.status === 'connection-error'"
                v-bind="props"
                icon
                variant="text"
                size="small"
                @click="retryExport(item._id)"
              >
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useExportStore } from '../stores/exportStore'
import ExportProgressBar from './ExportProgressBar.vue'

const exportStore = useExportStore()
const search = ref('')
const loading = ref(true)

const headers = [
  { title: 'Format', key: 'format', align: 'start' },
  { title: 'Status', key: 'status', align: 'start' },
  { title: 'Progress', key: 'progress', align: 'start' },
  { title: 'Created At', key: 'createdAt', align: 'start' },
  { title: 'Filters', key: 'filters', align: 'center', sortable: false },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false }
]

const exportJobs = computed(() => {
  console.log('Export jobs in component:', exportStore.exportHistory)
  return Array.isArray(exportStore.exportHistory)
    ? exportStore.exportHistory
    : []
})

onMounted(async () => {
  try {
    const response = await exportStore.getExportHistory()
    console.log('Direct API response:', response)

    // Log the first export job to see its structure
    if (exportStore.exportHistory && exportStore.exportHistory.length > 0) {
      console.log('Sample export job item:', exportStore.exportHistory[0])
    }

    loading.value = false
  } catch (err) {
    console.error('Error in component:', err)
    loading.value = false
  }
})

function downloadExport(id) {
  console.log('Download export ID:', id)
  exportStore.downloadExport(id)
}

function pauseExport(id) {
  console.log('Pause export ID:', id)
  exportStore.pauseExport(id)
}

function resumeExport(id) {
  console.log('Resume export ID:', id)
  exportStore.resumeExport(id)
}

function retryExport(id) {
  console.log('Retry export ID:', id)
  exportStore.retryExport(id)
}

function getStatusColor(status) {
  const colorMap = {
    pending: 'grey',
    processing: 'info',
    completed: 'success',
    failed: 'error',
    paused: 'warning',
    'connection-error': 'red-darken-4',
    reconnecting: 'amber-darken-3'
  }
  return colorMap[status] || 'grey'
}

function getFormatColor(format) {
  const colorMap = {
    csv: 'green',
    json: 'blue',
    excel: 'indigo',
    pdf: 'red'
  }
  return colorMap[format] || 'grey'
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}
</script>

<style scoped>
.search-field {
  max-width: 300px;
}
</style>
