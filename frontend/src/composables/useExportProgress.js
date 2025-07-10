import { onUnmounted, ref } from 'vue'
import socket from '../plugins/socket.js'

/**
 * Composable to track export progress and completion via Socket.IO
 * - Listens for 'export:progress' (percent)
 * - Listens for 'export:complete' (download link)
 * - Resets state on unmount
 */
export function useExportProgress() {
  const percent = ref(0)
  const downloadLink = ref('')

  function onProgress(data) {
    percent.value = data.percent || 0
  }

  function onComplete(data) {
    percent.value = 100
    downloadLink.value = data.downloadLink || ''
  }

  socket.on('export:progress', onProgress)
  socket.on('export:complete', onComplete)

  onUnmounted(() => {
    socket.off('export:progress', onProgress)
    socket.off('export:complete', onComplete)
    percent.value = 0
    downloadLink.value = ''
  })

  return { percent, downloadLink }
}
