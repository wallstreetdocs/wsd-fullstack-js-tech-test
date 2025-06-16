import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MetricCard from '../../src/components/MetricCard.vue'

// Mock Vuetify components
const VCard = { template: '<div class="v-card"><slot /></div>' }
const VCardText = { template: '<div class="v-card-text"><slot /></div>' }
const VIcon = {
  template: '<i class="v-icon"><slot /></i>',
  props: ['color', 'size']
}

const vuetify = {
  install(app) {
    app.component('VCard', VCard)
    app.component('VCardText', VCardText)
    app.component('VIcon', VIcon)
  }
}

describe('MetricCard', () => {
  it('renders correctly with props', () => {
    const wrapper = mount(MetricCard, {
      global: {
        plugins: [vuetify]
      },
      props: {
        title: 'Total Tasks',
        value: 42,
        icon: 'mdi-format-list-checks',
        color: 'primary'
      }
    })

    expect(wrapper.text()).toContain('Total Tasks')
    expect(wrapper.text()).toContain('42')
  })

  it('applies correct color class', () => {
    const wrapper = mount(MetricCard, {
      global: {
        plugins: [vuetify]
      },
      props: {
        title: 'Test Metric',
        value: 100,
        icon: 'mdi-test',
        color: 'success'
      }
    })

    const valueElement = wrapper.find('.metric-value')
    expect(valueElement.classes()).toContain('text-success')
  })

  it('handles string and number values', () => {
    const wrapper = mount(MetricCard, {
      global: {
        plugins: [vuetify]
      },
      props: {
        title: 'Completion Rate',
        value: '85%',
        icon: 'mdi-check',
        color: 'info'
      }
    })

    expect(wrapper.text()).toContain('85%')
  })
})
