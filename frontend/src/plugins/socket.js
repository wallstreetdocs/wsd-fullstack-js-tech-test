/**
 * @fileoverview Socket.IO client configuration for real-time communication
 * @module plugins/socket
 */

import { io } from 'socket.io-client'

/**
 * Socket.IO client instance configured for the task management backend
 * @type {Socket}
 * @description Configured with manual connection control and fallback transports
 */
const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
console.log('🔌 Socket connecting to:', socketUrl)

const socket = io(socketUrl, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  timeout: 20000,
  forceNew: true
})

// Add comprehensive debugging
socket.on('connect', () => {
  console.log('✅ Connected to server at:', socketUrl)
  console.log('🔌 Socket ID:', socket.id)
  console.log('🔌 Socket connected:', socket.connected)
})

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected from server. Reason:', reason)
  console.log('🔌 Socket connected:', socket.connected)
})

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error)
  console.error('❌ Socket URL:', socketUrl)
  console.error('❌ Error details:', {
    message: error.message,
    description: error.description,
    context: error.context
  })
})

socket.on('error', (error) => {
  console.error('❌ Socket error:', error)
})

// Test event listener for export-progress events specifically
socket.on('export-progress', (data) => {
  console.log('📡 Received export-progress event:', data)
})

// Test event listener for any other events
socket.on('analytics-update', (data) => {
  console.log('📡 Received analytics-update event:', data)
})

socket.on('task-update', (data) => {
  console.log('📡 Received task-update event:', data)
})

socket.on('notification', (data) => {
  console.log('📡 Received notification event:', data)
})

export default socket
