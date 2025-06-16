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
const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
  autoConnect: false,
  transports: ['websocket', 'polling']
})

socket.on('connect', () => {
  console.log('✅ Connected to server')
})

socket.on('disconnect', () => {
  console.log('🔌 Disconnected from server')
})

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error)
})

export default socket