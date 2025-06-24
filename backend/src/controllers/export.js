import Task from '../models/Task.js';
import Export from '../models/ExportHistroy.js';
import { generateCsv, generateJson } from '../utils/export.js';
import { publishExportEvent } from '../services/eventPublisher';

export async function exportTasks({ userId, format, filters }) {
  // Create export record
  const exportRecord = new Export({
    user: userId,
    format,
    filters,
    status: 'processing'
  });
  await exportRecord.save();

  // Process in background
  processExport(exportRecord);

  return exportRecord._id;
}

async function processExport(exportRecord) {
  try {
    // Get filtered tasks
    const tasks = await Task.find(exportRecord.filters).lean();

    // Generate file
    let fileData;
    if (exportRecord.format === 'csv') {
      fileData = generateCsv(tasks);
    } else {
      fileData = generateJson(tasks);
    }

    // Update export record
    exportRecord.status = 'completed';
    exportRecord.fileData = fileData;
    exportRecord.completedAt = new Date();
    await exportRecord.save();

    // Notify via WebSocket
    publishExportEvent({
      userId: exportRecord.user,
      exportId: exportRecord._id,
      status: 'completed'
    });
  } catch (error) {
    exportRecord.status = 'failed';
    exportRecord.error = error.message;
    await exportRecord.save();

    publishExportEvent({
      userId: exportRecord.user,
      exportId: exportRecord._id,
      status: 'failed',
      error: error.message
    });
  }
}
