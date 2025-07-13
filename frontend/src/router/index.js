/**
 * @fileoverview Vue Router configuration for application navigation
 * @module router/index
 */

import { createRouter, createWebHistory } from 'vue-router'

/**
 * Application route definitions
 * @type {Array<Object>}
 * @description Defines all available routes in the application
 */
const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue')
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('../views/Tasks.vue')
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: () => import('../views/Analytics.vue')
  },
  {
    path: '/export-history',
    name: 'ExportHistory',
    component: () => import('../views/ExportHistory.vue')
  }
]

/**
 * Vue Router instance configured with HTML5 history mode
 * @type {Router}
 * @description Main application router for navigation between views
 */
const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
