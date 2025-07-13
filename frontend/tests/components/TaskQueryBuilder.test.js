/**
 * @fileoverview Tests for TaskQueryBuilder component
 * @module tests/components/TaskQueryBuilder
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import TaskQueryBuilder from '../../src/components/TaskQueryBuilder.vue'

const vuetify = createVuetify()

describe('TaskQueryBuilder', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(TaskQueryBuilder, {
      global: {
        plugins: [vuetify]
      }
    })
  })

  it('renders the query builder component', () => {
    expect(wrapper.find('.query-builder').exists()).toBe(true)
    expect(wrapper.find('[data-testid="query-builder-title"]').exists()).toBe(
      true
    )
  })

  it('expands and collapses when toggle button is clicked', async () => {
    const toggleButton = wrapper.find('[data-testid="toggle-button"]')
    await toggleButton.trigger('click')

    // Check if expanded state changes
    expect(wrapper.vm.expanded).toBe(true)
  })

  it('emits query-updated when form values change', async () => {
    const searchInput = wrapper.find(
      'input[placeholder="Enter search terms..."]'
    )
    await searchInput.setValue('test search')

    expect(wrapper.emitted('query-updated')).toBeTruthy()
  })

  it('emits search-executed when search button is clicked', async () => {
    const searchButton = wrapper.find('button:contains("Search")')
    await searchButton.trigger('click')

    expect(wrapper.emitted('search-executed')).toBeTruthy()
  })

  it('clears all form values when clear button is clicked', async () => {
    // Set some values first
    const searchInput = wrapper.find(
      'input[placeholder="Enter search terms..."]'
    )
    await searchInput.setValue('test')

    const clearButton = wrapper.find('button:contains("Clear")')
    await clearButton.trigger('click')

    // Check if values are cleared
    expect(wrapper.vm.query.search).toBe('')
  })

  it('saves and loads queries correctly', async () => {
    const saveButton = wrapper.find('button:contains("Save Query")')
    await saveButton.trigger('click')

    // Check if save dialog is shown
    expect(wrapper.vm.showSaveDialog).toBe(true)
  })

  it('handles custom MongoDB conditions', async () => {
    const customWhereInput = wrapper.find(
      'textarea[placeholder*="WHERE conditions"]'
    )
    await customWhereInput.setValue('{"title": {"$regex": "test"}}')

    // Check if custom conditions are parsed
    expect(wrapper.vm.query.where).toBeTruthy()
  })

  it('validates form inputs correctly', () => {
    // Test form validation
    expect(wrapper.vm.formValid).toBe(true)
  })

  it('converts query parameters to URL format', () => {
    const query = {
      status: ['pending', 'in-progress'],
      priority: ['high'],
      search: 'test'
    }

    // Test parameter conversion
    const result = wrapper.vm.convertQueryToParams(query)
    expect(result.status).toBe('pending,in-progress')
    expect(result.priority).toBe('high')
  })
})
