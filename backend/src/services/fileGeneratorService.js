/**
 * @fileoverview File generator service for exporting tasks to different formats
 * @module services/fileGeneratorService
 */

/**
 * Service for generating files in different formats (CSV, JSON)
 */
class FileGeneratorService {
  /**
   * Generate a CSV file from task data
   * @param {Array} tasks - Task objects to export
   * @returns {Object} - Buffer and filename
   */
  generateCSV(tasks) {
    // Create CSV content
    const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Created At', 'Updated At', 'Completed At'];
    const rows = [];
    
    // Process each task
    for (const task of tasks) {
      rows.push([
        task._id,
        task.title,
        task.description || '',
        task.status,
        task.priority,
        task.createdAt,
        task.updatedAt,
        task.completedAt || ''
      ]);
    }
    
    // Finalize CSV content
    const csvContent = [
      headers.join(','), 
      ...rows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
    ].join('\n');
    
    const result = Buffer.from(csvContent, 'utf-8');
    const filename = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
    
    return { result, filename };
  }

  /**
   * Generate a JSON file from task data
   * @param {Array} tasks - Task objects to export
   * @returns {Object} - Buffer and filename
   */
  generateJSON(tasks) {
    const result = Buffer.from(JSON.stringify(tasks, null, 2), 'utf-8');
    const filename = `tasks_export_${new Date().toISOString().split('T')[0]}.json`;
    
    return { result, filename };
  }

  /**
   * Generate a file in the specified format
   * @param {Array} tasks - Task objects to export
   * @param {string} format - Export format ('csv' or 'json')
   * @returns {Object} - Buffer and filename
   */
  generateFile(tasks, format) {
    // Explicitly log what we're doing
    if (format === 'json') {
      console.log('GENERATING JSON FILE');
      // Always directly call JSON generator for json format
      return this.generateJSON(tasks);
    } else {
      console.log('GENERATING CSV FILE');
      return this.generateCSV(tasks);
    }
  }
}

export default new FileGeneratorService();