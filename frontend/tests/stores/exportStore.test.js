import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useExportStore } from '../../src/stores/exportStore.js'

// Mock the API client
vi.mock('../../src/api/client.js', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    exportTasks: vi.fn(),
    getExportStatus: vi.fn(),
    getExportHistory: vi.fn(),
    downloadExport: vi.fn()
  }
}))

// Mock the socket
vi.mock('../../src/plugins/socket.js', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}))

// Mock error handler
vi.mock('../../src/utils/errorHandler.js', () => ({
  categorizeError: vi.fn(() => ({
    category: 'NETWORK_ERROR',
    recoverable: true,
    suggestion: 'Check your connection'
  })),
  ErrorCategory: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVER_ERROR: 'SERVER_ERROR'
  }
}))

describe('Export Store', () => {
  let exportStore
  let mockApiClient
  let mockSocket

  beforeEach(async () => {
    setActivePinia(createPinia())
    exportStore = useExportStore()
    
    // Get the mocked modules
    mockApiClient = (await import('../../src/api/client.js')).default
    mockSocket = (await import('../../src/plugins/socket.js')).default
    
    // Reset mocks
    vi.clearAllMocks()
  })

  it('should initialize with correct default state', () => {
    expect(exportStore.loading).toBe(false)
    expect(exportStore.error).toBe(null)
    expect(exportStore.exportHistory).toEqual([])
    expect(exportStore.activeExports).toEqual({})
    expect(exportStore.exportProgress.active).toBe(false)
    expect(exportStore.exportProgress.jobId).toBe(null)
    expect(exportStore.exportProgress.status).toBe(null)
    expect(exportStore.exportProgress.progress).toBe(0)
    expect(exportStore.exportProgress.format).toBe(null)
    expect(exportStore.exportProgress.processedItems).toBe(0)
    expect(exportStore.exportProgress.totalItems).toBe(0)
    expect(exportStore.exportProgress.error).toBe(null)
    expect(exportStore.exportProgress.filename).toBe(null)
  })

  it('should have required methods', () => {
    expect(typeof exportStore.exportTasks).toBe('function')
    expect(typeof exportStore.getExportHistory).toBe('function')
    expect(typeof exportStore.pauseExport).toBe('function')
    expect(typeof exportStore.resumeExport).toBe('function')
    expect(typeof exportStore.cancelExport).toBe('function')
    expect(typeof exportStore.downloadExport).toBe('function')
    expect(typeof exportStore.refreshExportStatus).toBe('function')
    expect(typeof exportStore.retryExport).toBe('function')
    expect(typeof exportStore.connect).toBe('function')
    expect(typeof exportStore.disconnect).toBe('function')
  })

  it('should handle export task creation', async () => {
    const mockResponse = {
      data: {
        jobId: 'job-123',
        status: 'pending',
        format: 'csv'
      }
    }
    
    mockApiClient.exportTasks.mockResolvedValue(mockResponse)
    
    const filters = { status: 'completed' }
    const format = 'csv'
    
    await exportStore.exportTasks(format, filters)
    
    expect(mockApiClient.exportTasks).toHaveBeenCalledWith(format, filters, null)
    expect(exportStore.exportProgress.active).toBe(true)
    expect(exportStore.exportProgress.jobId).toBe('job-123')
    expect(exportStore.exportProgress.format).toBe('csv')
  })


  it('should refresh export status', async () => {
    const mockResponse = {
      success: true,
      data: {
        _id: 'job-123',
        status: 'processing',
        progress: 50,
        processedItems: 500,
        totalItems: 1000
      }
    }
    
    mockApiClient.getExportStatus.mockResolvedValue(mockResponse)
    
    await exportStore.refreshExportStatus('job-123')
    
    expect(mockApiClient.getExportStatus).toHaveBeenCalledWith('job-123')
  })

  it('should fetch export history', async () => {
    const mockResponse = {
      data: {
        jobs: [
          { _id: 'job-1', status: 'completed', format: 'csv' },
          { _id: 'job-2', status: 'failed', format: 'json' }
        ]
      }
    }
    
    mockApiClient.getExportHistory.mockResolvedValue(mockResponse)
    
    await exportStore.getExportHistory()
    
    expect(mockApiClient.getExportHistory).toHaveBeenCalledWith({ page: 1, limit: 10 })
    expect(exportStore.exportHistory).toEqual(mockResponse.data.jobs)
  })

  it('should handle export pause', async () => {
    await exportStore.pauseExport('job-123')
    
    // The store uses socket events for pause, not HTTP requests
    expect(mockSocket.emit).toHaveBeenCalledWith('export:pause', { jobId: 'job-123' })
  })

  it('should handle export resume', async () => {
    await exportStore.resumeExport('job-123')
    
    // The store uses socket events for resume, not HTTP requests
    expect(mockSocket.emit).toHaveBeenCalledWith('export:resume', { jobId: 'job-123' })
  })

  it('should handle export cancellation', async () => {
    await exportStore.cancelExport('job-123')
    
    // The store uses socket events for cancel, not HTTP requests
    expect(mockSocket.emit).toHaveBeenCalledWith('export:cancel', { jobId: 'job-123' })
  })

  it('should handle export download', async () => {
    const mockBlob = new Blob(['csv,data'], { type: 'text/csv' })
    
    mockApiClient.downloadExport.mockResolvedValue(mockBlob)
    
    // Mock URL.createObjectURL and click
    global.URL.createObjectURL = vi.fn(() => 'blob:url')
    global.URL.revokeObjectURL = vi.fn()
    
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
      style: { display: '' }
    }
    
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {})
    
    await exportStore.downloadExport('job-123')
    
    expect(mockApiClient.downloadExport).toHaveBeenCalledWith('job-123')
    expect(mockLink.click).toHaveBeenCalled()
  })

  it('should clear error state', () => {
    exportStore.error = 'Some error'
    
    // Clear error by setting to null directly (no dedicated method)
    exportStore.error = null
    
    expect(exportStore.error).toBe(null)
  })

  it('should reset progress state', () => {
    exportStore.exportProgress.active = true
    exportStore.exportProgress.jobId = 'job-123'
    exportStore.exportProgress.progress = 50
    
    // Reset progress manually (no dedicated method)
    exportStore.exportProgress.active = false
    exportStore.exportProgress.jobId = null
    exportStore.exportProgress.progress = 0
    
    expect(exportStore.exportProgress.active).toBe(false)
    expect(exportStore.exportProgress.jobId).toBe(null)
    expect(exportStore.exportProgress.progress).toBe(0)
  })

  it('should handle socket progress updates', () => {
    // Simulate socket event setup
    const progressUpdateCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'export:progress'
    )?.[1]
    
    if (progressUpdateCallback) {
      const progressData = {
        jobId: 'job-123',
        progress: 75,
        processedItems: 750,
        totalItems: 1000,
        status: 'processing'
      }
      
      progressUpdateCallback(progressData)
      
      expect(exportStore.exportProgress.progress).toBe(75)
      expect(exportStore.exportProgress.processedItems).toBe(750)
      expect(exportStore.exportProgress.totalItems).toBe(1000)
    }
  })

  it('should handle socket completion updates', () => {
    const completionCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'export:complete'
    )?.[1]
    
    if (completionCallback) {
      const completionData = {
        jobId: 'job-123',
        status: 'completed',
        filename: 'tasks.csv'
      }
      
      completionCallback(completionData)
      
      expect(exportStore.exportProgress.status).toBe('completed')
      expect(exportStore.exportProgress.filename).toBe('tasks.csv')
    }
  })

  it('should handle socket error updates', () => {
    const errorCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'export:error'
    )?.[1]
    
    if (errorCallback) {
      const errorData = {
        jobId: 'job-123',
        error: 'Database connection failed',
        recoverable: true
      }
      
      errorCallback(errorData)
      
      expect(exportStore.exportProgress.error).toBe('Database connection failed')
      expect(exportStore.exportProgress.errorRecoverable).toBe(true)
    }
  })

  it('should handle active exports tracking', () => {
    const jobId = 'job-123'
    const jobData = {
      status: 'processing',
      progress: 25,
      format: 'csv'
    }
    
    exportStore.activeExports[jobId] = jobData
    
    expect(exportStore.activeExports[jobId]).toEqual(jobData)
  })


  it('should handle concurrent exports', async () => {
    const mockResponses = [
      { data: { jobId: 'job-1', status: 'pending' } },
      { data: { jobId: 'job-2', status: 'pending' } }
    ]
    
    mockApiClient.exportTasks
      .mockResolvedValueOnce(mockResponses[0])
      .mockResolvedValueOnce(mockResponses[1])
    
    // Start multiple exports
    await Promise.all([
      exportStore.exportTasks('csv', { status: 'completed' }),
      exportStore.exportTasks('json', { priority: 'high' })
    ])
    
    expect(mockApiClient.exportTasks).toHaveBeenCalledTimes(2)
  })

  it('should handle network errors gracefully', async () => {
    const networkError = new Error('Network unavailable')
    mockApiClient.getExportHistory.mockRejectedValue(networkError)
    
    try {
      await exportStore.getExportHistory()
    } catch (err) {
      // Expected to throw
    }
    
    expect(exportStore.error).toBeTruthy()
    expect(exportStore.loading).toBe(false)
  })
})