import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ExportProgressBar from '../../src/components/ExportProgressBar.vue'

// Mock Vuetify components
const VCard = { template: '<div class="v-card"><slot /></div>' }
const VCardText = { template: '<div class="v-card-text"><slot /></div>' }
const VProgressLinear = { 
  template: '<div class="v-progress-linear"></div>',
  props: ['value', 'color', 'height']
}
const VBtn = {
  template: '<button class="v-btn" @click="$emit(\'click\')" :title="title"><slot /></button>',
  props: ['size', 'color', 'variant', 'icon', 'title'],
  emits: ['click']
}
const VSpacer = { template: '<div class="v-spacer"></div>' }
const VAlert = {
  template: '<div class="v-alert"><slot /></div>',
  props: ['type', 'variant']
}

const vuetify = {
  install(app) {
    app.component('VCard', VCard)
    app.component('VCardText', VCardText)
    app.component('VProgressLinear', VProgressLinear)
    app.component('VBtn', VBtn)
    app.component('VSpacer', VSpacer)
    app.component('VAlert', VAlert)
  }
}

// Mock the export store
const mockExportStore = {
  exportProgress: {
    jobId: null,
    status: null,
    progress: 0,
    format: null,
    processedItems: 0,
    totalItems: 0,
    error: null,
    errorCategory: null,
    errorRecoverable: false,
    recoverySuggestion: null,
    filename: null
  },
  pauseExport: vi.fn(),
  resumeExport: vi.fn(),
  cancelExport: vi.fn(),
  downloadExport: vi.fn(),
  retryExport: vi.fn(),
  resetConnection: vi.fn()
}

vi.mock('../../src/stores/exportStore.js', () => ({
  useExportStore: () => mockExportStore
}))

describe('ExportProgressBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    
    // Reset mock store state
    mockExportStore.exportProgress = {
      jobId: null,
      status: null,
      progress: 0,
      format: null,
      processedItems: 0,
      totalItems: 0,
      error: null,
      errorCategory: null,
      errorRecoverable: false,
      recoverySuggestion: null,
      filename: null
    }
  })

  it('renders correctly when export is not active', () => {
    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.find('.export-progress-container').exists()).toBe(false)
  })

  it('renders correctly when export is active', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'processing',
      progress: 25,
      format: 'csv',
      processedItems: 250,
      totalItems: 1000,
      error: null,
      filename: null
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.find('.export-progress-container').exists()).toBe(true)
    expect(wrapper.text()).toContain('Export Progress')
  })

  it('displays correct progress information', async () => {
    mockExportStore.exportProgress = {
      active: true,
      jobId: 'job-123',
      status: 'processing',
      progress: 50,
      format: 'csv',
      processedItems: 500,
      totalItems: 1000,
      error: null,
      filename: null
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('Exporting')
    expect(wrapper.find('.v-progress-linear').exists()).toBe(true)
  })

  it('shows pause button when export is processing', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'processing',
      progress: 25,
      format: 'csv',
      processedItems: 250,
      totalItems: 1000,
      error: null,
      filename: null
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    const pauseButton = wrapper.find('[title="Pause export"]')
    expect(pauseButton.exists()).toBe(true)
  })

  it('shows resume button when export is paused', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'paused',
      progress: 25,
      format: 'csv',
      processedItems: 250,
      totalItems: 1000,
      error: null,
      filename: null
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    const resumeButton = wrapper.find('[title="Resume export"]')
    expect(resumeButton.exists()).toBe(true)
  })

  it('shows download button when export is completed', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'completed',
      progress: 100,
      format: 'csv',
      processedItems: 1000,
      totalItems: 1000,
      error: null,
      filename: 'tasks.csv'
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    const downloadButton = wrapper.find('[title="Download export"]')
    expect(downloadButton.exists()).toBe(true)
  })

  it('handles pause button click', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'processing',
      progress: 25,
      format: 'csv',
      processedItems: 250,
      totalItems: 1000,
      error: null,
      filename: null
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    const pauseButton = wrapper.find('[title="Pause export"]')
    await pauseButton.trigger('click')

    expect(mockExportStore.pauseExport).toHaveBeenCalledWith('job-123')
  })

  it('handles resume button click', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'paused',
      progress: 25,
      format: 'csv',
      processedItems: 250,
      totalItems: 1000,
      error: null,
      filename: null
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    const resumeButton = wrapper.find('[title="Resume export"]')
    await resumeButton.trigger('click')

    expect(mockExportStore.resumeExport).toHaveBeenCalledWith('job-123')
  })

  it('handles cancel button click', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'processing',
      progress: 25,
      format: 'csv',
      processedItems: 250,
      totalItems: 1000,
      error: null,
      filename: null
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    const cancelButton = wrapper.find('[title="Cancel export"]')
    await cancelButton.trigger('click')

    expect(mockExportStore.cancelExport).toHaveBeenCalledWith('job-123')
  })

  it('handles download button click', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'completed',
      progress: 100,
      format: 'csv',
      processedItems: 1000,
      totalItems: 1000,
      error: null,
      filename: 'tasks.csv'
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    const downloadButton = wrapper.find('[title="Download export"]')
    await downloadButton.trigger('click')

    expect(mockExportStore.downloadExport).toHaveBeenCalledWith('job-123')
  })

  it('displays error state correctly', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'failed',
      progress: 50,
      format: 'csv',
      processedItems: 500,
      totalItems: 1000,
      error: 'Database connection failed',
      errorCategory: 'network',
      errorRecoverable: true,
      recoverySuggestion: 'Check your connection',
      filename: null
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.find('.error-message').exists()).toBe(true)
    expect(wrapper.text()).toContain('Connection issue')
  })

  it('shows formatted status correctly', async () => {
    const testCases = [
      { status: 'pending', expected: 'Preparing export' },
      { status: 'processing', expected: 'Exporting' },
      { status: 'paused', expected: 'Paused' },
      { status: 'completed', expected: 'Completed' },
      { status: 'failed', expected: 'Failed' },
      { status: 'cancelled', expected: 'Cancelled' }
    ]

    for (const testCase of testCases) {
      mockExportStore.exportProgress = {
        jobId: 'job-123',
        status: testCase.status,
        progress: 25,
        format: 'csv',
        processedItems: 250,
        totalItems: 1000,
        error: null,
        filename: null
      }

      const wrapper = mount(ExportProgressBar, {
        global: {
          plugins: [vuetify]
        }
      })

      expect(wrapper.text()).toContain(testCase.expected)
    }
  })

  it('handles progress percentage display', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'processing',
      progress: 75,
      format: 'csv',
      processedItems: 750,
      totalItems: 1000,
      error: null,
      filename: null
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('75')
  })

  it('handles close button functionality', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'completed',
      progress: 100,
      format: 'csv',
      processedItems: 1000,
      totalItems: 1000,
      error: null,
      filename: 'tasks.csv'
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    const closeButton = wrapper.find('button[title*="close"], .v-btn[title*="close"], .mdi-close')
    expect(closeButton.exists()).toBe(true)
  })

  it('shows appropriate color for progress bar based on status', async () => {
    const statusColors = [
      { status: 'processing', expectedColor: 'primary' },
      { status: 'paused', expectedColor: 'warning' },
      { status: 'completed', expectedColor: 'success' },
      { status: 'failed', expectedColor: 'error' }
    ]

    for (const { status, expectedColor } of statusColors) {
      mockExportStore.exportProgress = {
        jobId: 'job-123',
        status,
        progress: 50,
        format: 'csv',
        processedItems: 500,
        totalItems: 1000,
        error: null,
        filename: null
      }

      const wrapper = mount(ExportProgressBar, {
        global: {
          plugins: [vuetify]
        }
      })

      const progressBar = wrapper.findComponent(VProgressLinear)
      if (progressBar.exists()) {
        expect(progressBar.props('color')).toBe(expectedColor)
      }
    }
  })

  it('displays item count information', async () => {
    mockExportStore.exportProgress = {
      jobId: 'job-123',
      status: 'processing',
      progress: 50,
      format: 'csv',
      processedItems: 500,
      totalItems: 1000,
      error: null,
      filename: null
    }

    const wrapper = mount(ExportProgressBar, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('500')
    expect(wrapper.text()).toContain('1000')
  })
})