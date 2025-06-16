<template>
  <div class="chart-wrapper">
    <div v-if="hasData" class="d-flex justify-center">
      <svg :width="chartWidth" :height="chartHeight" viewBox="0 0 300 200">
        <g transform="translate(20, 20)">
          <rect
            v-for="(bar, index) in chartBars"
            :key="index"
            :x="bar.x"
            :y="bar.y"
            :width="bar.width"
            :height="bar.height"
            :fill="bar.color"
            class="chart-bar"
          />
          <text
            v-for="(bar, index) in chartBars"
            :key="`label-${index}`"
            :x="bar.x + bar.width / 2"
            :y="bar.y + bar.height + 15"
            text-anchor="middle"
            font-size="12"
            fill="currentColor"
          >
            {{ bar.name }}
          </text>
          <text
            v-for="(bar, index) in chartBars"
            :key="`value-${index}`"
            :x="bar.x + bar.width / 2"
            :y="bar.y - 5"
            text-anchor="middle"
            font-size="12"
            font-weight="bold"
            fill="currentColor"
          >
            {{ bar.value }}
          </text>
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
      <v-icon size="48" color="grey-lighten-1">mdi-chart-bar</v-icon>
      <p class="text-grey mt-2">No data available</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  width: {
    type: Number,
    default: 300
  },
  height: {
    type: Number,
    default: 200
  },
  showLegend: {
    type: Boolean,
    default: false
  }
})

const chartWidth = computed(() => props.width)
const chartHeight = computed(() => props.height)

const hasData = computed(() => props.data.some((item) => item.value > 0))

const maxValue = computed(() =>
  Math.max(...props.data.map((item) => item.value), 1)
)

const chartBars = computed(() => {
  if (!hasData.value) return []

  const barWidth = 60
  const maxBarHeight = 120
  const spacing = 20
  const startX = 30

  return props.data.map((item, index) => {
    const height = (item.value / maxValue.value) * maxBarHeight
    const x = startX + index * (barWidth + spacing)
    const y = maxBarHeight - height + 20

    return {
      x,
      y,
      width: barWidth,
      height,
      color: item.color,
      name: item.name,
      value: item.value
    }
  })
})
</script>

<style scoped>
.chart-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.chart-bar {
  transition: opacity 0.3s ease;
  cursor: pointer;
}

.chart-bar:hover {
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
