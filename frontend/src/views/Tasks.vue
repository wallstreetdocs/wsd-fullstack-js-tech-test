<!--
/**
 * @fileoverview Tasks view page - wrapper for TaskList component
 * @component Tasks
 * @description Simple view component that renders the TaskList component
 */
-->

<template>
  <task-list :enable-export="true" />
</template>

<script setup>
/**
 * @module Tasks
 * @description Tasks view wrapper component
 */
import TaskList from '../components/TaskList.vue'
</script>
