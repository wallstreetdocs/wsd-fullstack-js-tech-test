/**
 * @fileoverview Download utility functions
 * @module utils/download
 */

/**
 * Downloads a blob as a file using browser download mechanism
 * @param {Blob} blob - File blob to download
 * @param {string} filename - Name for the downloaded file
 */
export function downloadFile(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up the object URL to free memory
  window.URL.revokeObjectURL(url)
}

/**
 * Downloads a file from the API using the export download endpoint
 * @async
 * @param {string} filename - Export filename to download
 * @param {Function} apiDownloadMethod - API client download method
 * @returns {Promise<void>}
 * @throws {Error} Download errors
 */
export async function downloadExportFile(filename, apiDownloadMethod) {
  try {
    const { blob, filename: downloadFilename } =
      await apiDownloadMethod(filename)
    downloadFile(blob, downloadFilename)
  } catch (error) {
    console.error('Failed to download export file:', error)
    throw new Error(`Download failed: ${error.message}`)
  }
}
