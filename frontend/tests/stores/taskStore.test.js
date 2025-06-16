import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '../../src/stores/taskStore.js'

// Mock the API client
vi.mock('../../src/api/client.js', () => ({
  default: {
    getTasks: vi.fn(),
    getTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn()
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

describe('Task Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with empty state', () => {
    const taskStore = useTaskStore()

    expect(taskStore.tasks).toEqual([])
    expect(taskStore.loading).toBe(false)
    expect(taskStore.error).toBe(null)
    expect(taskStore.pagination.page).toBe(1)
    expect(taskStore.pagination.limit).toBe(10)
  })

  it('should calculate pending tasks correctly', () => {
    const taskStore = useTaskStore()

    taskStore.tasks = [
      { _id: '1', status: 'pending' },
      { _id: '2', status: 'pending' },
      { _id: '3', status: 'completed' }
    ]

    expect(taskStore.pendingTasks).toHaveLength(2)
  })

  it('should calculate completed tasks correctly', () => {
    const taskStore = useTaskStore()

    taskStore.tasks = [
      { _id: '1', status: 'pending' },
      { _id: '2', status: 'completed' },
      { _id: '3', status: 'completed' }
    ]

    expect(taskStore.completedTasks).toHaveLength(2)
  })

  it('should calculate tasks by status correctly', () => {
    const taskStore = useTaskStore()

    taskStore.tasks = [
      { _id: '1', status: 'pending' },
      { _id: '2', status: 'in-progress' },
      { _id: '3', status: 'completed' },
      { _id: '4', status: 'completed' }
    ]

    expect(taskStore.tasksByStatus).toEqual({
      pending: 1,
      'in-progress': 1,
      completed: 2
    })
  })

  it('should calculate tasks by priority correctly', () => {
    const taskStore = useTaskStore()

    taskStore.tasks = [
      { _id: '1', priority: 'low' },
      { _id: '2', priority: 'medium' },
      { _id: '3', priority: 'high' },
      { _id: '4', priority: 'high' }
    ]

    expect(taskStore.tasksByPriority).toEqual({
      low: 1,
      medium: 1,
      high: 2
    })
  })
})
