<template>
  <div>
    <h2 class="mb-4">Export History</h2>
    <v-data-table
      :headers="headers"
      :items="history"
      :loading="loading"
      class="elevation-1"
      item-key="_id"
    >
      <template #item.filters="{ item }">
        <span>{{ summarizeFilters(item.filters) }}</span>
      </template>
      <template #item.createdAt="{ item }">
        <span>{{ formatDate(item.createdAt) }}</span>
      </template>
      <template #item.count="{ item }">
        <span>Item's({{ item.count }})</span>
      </template>
      <template #item.downloadCount="{ item }">
        <span>Export's({{ item.downloadCount }})</span>
      </template>
      <template #item.download="{ item }">
        <v-btn
          @click="downloadExport(item)"
          color="primary"
          size="small"
          :loading="downloadingId === item._id"
        >
          Download
        </v-btn>
      </template>
    </v-data-table>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import apiClient, { API_BASE_URL } from '../api/client.js'

const headers = [
  { text: 'Format', value: 'format' },
  { text: 'Filters', value: 'filters' },
  { text: 'Exported At', value: 'createdAt' },
  { text: 'Item Count', value: 'count' },
  { text: 'Export', value: 'downloadCount' },
  { text: 'Download', value: 'download', sortable: false }
]

const history = ref([])
const loading = ref(false)
const downloadingId = ref(null)

function summarizeFilters(filters) {
  if (!filters) return '-'
  return Object.entries(filters)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')
}

function formatDate(date) {
  return new Date(date).toLocaleString()
}

async function fetchHistory() {
  loading.value = true
  try {
    const res = await apiClient.get('/exports/history')
    history.value = res.data || res // support both {data:[]} and []
  } catch (err) {
    history.value = []
  } finally {
    loading.value = false
  }
}

async function downloadExport(item) {
  downloadingId.value = item._id
  try {
    const response = await fetch(`${API_BASE_URL}/${item.filePath}`)
    if (!response.ok) throw new Error('Failed to download export file')
    const blob = await response.blob()
    const ext = item.format === 'json' ? 'json' : 'csv'
    const filename = `tasks-export-${item._id}.${ext}`
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    alert('Download failed: ' + err.message)
  } finally {
    downloadingId.value = null
  }
}

onMounted(fetchHistory)
</script>
