<template>
  <div class="export-manager">
    <div class="d-flex justify-space-between align-center mb-4">
      <h2>Export Manager</h2>
      <v-btn color="primary" @click="showDialog = true">
        Create Export
      </v-btn>
    </div>

    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>

    <div v-else-if="error" class="text-center py-8">
      <v-alert type="error">{{ error }}</v-alert>
    </div>

    <div v-else-if="exportsList.length === 0" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-1">mdi-file-export</v-icon>
      <p class="text-grey mt-2">No exports found</p>
    </div>

    <v-dialog v-model="showDialog" max-width="600" persistent>
      <v-card>
        <v-card-title>Create New Export</v-card-title>

        <v-card-text>
          <v-form ref="form" v-model="valid" @submit.prevent="createExport">
            <v-select
                v-model="formData.format"
                :items="formatOptions"
                label="Export Format"
                :rules="formatRules"
                required
                variant="outlined"
                class="mb-3"
            ></v-select>

            <v-select
                v-model="formData.filters.status"
                :items="statusOptions"
                label="Status Filter"
                variant="outlined"
                clearable
                class="mb-3"
            ></v-select>

            <v-select
                v-model="formData.filters.priority"
                :items="priorityOptions"
                label="Priority Filter"
                variant="outlined"
                clearable
                class="mb-3"
            ></v-select>

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                    v-model="formData.filters.dateRange.start"
                    label="Start Date"
                    type="date"
                    variant="outlined"
                ></v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                    v-model="formData.filters.dateRange.end"
                    label="End Date"
                    type="date"
                    variant-text-field/>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="closeDialog">Cancel</v-btn>
          <v-btn
              color="primary"
              :loading="loading"
              :disabled="!valid"
              @click="createExport"
          >
            Create Export
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showDetailsDialog" max-width="500">
      <v-card v-if="selected">
        <v-card-title>Export Details</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Reference ID</v-list-item-title>
              <v-list-item-subtitle>{{ selected._id.slice(-8).toUpperCase() }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Format</v-list-item-title>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Status</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip :color="getStatusColor(selected.status)" size="small">
                  {{ selected.status }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item v-if="selected.filters">
              <v-list-item-title>Filters Applied</v-list-item-title>
              <v-list-item-subtitle>
                <div v-for="(value, key) in selected.filters" :key="key">
                  <strong>{{ key }}:</strong> {{ value }}
                </div>
              </v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title>Created At</v-list-item-title>
              <v-list-item-subtitle>{{ new Date(selected.createdAt).toLocaleString() }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
              v-if="selected.status === 'completed'"
              color="primary"
              @click="downloadFile(selected._id, selected.format)"
          >
            Download
          </v-btn>
          <v-btn @click="showDetailsDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-table>
      <thead>
      <tr>
        <th>Reference</th>
        <th>Format</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="exp in exportsList" :key="exp._id">
        <td class="text-uppercase">{{ exp._id.slice(-8) }}</td>
        <td class="text-capitalize">{{ exp.format.toUpperCase() }}</td>
        <td>
          <v-chip
              :color="getStatusColor(exp.status)"
              size="small"
          >
            {{ exp.status }}
          </v-chip>
        </td>
        <td>
          <v-btn
              icon="mdi-information"
              size="small"
              variant="text"
              @click="viewDetails(exp._id)"
          ></v-btn>
          <v-btn
              v-if="exp.status === 'completed'"
              icon="mdi-download"
              size="small"
              variant="text"
              @click="downloadFile(exp._id, exp.format)"
          ></v-btn>
        </td>
      </tr>
      </tbody>
    </v-table>

    <div class="d-flex justify-center mt-4">
      <v-pagination
          v-model="page"
          :length="totalPages"
          @update:model-value="loadHistory"
      ></v-pagination>
    </div>
  </div>
</template>

<script setup>
import {ref, reactive, onMounted} from 'vue'
import api from '../api/client.js'

const showDialog = ref(false)
const form = ref(null)
const valid = ref(false)
const loading = ref(false)
const exportsList = ref([])
const page = ref(1)
const totalPages = ref(1)
const showDetailsDialog = ref(false)
const selected = ref(null)
const error = ref(null)

const formData = reactive({
  format: 'csv',
  filters: {
    status: '',
    priority: '',
    dateRange: {
      start: '',
      end: ''
    }
  }
})

const formatOptions = [
  { title: 'CSV', value: 'csv' },
  { title: 'Excel', value: 'xlsx' },
  { title: 'JSON', value: 'json' }
]

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

const formatRules = [(v) => !!v || 'Format is required']

function getStatusColor(status) {
  switch (status) {
    case 'completed': return 'success'
    case 'processing': return 'warning'
    case 'failed': return 'error'
    default: return 'info'
  }
}

async function loadHistory(newPage) {
  loading.value = true
  error.value = null

  try {
    const { data } = await api.getExportHistory({
      page: newPage,
      limit: 10
    })
    exportsList.value = data.exports
    totalPages.value = data.pagination.pages
  } catch (err) {
    error.value = 'Failed to load exports'
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function createExport() {
  if (!form.value?.validate()) return

  loading.value = true
  try {
    const cleanFilters = {}
    if (formData.filters.status) cleanFilters.status = formData.filters.status
    if (formData.filters.priority) cleanFilters.priority = formData.filters.priority
    if (formData.filters.dateRange.start && formData.filters.dateRange.end) {
      cleanFilters.dateRange = formData.filters.dateRange
    }

    await api.createExport({
      format: formData.format,
      filters: cleanFilters
    })

    closeDialog()
    await loadHistory(1)
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

function closeDialog() {
  showDialog.value = false
  formData.format = 'csv'
  formData.filters.status = ''
  formData.filters.priority = ''
  formData.filters.dateRange.start = ''
  formData.filters.dateRange.end = ''
  if (form.value) {
    form.value.resetValidation()
  }
  selected.value = null
}

async function viewDetails(id) {
  try {
    const { data } = await api.getExport(id)
    selected.value = data
    showDetailsDialog.value = true
  } catch (err) {
    console.error('Failed to load details:', err)
  }
}

async function downloadFile(id, format) {
  try {
    const file = await api.downloadExport(id, format)
    const blob = format === 'json'
      ? new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
      : file
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `export.${format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
  } catch (err) {
    console.error('Download failed:', err)
  }
}

onMounted(loadHistory)
</script>

<style scoped>
.export-manager {
  padding: 1.5rem;
}

.v-table {
  background: transparent !important;
}

.v-table > .v-table__wrapper > table {
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Make the table more compact */
.v-table td,
.v-table th {
  padding: 12px 16px !important;
}

.export-form {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-weight: 500;
}

.form-field input,
.form-field select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.btn-create,
.btn-cleanup {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-create {
  background: #4CAF50;
  color: white;
}

.btn-cleanup {
  background: #f44336;
  color: white;
}

.export-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  background: white;
}

.export-table th,
.export-table td {
  border: 1px solid #ddd;
  padding: 0.75rem;
  text-align: left;
}

.export-table th {
  background: #f5f5f5;
  font-weight: 500;
}

.pagination {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin: 1rem 0;
}

.pagination button {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-details {
  margin-top: 1rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 4px;
}

.export-details code {
  background: #eee;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
}
</style>