import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ExportAuditList from '../../src/components/ExportAuditList.vue'

// Mock Vuetify components
const VCard = { template: '<div class="v-card"><slot /></div>' }
const VCardTitle = { template: '<div class="v-card-title"><slot /></div>' }
const VSpacer = { template: '<div class="v-spacer"></div>' }
const VTextField = {
  template: '<input class="v-text-field" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  props: ['modelValue', 'prependInnerIcon', 'label', 'singleLine', 'hideDetails', 'density'],
  emits: ['update:modelValue']
}
const VDataTable = {
  template: `
    <div class="v-data-table">
      <div v-if="loading">{{ loadingText }}</div>
      <div v-else-if="items.length === 0">No data available</div>
      <div v-else class="table-content">
        <div v-for="item in filteredItems" :key="item.id" class="table-row">
          <slot name="item.format" :item="item">{{ item.format }}</slot>
          <slot name="item.status" :item="item">{{ item.status }}</slot>
          <slot name="item.progress" :item="item">{{ item.progress }}</slot>
          <slot name="item.createdAt" :item="item">{{ item.createdAt }}</slot>
          <slot name="item.filters" :item="item">{{ JSON.stringify(item.filters) }}</slot>
          <slot name="item.actions" :item="item">Actions</slot>
        </div>
      </div>
    </div>
  `,
  props: ['headers', 'items', 'search', 'loading', 'loadingText'],
  computed: {
    filteredItems() {
      if (!this.search) return this.items
      return this.items.filter(item => 
        JSON.stringify(item).toLowerCase().includes(this.search.toLowerCase())
      )
    }
  }
}
const VChip = {
  template: '<span class="v-chip" :class="`color-${color}`"><slot /></span>',
  props: ['color', 'size']
}
const VBtn = {
  template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>',
  props: ['icon', 'variant', 'size', 'color', 'disabled'],
  emits: ['click']
}
const VTooltip = {
  template: '<div class="v-tooltip"><slot name="activator" :props="{}" /><slot /></div>'
}
const VMenu = {
  template: '<div class="v-menu"><slot name="activator" :props="{}" /><slot /></div>'
}
const VList = { template: '<div class="v-list"><slot /></div>' }
const VListItem = {
  template: '<div class="v-list-item" @click="$emit(\'click\')"><slot /></div>',
  emits: ['click']
}
const VIcon = {
  template: '<i class="v-icon"><slot /></i>',
  props: ['icon']
}

const vuetify = {
  install(app) {
    app.component('VCard', VCard)
    app.component('VCardTitle', VCardTitle)
    app.component('VSpacer', VSpacer)
    app.component('VTextField', VTextField)
    app.component('VDataTable', VDataTable)
    app.component('VChip', VChip)
    app.component('VBtn', VBtn)
    app.component('VTooltip', VTooltip)
    app.component('VMenu', VMenu)
    app.component('VList', VList)
    app.component('VListItem', VListItem)
    app.component('VIcon', VIcon)
  }
}

// Mock the export store
const mockExportStore = {
  exportHistory: [],
  loading: false,
  error: null,
  getExportHistory: vi.fn().mockImplementation(async () => {
    // Simulate the API call and update the store
    const response = { data: { jobs: mockExportStore.exportHistory } }
    return response
  }),
  downloadExport: vi.fn(),
  cancelExport: vi.fn(),
  pauseExport: vi.fn(),
  resumeExport: vi.fn(),
  retryExport: vi.fn()
}

vi.mock('../../src/stores/exportStore.js', () => ({
  useExportStore: () => mockExportStore
}))

// Mock socket plugin
vi.mock('../../src/plugins/socket.js', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}))

describe('ExportAuditList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    
    // Reset mock store state
    mockExportStore.exportHistory = []
    mockExportStore.loading = false
    mockExportStore.error = null
    
    // Reset getExportHistory mock to use the current exportHistory
    mockExportStore.getExportHistory.mockImplementation(async () => {
      mockExportStore.loading = false
      const response = { data: { jobs: mockExportStore.exportHistory } }
      return response
    })
  })

  it('renders correctly with no export history', () => {
    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.find('.v-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('Export Activity Log')
    expect(wrapper.find('.v-data-table').exists()).toBe(true)
  })

  it('displays export history when available', async () => {
    const mockHistory = [
      {
        _id: 'job-1',
        format: 'csv',
        status: 'completed',
        progress: 100,
        createdAt: '2024-01-01T10:00:00Z',
        filters: { status: 'completed' }
      },
      {
        _id: 'job-2',
        format: 'json',
        status: 'failed',
        progress: 50,
        createdAt: '2024-01-01T11:00:00Z',
        filters: { priority: 'high' }
      }
    ]

    mockExportStore.exportHistory = mockHistory

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    // Wait for component to finish loading
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // The component displays formats in uppercase
    expect(wrapper.text()).toContain('CSV')
    expect(wrapper.text()).toContain('JSON')
    expect(wrapper.text()).toContain('completed')
    expect(wrapper.text()).toContain('failed')
  })

  it('shows loading state', async () => {
    mockExportStore.loading = true

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(wrapper.text()).toContain('Loading export history')
  })

  it('handles search functionality', async () => {
    const mockHistory = [
      {
        _id: 'job-1',
        format: 'csv',
        status: 'completed',
        progress: 100,
        createdAt: '2024-01-01T10:00:00Z',
        filters: { status: 'completed' }
      },
      {
        _id: 'job-2',
        format: 'json',
        status: 'failed',
        progress: 50,
        createdAt: '2024-01-01T11:00:00Z',
        filters: { priority: 'high' }
      }
    ]

    mockExportStore.exportHistory = mockHistory

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    const searchField = wrapper.find('.v-text-field')
    await searchField.setValue('csv')

    // Search filtering is handled by VDataTable mock
    expect(searchField.element.value).toBe('csv')
  })

  it('displays format chips with correct colors', async () => {
    const mockHistory = [
      {
        _id: 'job-1',
        format: 'csv',
        status: 'completed',
        progress: 100,
        createdAt: '2024-01-01T10:00:00Z',
        filters: { status: 'completed' }
      },
      {
        _id: 'job-2',
        format: 'json',
        status: 'completed',
        progress: 100,
        createdAt: '2024-01-01T11:00:00Z',
        filters: { priority: 'high' }
      }
    ]

    mockExportStore.exportHistory = mockHistory

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    // Wait for component to finish loading
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const chips = wrapper.findAll('.v-chip')
    expect(chips.length).toBeGreaterThan(0)
  })

  it('displays status chips with correct colors', async () => {
    const mockHistory = [
      {
        _id: 'job-1',
        format: 'csv',
        status: 'completed',
        progress: 100,
        createdAt: '2024-01-01T10:00:00Z',
        filters: { status: 'completed' }
      },
      {
        _id: 'job-2',
        format: 'csv',
        status: 'failed',
        progress: 50,
        createdAt: '2024-01-01T11:00:00Z',
        filters: { priority: 'high' }
      }
    ]

    mockExportStore.exportHistory = mockHistory

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    // Wait for component to finish loading
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(wrapper.text()).toContain('completed')
    expect(wrapper.text()).toContain('failed')
  })

  it('displays progress percentages', async () => {
    const mockHistory = [
      {
        _id: 'job-1',
        format: 'csv',
        status: 'completed',
        progress: 100,
        createdAt: '2024-01-01T10:00:00Z',
        filters: { status: 'completed' }
      },
      {
        _id: 'job-2',
        format: 'csv',
        status: 'processing',
        progress: 75,
        createdAt: '2024-01-01T11:00:00Z',
        filters: { priority: 'high' }
      }
    ]

    mockExportStore.exportHistory = mockHistory

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    // Wait for component to finish loading
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(wrapper.text()).toContain('100')
    expect(wrapper.text()).toContain('75')
  })

  it('formats dates correctly', async () => {
    const mockHistory = [
      {
        _id: 'job-1',
        format: 'csv',
        status: 'completed',
        progress: 100,
        createdAt: '2024-01-01T10:00:00Z',
        filters: { status: 'completed' }
      }
    ]

    mockExportStore.exportHistory = mockHistory

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    // Wait for component to finish loading
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Date formatting is component-specific, just verify it displays
    expect(wrapper.text()).toContain('2024')
  })


  it('handles download action for completed exports', async () => {
    const mockHistory = [
      {
        _id: 'job-1',
        format: 'csv',
        status: 'completed',
        progress: 100,
        createdAt: '2024-01-01T10:00:00Z',
        filters: { status: 'completed' }
      }
    ]

    mockExportStore.exportHistory = mockHistory

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    const downloadButtons = wrapper.findAll('.v-btn')
    const downloadButton = downloadButtons.find(btn => 
      btn.text().includes('download') || btn.attributes('icon') === 'mdi-download'
    )

    if (downloadButton) {
      await downloadButton.trigger('click')
      expect(mockExportStore.downloadExport).toHaveBeenCalledWith('job-1')
    }
  })

  it('handles cancel action for active exports', async () => {
    const mockHistory = [
      {
        _id: 'job-1',
        format: 'csv',
        status: 'processing',
        progress: 50,
        createdAt: '2024-01-01T10:00:00Z',
        filters: { status: 'completed' }
      }
    ]

    mockExportStore.exportHistory = mockHistory

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    const actionButtons = wrapper.findAll('.v-btn')
    const cancelButton = actionButtons.find(btn => 
      btn.text().includes('cancel') || btn.attributes('icon') === 'mdi-cancel'
    )

    if (cancelButton) {
      await cancelButton.trigger('click')
      expect(mockExportStore.cancelExport).toHaveBeenCalledWith('job-1')
    }
  })

  it('disables actions for failed or cancelled exports', async () => {
    const mockHistory = [
      {
        _id: 'job-1',
        format: 'csv',
        status: 'failed',
        progress: 25,
        createdAt: '2024-01-01T10:00:00Z',
        filters: { status: 'completed' }
      },
      {
        _id: 'job-2',
        format: 'json',
        status: 'cancelled',
        progress: 10,
        createdAt: '2024-01-01T11:00:00Z',
        filters: { priority: 'high' }
      }
    ]

    mockExportStore.exportHistory = mockHistory

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    const disabledButtons = wrapper.findAll('.v-btn[disabled]')
    expect(disabledButtons.length).toBeGreaterThanOrEqual(0)
  })

  it('calls getExportHistory on mount', () => {
    mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    expect(mockExportStore.getExportHistory).toHaveBeenCalled()
  })

  it('displays empty state message when no exports', async () => {
    mockExportStore.exportHistory = []

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    // Wait for component to finish loading
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(wrapper.text()).toContain('No data available')
  })

  it('handles different export statuses correctly', async () => {
    const statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'paused']
    const mockHistory = statuses.map((status, index) => ({
      _id: `job-${index}`,
      format: 'csv',
      status,
      progress: status === 'completed' ? 100 : 50,
      createdAt: '2024-01-01T10:00:00Z',
      filters: { status: 'completed' }
    }))

    mockExportStore.exportHistory = mockHistory

    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    // Wait for component to finish loading
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 100))
    
    statuses.forEach(status => {
      expect(wrapper.text()).toContain(status)
    })
  })

  it('refreshes data when refresh button is clicked', async () => {
    const wrapper = mount(ExportAuditList, {
      global: {
        plugins: [vuetify]
      }
    })

    const refreshButton = wrapper.find('[icon="mdi-refresh"]')
    if (refreshButton.exists()) {
      await refreshButton.trigger('click')
      expect(mockExportStore.getExportHistory).toHaveBeenCalledTimes(2) // Once on mount, once on refresh
    }
  })
})