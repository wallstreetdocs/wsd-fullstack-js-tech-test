<!--
/**
 * @fileoverview Export history component for viewing and managing export records
 * @component ExportHistory
 * @description Displays export history with download capabilities and status tracking
 * @emits {Object} export-downloaded - Emitted when an export is downloaded
 */
-->

<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon left>mdi-history</v-icon>
      Export History
      <v-spacer></v-spacer>
      <v-btn
        size="small"
        variant="outlined"
        @click="refreshHistory"
        :loading="exportStore.loading"
      >
        <v-icon left>mdi-refresh</v-icon>
        Refresh
      </v-btn>
    </v-card-title>

    <v-card-text>
      <!-- Export Statistics -->
      <v-row class="mb-4">
        <v-col cols="12" md="3">
          <v-card variant="outlined" class="text-center">
            <v-card-text>
              <div class="text-h6">
                {{ exportStore.exportStats.summary.total }}
              </div>
              <div class="text-caption">Total Exports</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card variant="outlined" class="text-center">
            <v-card-text>
              <div class="text-h6 text-success">
                {{ exportStore.exportStats.summary.completed }}
              </div>
              <div class="text-caption">Completed</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card variant="outlined" class="text-center">
            <v-card-text>
              <div class="text-h6 text-warning">
                {{ exportStore.exportStats.summary.processing }}
              </div>
              <div class="text-caption">Processing</div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card variant="outlined" class="text-center">
            <v-card-text>
              <div class="text-h6 text-error">
                {{ exportStore.exportStats.summary.failed }}
              </div>
              <div class="text-caption">Failed</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Active Exports -->
      <div v-if="exportStore.activeExports.size > 0" class="mb-4">
        <h3 class="text-subtitle-1 mb-2">Active Exports</h3>
        <v-card
          v-for="[id, exportData] in exportStore.activeExports"
          :key="id"
          variant="outlined"
          class="mb-2"
        >
          <v-card-text class="py-3">
            <div class="d-flex align-center">
              <v-progress-circular
                indeterminate
                size="20"
                color="primary"
                class="mr-3"
              ></v-progress-circular>
              <div class="flex-grow-1">
                <div class="text-body-2">
                  {{ exportData.format.toUpperCase() }} Export
                </div>
                <div class="text-caption text-grey">
                  {{ exportData.progress }}
                </div>
              </div>
              <v-chip
                :color="getStatusColor(exportData.status)"
                size="small"
                variant="flat"
              >
                {{ formatStatus(exportData.status) }}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Export History List -->
      <div
        v-if="exportStore.exports.length === 0 && !exportStore.loading"
        class="text-center py-8"
      >
        <v-icon size="64" color="grey-lighten-1">mdi-history</v-icon>
        <p class="text-grey mt-2">No export history found</p>
      </div>

      <div v-else-if="exportStore.loading" class="text-center py-8">
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
      </div>

      <div v-else>
        <v-list>
          <v-list-item
            v-for="exportRecord in exportStore.exports"
            :key="exportRecord._id"
            class="mb-2"
          >
            <template #prepend>
              <v-icon
                :color="getFormatColor(exportRecord.format)"
                :icon="getFormatIcon(exportRecord.format)"
              ></v-icon>
            </template>

            <v-list-item-title>
              {{ exportRecord.format.toUpperCase() }} Export
            </v-list-item-title>

            <v-list-item-subtitle>
              <div class="d-flex align-center gap-2">
                <span>{{ formatDate(exportRecord.createdAt) }}</span>
                <v-chip
                  :color="getStatusColor(exportRecord.status)"
                  size="x-small"
                  variant="flat"
                >
                  {{ formatStatus(exportRecord.status) }}
                </v-chip>
                <span v-if="exportRecord.recordCount" class="text-caption">
                  {{ exportRecord.recordCount }} records
                </span>
              </div>
            </v-list-item-subtitle>

            <template #append>
              <div class="d-flex gap-2">
                <v-btn
                  v-if="exportRecord.status === 'completed'"
                  size="small"
                  variant="outlined"
                  @click="downloadExport(exportRecord._id)"
                  :loading="downloading === exportRecord._id"
                >
                  <v-icon left size="small">mdi-download</v-icon>
                  Download
                </v-btn>

                <v-btn
                  v-if="exportRecord.status === 'failed'"
                  size="small"
                  variant="text"
                  @click="showError(exportRecord.error)"
                >
                  <v-icon left size="small">mdi-alert</v-icon>
                  Error
                </v-btn>
              </div>
            </template>
          </v-list-item>
        </v-list>
      </div>
    </v-card-text>

    <!-- Error Dialog -->
    <v-dialog v-model="showErrorDialog" max-width="400px">
      <v-card>
        <v-card-title>Export Error</v-card-title>
        <v-card-text>
          <p>{{ errorMessage }}</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="showErrorDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useExportStore } from '../stores/exportStore.js'

const exportStore = useExportStore()

const downloading = ref(null)
const showErrorDialog = ref(false)
const errorMessage = ref('')

function getStatusColor(status) {
  const colors = {
    pending: 'warning',
    processing: 'info',
    completed: 'success',
    failed: 'error'
  }
  return colors[status] || 'grey'
}

function formatStatus(status) {
  return status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function getFormatColor(format) {
  const colors = {
    csv: 'green',
    json: 'blue'
  }
  return colors[format] || 'grey'
}

function getFormatIcon(format) {
  const icons = {
    csv: 'mdi-file-delimited',
    json: 'mdi-code-json'
  }
  return icons[format] || 'mdi-file'
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString()
}

async function downloadExport(exportId) {
  downloading.value = exportId

  try {
    await exportStore.downloadExport(exportId)
    // Could emit event here if needed
  } catch (error) {
    console.error('Error downloading export:', error)
  } finally {
    downloading.value = null
  }
}

function showError(error) {
  errorMessage.value = error
  showErrorDialog.value = true
}

async function refreshHistory() {
  await exportStore.fetchExportHistory()
  await exportStore.fetchExportStats()
}

onMounted(() => {
  refreshHistory()
  exportStore.initializeSocketListeners()
})
</script>

<style scoped>
.gap-2 {
  gap: 0.5rem;
}
</style>
