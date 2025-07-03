<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">System Audit</h1>

        <v-tabs v-model="activeTab" bg-color="primary">
          <v-tab value="exports">Export Activity</v-tab>
        </v-tabs>

        <v-window v-model="activeTab">
          <v-window-item value="exports">
            <export-audit-list />
          </v-window-item>
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
