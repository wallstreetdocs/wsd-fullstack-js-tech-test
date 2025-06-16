<template>
  <div class="chart-wrapper">
    <div v-if="hasData" class="d-flex justify-center">
      <svg :width="size" :height="size" viewBox="0 0 200 200">
        <g transform="translate(100, 100)">
          <path
            v-for="(segment, index) in chartSegments"
            :key="index"
            :d="segment.path"
            :fill="segment.color"
            :stroke="'white'"
            :stroke-width="2"
            class="chart-segment"
          />
        </g>
      </svg>
    </div>

    <div v-if="showLegend" class="legend mt-4">
      <div
        v-for="item in data"
        :key="item.name"
        class="legend-item d-flex align-center mb-2"
      >
        <div
          class="legend-color"
          :style="{ backgroundColor: item.color }"
        ></div>
        <span class="legend-label">{{ item.name }}: {{ item.value }}</span>
      </div>
    </div>

    <div v-if="!hasData" class="text-center py-4">
      <v-icon size="48" color="grey-lighten-1">mdi-chart-pie</v-icon>
      <p class="text-grey mt-2">No data available</p>
    </div>
  </div>
</template>

<!--
/**
 * @fileoverview SVG pie chart component for visualizing task status distribution
 * @component TaskStatusChart
 * @description Renders a customizable pie chart with optional legend for task status data
 * @props {Array} data - Chart data with name, value, and color properties
 * @props {Number} size - Chart diameter in pixels
 * @props {Boolean} showLegend - Whether to display color legend
 */
-->

<script setup>
/**
 * @module TaskStatusChart
 * @description Interactive pie chart component for task status visualization
 */

import { computed } from 'vue'

/**
 * Component props definition
 * @typedef {Object} Props
 * @property {Array<Object>} data - Chart data array
 * @property {number} size - Chart size in pixels
 * @property {boolean} showLegend - Show/hide legend
 */
const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  size: {
    type: Number,
    default: 200
  },
  showLegend: {
    type: Boolean,
    default: false
  }
})

const hasData = computed(() => props.data.some((item) => item.value > 0))

const totalValue = computed(() =>
  props.data.reduce((sum, item) => sum + item.value, 0)
)

const chartSegments = computed(() => {
  if (!hasData.value) return []

  let currentAngle = 0
  const radius = 80

  return props.data
    .filter((item) => item.value > 0)
    .map((item) => {
      const percentage = item.value / totalValue.value
      const angle = percentage * 2 * Math.PI

      const x1 = Math.cos(currentAngle) * radius
      const y1 = Math.sin(currentAngle) * radius
      const x2 = Math.cos(currentAngle + angle) * radius
      const y2 = Math.sin(currentAngle + angle) * radius

      const largeArcFlag = angle > Math.PI ? 1 : 0

      const pathData = [
        'M 0 0',
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ')

      const result = {
        path: pathData,
        color: item.color,
        value: item.value,
        name: item.name
      }

      currentAngle += angle
      return result
    })
})
</script>

<style scoped>
.chart-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chart-segment {
  transition: opacity 0.3s ease;
  cursor: pointer;
}

.chart-segment:hover {
  opacity: 0.8;
}

.legend-item {
  font-size: 0.875rem;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  margin-right: 8px;
}

.legend-label {
  flex: 1;
}
</style>
