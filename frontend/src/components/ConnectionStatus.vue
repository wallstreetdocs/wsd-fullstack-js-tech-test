<template>
  <div
    class="connection-status"
    :class="{
      connected: analyticsStore.connected,
      disconnected: !analyticsStore.connected
    }"
  >
    <v-icon
      size="small"
      :color="analyticsStore.connected ? 'success' : 'error'"
      class="mr-1"
    >
      {{ analyticsStore.connected ? 'mdi-wifi' : 'mdi-wifi-off' }}
    </v-icon>
    {{ analyticsStore.connected ? 'Connected' : 'Disconnected' }}
  </div>
</template>

<script setup>
import { useAnalyticsStore } from '../stores/analyticsStore.js'

const analyticsStore = useAnalyticsStore()
</script>