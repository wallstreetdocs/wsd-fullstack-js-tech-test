/**
 * @fileoverview Socket.IO client configuration for real-time communication
 * @module plugins/socket
 */

import { io } from 'socket.io-client'

/**
 * Socket.IO client instance configured with auto-reconnection
 * @type {Socket}
 */
const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000
})

socket.on('connect', () => {
  console.log('✅ Connected to server')
  window.dispatchEvent(new CustomEvent('socket:connect'))
})

socket.on('disconnect', (reason) => {
  console.log(`🔌 Disconnected from server: ${reason}`)
  window.dispatchEvent(new CustomEvent('socket:disconnect', { detail: { reason } }))
})

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error)
  window.dispatchEvent(new CustomEvent('socket:error', { detail: { error: error.message } }))
})

// Socket.IO built-in reconnect events
socket.io.on('reconnect_attempt', (attempt) => {
  console.log(`Reconnection attempt ${attempt}`)
  window.dispatchEvent(new CustomEvent('socket:reconnect_attempt', { 
    detail: { attempt }
  }))
})

socket.io.on('reconnect', (attempt) => {
  console.log(`Reconnected on attempt ${attempt}`)
  window.dispatchEvent(new CustomEvent('socket:reconnect', { 
    detail: { attempt }
  }))
})

socket.io.on('reconnect_failed', () => {
  console.error('Failed to reconnect after all attempts')
  window.dispatchEvent(new CustomEvent('socket:reconnect_failed'))
})

/**
 * Resets connection and attempts to reconnect immediately
 */
socket.resetConnection = function() {
  if (socket.connected) {
    socket.disconnect()
  }
  
  // Attempt to reconnect immediately
  setTimeout(() => {
    socket.connect()
  }, 100)
}

export default socket
