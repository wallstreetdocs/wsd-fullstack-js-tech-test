<template>
  <v-card class="metric-card" height="120">
    <v-card-text class="d-flex align-center">
      <div class="flex-grow-1">
        <div class="metric-value" :class="`text-${color}`">
          {{ value }}
        </div>
        <div class="metric-label">{{ title }}</div>
      </div>
      <v-icon :color="color" size="48" class="ml-3">
        {{ icon }}
      </v-icon>
    </v-card-text>
  </v-card>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: 'primary'
  }
})
</script>