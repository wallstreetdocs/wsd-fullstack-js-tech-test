<!--
/**
 * @fileoverview Tasks view with advanced query builder and task management
 * @component Tasks
 * @description Main tasks page with comprehensive filtering, search, and CRUD operations
 */
-->

<template>
  <div class="tasks-view">
    <v-container fluid>
      <v-row>
        <v-col cols="12">
          <task-list />
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup>
import TaskList from '../components/TaskList.vue'
</script>

<style scoped>
.tasks-view {
  min-height: 100vh;
  background-color: #f5f5f5;
}
</style>
