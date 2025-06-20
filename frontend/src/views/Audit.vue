<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">System Audit</h1>

        <v-tabs v-model="activeTab" bg-color="primary">
          <v-tab value="exports">Export Activity</v-tab>
          <!-- Additional audit tabs can be added here in the future -->
          <!-- <v-tab value="users">User Activity</v-tab> -->
          <!-- <v-tab value="system">System Events</v-tab> -->
        </v-tabs>

        <v-window v-model="activeTab">
          <v-window-item value="exports">
            <export-audit-list />
          </v-window-item>
          <!-- Additional audit content panels can be added here in the future -->
          <!-- <v-window-item value="users">User audit content</v-window-item> -->
          <!-- <v-window-item value="system">System audit content</v-window-item> -->
        </v-window>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from 'vue'
import ExportAuditList from '../components/ExportAuditList.vue'

const activeTab = ref('exports')
</script>
