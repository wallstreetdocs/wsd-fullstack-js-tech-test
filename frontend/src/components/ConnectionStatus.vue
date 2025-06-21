<template>
  <div
    class="connection-status"
    :class="{
      connected: analyticsStore.connected,
      disconnected: !analyticsStore.connected
    }"
    @click="handleClick"
  >
    <v-icon
      size="small"
      :color="analyticsStore.connected ? 'success' : 'error'"
      class="mr-1"
    >
      {{ analyticsStore.connected ? 'mdi-wifi' : 'mdi-wifi-off' }}
    </v-icon>
    {{ analyticsStore.connected ? 'Connected' : 'Disconnected' }}
    
    <v-tooltip v-if="!analyticsStore.connected" activator="parent" location="bottom">
      Click to reconnect
    </v-tooltip>
  </div>
</template>

<script setup>
import { useAnalyticsStore } from '../stores/analyticsStore.js'

const analyticsStore = useAnalyticsStore()

// Handle click on connection status indicator
function handleClick() {
  // If disconnected, try to reconnect
  if (!analyticsStore.connected) {
    analyticsStore.resetConnection()
  }
}
</script>

<style scoped>
.connection-status {
  cursor: pointer;
}

.disconnected {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.6; }
  100% { opacity: 1; }
}
</style>
