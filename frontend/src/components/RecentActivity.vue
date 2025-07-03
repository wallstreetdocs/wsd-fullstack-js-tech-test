<template>
  <v-card>
    <v-card-title v-if="showHeader">Recent Activity</v-card-title>

    <v-card-text>
      <div v-if="analyticsStore.loading" class="text-center py-4">
        <v-progress-circular indeterminate size="24"></v-progress-circular>
      </div>

      <div v-else-if="recentActivity.length === 0" class="text-center py-4">
        <v-icon size="48" color="grey-lighten-1">mdi-history</v-icon>
        <p class="text-grey mt-2">No recent activity</p>
      </div>

      <div v-else class="activity-feed">
        <div
          v-for="activity in recentActivity"
          :key="activity._id"
          class="activity-item"
        >
          <div class="activity-icon">
            <v-icon :color="getStatusColor(activity.status)">
              {{
                activity.title.startsWith('Export:')
                  ? 'mdi-file-export'
                  : getStatusIcon(activity.status)
              }}
            </v-icon>
          </div>

          <div class="activity-content">
            <div class="activity-title">{{ activity.title }}</div>
            <div class="activity-time">
              Updated {{ formatTime(activity.updatedAt) }}
            </div>
          </div>

          <div class="activity-status">
            <v-chip
              :color="getStatusColor(activity.status)"
              size="small"
              variant="flat"
            >
              {{ formatStatus(activity.status) }}
            </v-chip>
          </div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed } from 'vue'
import { useAnalyticsStore } from '../stores/analyticsStore.js'

defineProps({
  showHeader: {
    type: Boolean,
    default: true
  }
})

const analyticsStore = useAnalyticsStore()

const recentActivity = computed(
  () => analyticsStore.analytics.recentActivity || []
)

function getStatusColor(status) {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'in-progress':
      return 'info'
    case 'completed':
      return 'success'
    default:
      return 'grey'
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'pending':
      return 'mdi-clock-outline'
    case 'in-progress':
      return 'mdi-progress-clock'
    case 'completed':
      return 'mdi-check-circle'
    default:
      return 'mdi-help-circle'
  }
}

function formatStatus(status) {
  return status.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

function formatTime(timestamp) {
  const now = new Date()
  const time = new Date(timestamp)
  const diffInSeconds = Math.floor((now - time) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
}
</script>
