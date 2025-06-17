<!--
/**
 * @fileoverview Analytics view with comprehensive task metrics and visualizations
 * @component Analytics
 * @description Detailed analytics page showing task metrics, charts, completion rates,
 * and real-time connection status with live data updates
 */
-->

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="page-title mr-4">Analytics</h1>
      <v-chip
        v-if="analyticsStore.connected"
        color="success"
        variant="flat"
        size="small"
      >
        <v-icon start>mdi-wifi</v-icon>
        Live
      </v-chip>
      <v-chip v-else color="error" variant="flat" size="small">
        <v-icon start>mdi-wifi-off</v-icon>
        Offline
      </v-chip>
      <v-spacer></v-spacer>
      <small v-if="analyticsStore.analytics.lastUpdated" class="text-grey">
        Last updated:
        {{ formatLastUpdated(analyticsStore.analytics.lastUpdated) }}
      </small>
    </div>

    <v-row>
      <v-col cols="12" md="4">
        <metric-card
          title="Average Completion Time"
          :value="
            formatCompletionTime(analyticsStore.analytics.averageCompletionTime)
          "
          icon="mdi-clock"
          color="info"
        />
      </v-col>
      <v-col cols="12" md="4">
        <metric-card
          title="High Priority Tasks"
          :value="analyticsStore.analytics.tasksByPriority.high"
          icon="mdi-priority-high"
          color="error"
        />
      </v-col>
      <v-col cols="12" md="4">
        <metric-card
          title="In Progress Tasks"
          :value="analyticsStore.analytics.tasksByStatus['in-progress']"
          icon="mdi-progress-clock"
          color="warning"
        />
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12" md="6">
        <v-card class="chart-container equal-height-chart">
          <v-card-title>Status Distribution</v-card-title>
          <v-card-text>
            <task-status-chart
              :data="analyticsStore.statusData"
              :show-legend="true"
              :height="300"
            />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card class="chart-container equal-height-chart">
          <v-card-title>Priority Distribution</v-card-title>
          <v-card-text>
            <task-priority-chart
              :data="analyticsStore.priorityData"
              :show-legend="true"
              :height="300"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12">
        <v-card>
          <v-card-title>Recent Activity</v-card-title>
          <v-card-text>
            <recent-activity :show-header="false" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Task Summary</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item>
                <template #prepend>
                  <v-icon color="warning">mdi-clock-outline</v-icon>
                </template>
                <v-list-item-title>Pending Tasks</v-list-item-title>
                <v-list-item-subtitle>
                  {{ analyticsStore.analytics.tasksByStatus.pending }} tasks
                  waiting to be started
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon color="info">mdi-progress-clock</v-icon>
                </template>
                <v-list-item-title>In Progress</v-list-item-title>
                <v-list-item-subtitle>
                  {{ analyticsStore.analytics.tasksByStatus['in-progress'] }}
                  tasks currently being worked on
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon color="success">mdi-check-circle</v-icon>
                </template>
                <v-list-item-title>Completed</v-list-item-title>
                <v-list-item-subtitle>
                  {{ analyticsStore.analytics.tasksByStatus.completed }} tasks
                  finished
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title>Priority Breakdown</v-card-title>
          <v-card-text>
            <v-list>
              <v-list-item>
                <template #prepend>
                  <v-icon color="success">mdi-arrow-down</v-icon>
                </template>
                <v-list-item-title>Low Priority</v-list-item-title>
                <v-list-item-subtitle>
                  {{ analyticsStore.analytics.tasksByPriority.low }} tasks
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon color="warning">mdi-minus</v-icon>
                </template>
                <v-list-item-title>Medium Priority</v-list-item-title>
                <v-list-item-subtitle>
                  {{ analyticsStore.analytics.tasksByPriority.medium }} tasks
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item>
                <template #prepend>
                  <v-icon color="error">mdi-arrow-up</v-icon>
                </template>
                <v-list-item-title>High Priority</v-list-item-title>
                <v-list-item-subtitle>
                  {{ analyticsStore.analytics.tasksByPriority.high }} tasks
                  requiring immediate attention
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { useAnalyticsStore } from '../stores/analyticsStore.js'
import MetricCard from '../components/MetricCard.vue'
import TaskStatusChart from '../components/TaskStatusChart.vue'
import TaskPriorityChart from '../components/TaskPriorityChart.vue'
import RecentActivity from '../components/RecentActivity.vue'

const analyticsStore = useAnalyticsStore()

function formatLastUpdated(timestamp) {
  const now = new Date()
  const updated = new Date(timestamp)
  const diffInSeconds = Math.floor((now - updated) / 1000)

  if (diffInSeconds < 10) {
    return 'just now'
  } else if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes}m ago`
  } else {
    return updated.toLocaleTimeString()
  }
}

function formatCompletionTime(hours) {
  if (!hours || hours <= 0) {
    return 'N/A'
  }

  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes}m`
  } else if (hours < 24) {
    return `${hours}h`
  } else {
    const days = Math.round((hours / 24) * 10) / 10
    return `${days}d`
  }
}
</script>

<style scoped>
.equal-height-chart {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.equal-height-chart .v-card-text {
  flex: 1;
  display: flex;
  align-items: center;
}
</style>
