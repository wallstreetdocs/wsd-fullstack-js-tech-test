<template>
  <div class="chart-wrapper">
    <div v-if="hasData" class="d-flex justify-center">
      <svg
        :width="width"
        :height="height"
        viewBox="0 0 400 200"
        class="responsive-chart"
      >
        <!-- X-axis line -->
        <line
          x1="30"
          y1="170"
          x2="380"
          y2="170"
          stroke="#666"
          stroke-width="1"
        />

        <!-- Y-axis line -->
        <line x1="30" y1="20" x2="30" y2="170" stroke="#666" stroke-width="1" />

        <!-- Chart title -->
        <text
          x="200"
          y="15"
          text-anchor="middle"
          font-size="14"
          font-weight="bold"
          fill="#333"
        >
          {{ title }}
        </text>

        <!-- Data line path -->
        <path
          :d="linePath"
          fill="none"
          :stroke="lineColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Data area path -->
        <path v-if="fillArea" :d="areaPath" :fill="areaColor" opacity="0.2" />

        <!-- Data points -->
        <circle
          v-for="(point, index) in chartPoints"
          :key="index"
          :cx="point.x"
          :cy="point.y"
          r="4"
          :fill="pointColor"
          stroke="#fff"
          stroke-width="1"
          class="chart-point"
        >
          <title>{{ `${labels[index]}: ${data[index]}` }}</title>
        </circle>

        <!-- X-axis labels (filter to show each month only once) -->
        <template
          v-for="(label, index) in filteredLabels"
          :key="'x-label-' + index"
        >
          <text
            :x="xScale(label.index)"
            y="185"
            text-anchor="middle"
            font-size="10"
            fill="#666"
          >
            {{ label.text }}
          </text>
        </template>

        <!-- Y-axis labels -->
        <text
          v-for="(value, index) in yAxisLabels"
          :key="'y-label-' + index"
          x="25"
          :y="yScale(value) + 4"
          text-anchor="end"
          font-size="10"
          fill="#666"
        >
          {{ value }}
        </text>
      </svg>
    </div>

    <div v-if="!hasData" class="text-center py-4">
      <v-icon size="48" color="grey-lighten-1">mdi-chart-line</v-icon>
      <p class="text-grey mt-2">No data available</p>
    </div>
  </div>
</template>

<script setup>
/**
 * @module TimeSeriesChart
 * @description Line chart component for time series visualization
 */

import { computed } from 'vue'

/**
 * Component props definition
 * @typedef {Object} Props
 * @property {Array<number>} data - Data points array
 * @property {Array<string>} labels - X-axis labels
 * @property {string} title - Chart title
 * @property {number} width - Chart width in pixels
 * @property {number} height - Chart height in pixels
 * @property {string} lineColor - Line color
 * @property {string} pointColor - Data point color
 * @property {string} areaColor - Area fill color
 * @property {boolean} fillArea - Whether to fill area under the line
 * @property {number} labelInterval - Interval for displaying x-axis labels
 */
const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  labels: {
    type: Array,
    default: () => []
  },
  title: {
    type: String,
    default: 'Time Series'
  },
  width: {
    type: Number,
    default: 400
  },
  height: {
    type: Number,
    default: 200
  },
  lineColor: {
    type: String,
    default: '#2196F3'
  },
  pointColor: {
    type: String,
    default: '#2196F3'
  },
  areaColor: {
    type: String,
    default: '#2196F3'
  },
  fillArea: {
    type: Boolean,
    default: true
  },
  labelInterval: {
    type: Number,
    default: 4
  }
})

// Determine if we have valid data to show
const hasData = computed(
  () =>
    props.data &&
    props.data.length > 0 &&
    props.labels &&
    props.labels.length > 0
)

// Calculate min and max values for the y-axis
const minValue = computed(() => Math.min(0, ...props.data))
const maxValue = computed(() => {
  const max = Math.max(...props.data)
  return max === 0 ? 5 : Math.ceil(max * 1.1) // Add 10% padding, minimum of 5 if max is 0
})

// Generate y-axis labels
const yAxisLabels = computed(() => {
  const min = minValue.value
  const max = maxValue.value
  const step = Math.ceil((max - min) / 4) // We want about 5 labels
  const labels = []

  for (let i = 0; i <= 4; i++) {
    labels.push(min + step * i)
  }

  return labels
})

// Filter labels to show each month only once
const filteredLabels = computed(() => {
  if (!props.labels || props.labels.length === 0) return []

  const uniqueMonths = new Map()

  // Find the first occurrence of each month
  props.labels.forEach((label, index) => {
    if (!uniqueMonths.has(label)) {
      uniqueMonths.set(label, index)
    }
  })

  // Convert to array of {index, text} objects
  return Array.from(uniqueMonths.entries()).map(([text, index]) => ({
    text,
    index
  }))
})

// Scale functions to convert data values to SVG coordinates
const xScale = computed(() => {
  return (index) => {
    // X-axis positioning, with padding for the y-axis
    const chartWidth = 350
    const padding = 30
    return padding + index * (chartWidth / (props.data.length - 1 || 1))
  }
})

const yScale = computed(() => {
  return (value) => {
    // Y-axis positioning, with padding for the x-axis
    const chartHeight = 150
    const padding = 20
    const min = minValue.value
    const max = maxValue.value
    const normalizedValue = (value - min) / (max - min || 1)
    return padding + chartHeight - normalizedValue * chartHeight
  }
})

// Generate SVG coordinates for each data point
const chartPoints = computed(() => {
  if (!hasData.value) return []

  return props.data.map((value, index) => ({
    x: xScale.value(index),
    y: yScale.value(value)
  }))
})

// Generate SVG path for the line connecting all points
const linePath = computed(() => {
  if (!hasData.value || chartPoints.value.length === 0) return ''

  return chartPoints.value.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`
    } else {
      return `${path} L ${point.x} ${point.y}`
    }
  }, '')
})

// Generate SVG path for the filled area under the line
const areaPath = computed(() => {
  if (!hasData.value || chartPoints.value.length === 0) return ''

  const points = chartPoints.value
  let path = linePath.value

  // Add bottom right corner
  path += ` L ${points[points.length - 1].x} 170`

  // Add bottom left corner
  path += ` L ${points[0].x} 170`

  // Close the path
  path += ' Z'

  return path
})
</script>

<style scoped>
.chart-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
}

.chart-point {
  transition: r 0.2s ease;
  cursor: pointer;
}

.chart-point:hover {
  r: 6;
}

.responsive-chart {
  max-width: 100%;
  height: auto;
}
</style>
