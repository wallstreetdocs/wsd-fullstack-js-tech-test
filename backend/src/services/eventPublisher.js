import { getIO } from '../socket';

export function publishExportEvent(userId, eventData) {
  // Get the Socket.IO instance from our existing setup
  const io = getIO();

  // Emit to a user-specific room
  io.to(`user_${userId}`).emit('export_event', eventData);
}
