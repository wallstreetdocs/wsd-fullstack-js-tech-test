<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app temporary :width="280">
      <v-list>
        <v-list-item
          prepend-avatar="https://randomuser.me/api/portraits/men/85.jpg"
          title="Task Analytics"
          subtitle="Dashboard"
        ></v-list-item>
      </v-list>

      <v-divider></v-divider>

      <v-list nav>
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          color="primary"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app color="primary" dark>
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-toolbar-title>Task Analytics Dashboard</v-toolbar-title>
      <v-spacer></v-spacer>

      <v-btn icon @click="toggleTheme">
        <v-icon>{{ themeIcon }}</v-icon>
      </v-btn>

      <v-btn icon @click="testSocket" title="Test Socket Connection">
        <v-icon>mdi-wifi</v-icon>
      </v-btn>

      <v-badge
        :content="unreadNotifications"
        :model-value="unreadNotifications > 0"
        color="error"
      >
        <v-btn icon @click="showNotifications = !showNotifications">
          <v-icon>mdi-bell</v-icon>
        </v-btn>
      </v-badge>
    </v-app-bar>

    <v-main class="app-container">
      <v-container fluid>
        <router-view />
      </v-container>
    </v-main>

    <connection-status />

    <notification-drawer
      v-model="showNotifications"
      :notifications="notifications"
      @clear-all="clearAllNotifications"
      @remove="removeNotification"
    />

    <!-- Export Progress Snackbar -->
    <v-snackbar
      v-model="showExportSnackbar"
      :color="exportSnackbarColor"
      :timeout="exportSnackbarTimeout"
      location="bottom"
    >
      <div class="d-flex align-center">
        <v-icon class="mr-2">{{ exportSnackbarIcon }}</v-icon>
        <div class="d-flex flex-column">
          <span>{{ exportSnackbarMessage }}</span>
          <v-progress-linear
            v-if="
              exportSnackbarStatus === 'processing' &&
              currentExportPercentage > 0
            "
            :model-value="currentExportPercentage"
            color="white"
            class="mt-1"
            height="4"
          ></v-progress-linear>
          <span
            v-if="
              exportSnackbarStatus === 'processing' &&
              currentExportPercentage > 0
            "
            class="text-caption mt-1"
          >
            {{ currentExportPercentage }}% complete
          </span>
        </div>
      </div>

      <template #actions>
        <v-btn
          v-if="exportSnackbarStatus === 'completed'"
          variant="text"
          @click="viewExportHistory"
        >
          View History
        </v-btn>
        <v-btn variant="text" @click="onSnackbarClose"> Close </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<!--
/**
 * @fileoverview Main application component with navigation, theme control, and notifications
 * @component App
 * @description Root Vue component providing layout structure, navigation drawer, app bar,
 * theme toggle, notification management, and Socket.IO connection handling
 */
-->

<script setup>
/**
 * @module App
 * @description Main application component with navigation and real-time features
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import { useAnalyticsStore } from './stores/analyticsStore.js'
import { useTaskStore } from './stores/taskStore.js'
import { useExportStore } from './stores/exportStore.js'
import ConnectionStatus from './components/ConnectionStatus.vue'
import NotificationDrawer from './components/NotificationDrawer.vue'
import socket from './plugins/socket.js'

const theme = useTheme()
const analyticsStore = useAnalyticsStore()
const taskStore = useTaskStore()
const exportStore = useExportStore()

const drawer = ref(false)
const showNotifications = ref(false)

// Export progress snackbar state
const showExportSnackbar = ref(false)
const exportSnackbarMessage = ref('')
const exportSnackbarStatus = ref('')
const exportSnackbarColor = ref('info')
const exportSnackbarIcon = ref('mdi-information')
const exportSnackbarTimeout = ref(4000)

// Track current export progress
const currentExportProgress = ref(null)
const currentExportPercentage = ref(0)

const menuItems = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', to: '/' },
  { title: 'Tasks', icon: 'mdi-format-list-checks', to: '/tasks' },
  { title: 'Analytics', icon: 'mdi-chart-line', to: '/analytics' },
  { title: 'Export History', icon: 'mdi-history', to: '/exports' }
]

const themeIcon = computed(() =>
  theme.global.name.value === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'
)

const notifications = computed(() => analyticsStore.notifications)

const unreadNotifications = computed(() =>
  notifications.value.length > 10
    ? '10+'
    : notifications.value.length.toString()
)

function toggleTheme() {
  theme.global.name.value =
    theme.global.name.value === 'light' ? 'dark' : 'light'
}

function clearAllNotifications() {
  analyticsStore.clearNotifications()
  showNotifications.value = false
}

function removeNotification(id) {
  analyticsStore.removeNotification(id)
}

// Export progress snackbar methods
function showExportProgress(status, message, percentage = null) {
  console.log('🍿 Showing export progress snackbar:', {
    status,
    message,
    percentage
  })

  // Update snackbar state
  exportSnackbarStatus.value = status
  exportSnackbarMessage.value = message
  exportSnackbarColor.value = getSnackbarColor(status)
  exportSnackbarIcon.value = getSnackbarIcon(status)
  exportSnackbarTimeout.value = getSnackbarTimeout(status)

  // Show snackbar
  showExportSnackbar.value = true

  // Store current progress
  currentExportProgress.value = { status, message }
  currentExportPercentage.value = percentage || 0

  console.log('🍿 Snackbar should now be visible:', showExportSnackbar.value)
}

function getSnackbarColor(status) {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'processing':
      return 'info'
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    default:
      return 'info'
  }
}

function getSnackbarIcon(status) {
  switch (status) {
    case 'pending':
      return 'mdi-clock-outline'
    case 'processing':
      return 'mdi-progress-clock'
    case 'completed':
      return 'mdi-check-circle'
    case 'failed':
      return 'mdi-alert-circle'
    default:
      return 'mdi-information'
  }
}

function getSnackbarTimeout(status) {
  switch (status) {
    case 'pending':
      return 3000 // Short timeout for pending
    case 'processing':
      return 0 // No timeout for processing
    case 'completed':
      return 6000
    case 'failed':
      return 8000
    default:
      return 4000
  }
}

function onSnackbarClose() {
  console.log('🍿 Snackbar closed by user or timeout')
  showExportSnackbar.value = false
  currentExportProgress.value = null
}

function viewExportHistory() {
  // Navigate to export history page
  window.location.href = '/exports'
}

async function testSocket() {
  try {
    console.log('🧪 Testing socket connection...')
    const response = await fetch('http://localhost:3001/api/test-socket')
    const result = await response.json()
    console.log('🧪 Socket test result:', result)

    if (result.success) {
      showExportProgress(
        'info',
        'Socket test completed - check console for events'
      )
    } else {
      showExportProgress('error', 'Socket test failed: ' + result.message)
    }
  } catch (error) {
    console.error('🧪 Socket test error:', error)
    showExportProgress('error', 'Socket test error: ' + error.message)
  }
}

onMounted(() => {
  analyticsStore.initializeSocketListeners()
  taskStore.initializeSocketListeners()
  exportStore.initializeSocketListeners()
  analyticsStore.connect()
  analyticsStore.fetchAnalytics()

  // Ensure socket is connected
  if (!socket.connected) {
    console.log('🔌 Connecting socket in App component...')
    socket.connect()
  }

  // Listen for export progress updates
  window.addEventListener('export-progress-update', (event) => {
    console.log(
      '📱 App component received export-progress-update event:',
      event.detail
    )
    console.log('📱 Socket connected:', socket.connected)
    const { status, message, percentage } = event.detail
    showExportProgress(status, message, percentage)
  })

  // Also listen directly to socket events as backup
  socket.on('export-progress', (data) => {
    console.log(
      '📱 App component received direct socket export-progress:',
      data
    )
    showExportProgress(data.status, data.message, data.percentage)
  })
})

onUnmounted(() => {
  analyticsStore.cleanup()
  taskStore.cleanup()
  exportStore.removeSocketListeners()
  analyticsStore.disconnect()

  // Remove export progress event listener
  window.removeEventListener('export-progress-update', (event) => {
    const { status, message } = event.detail
    showExportProgress(status, message)
  })
})
</script>

<style lang="scss">
// Global styles are imported in main.js
</style>
