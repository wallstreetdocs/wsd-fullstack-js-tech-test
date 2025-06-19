/**
 * @fileoverview Export service for background task exports
 * @module services/exportService
 */

import Task from '../models/Task.js';
import ExportJob from '../models/ExportJob.js';

class ExportService {
  /**
   * Create a new export job
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format ('csv' or 'json')
   * @param {Object} params.filters - Filter parameters
   * @param {string} [params.clientId] - Client socket ID for tracking
   * @returns {Promise<Object>} Created export job
   */
  async createExportJob(params) {
    const { format, filters, clientId } = params;
    
    // Create a new export job
    const exportJob = new ExportJob({
      format,
      filters,
      clientId,
      status: 'pending'
    });
    
    await exportJob.save();
    return exportJob;
  }

  /**
   * Process an export job in the background
   * @param {Object} job - Export job object
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<Object>} Completed export job
   */
  async processExportJob(job, progressCallback) {
    try {
      console.log(`Starting export job processing: ${job._id}, format: ${job.format}`);
      
      // Update job status to processing
      job.status = 'processing';
      await job.save();
      
      // Fetch the job again to ensure we have the latest state
      job = await ExportJob.findById(job._id);
      
      // Notify of job start
      if (progressCallback) {
        progressCallback(job);
      }
      
      // Construct query from filters
      const query = {};
      if (job.filters.status) query.status = job.filters.status;
      if (job.filters.priority) query.priority = job.filters.priority;
      
      // Set up sorting
      const sort = {};
      sort[job.filters.sortBy || 'createdAt'] = job.filters.sortOrder === 'desc' ? -1 : 1;
      
      // Get total count for progress tracking
      const totalCount = await Task.countDocuments(query);
      job.totalItems = totalCount;
      await job.save();
      
      console.log(`Export job ${job._id} found ${totalCount} tasks to process`);
      
      // Get all tasks matching the query
      const tasks = await Task.find(query).sort(sort).exec();
      
      // Generate export content based on format
      let result;
      let filename;
      
      // Process in chunks to update progress
      const chunkSize = Math.max(Math.floor(tasks.length / 10), 1); // Update progress ~10 times
      
      if (job.format === 'csv') {
        // Create CSV content
        const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Created At', 'Updated At', 'Completed At'];
        const rows = [];
        
        console.log(`Processing CSV export in chunks of ${chunkSize} tasks`);
        
        // Process tasks in chunks
        for (let i = 0; i < tasks.length; i += chunkSize) {
          const chunk = tasks.slice(i, i + chunkSize);
          
          // Process each task in the chunk
          for (const task of chunk) {
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
          
          // Update progress - force a new percentage calculation
          const currentProgress = Math.min(i + chunkSize, tasks.length);
          job.processedItems = currentProgress;
          job.totalItems = totalCount;
          job.progress = Math.floor((currentProgress / totalCount) * 100);
          job.status = 'processing'; // Ensure status stays as processing
          await job.save();
          
          console.log(`Export job ${job._id} progress: ${job.progress}% (${currentProgress}/${totalCount})`);
          
          // Send progress update
          if (progressCallback) {
            // Get a fresh copy to ensure we have the latest state
            const updatedJob = await ExportJob.findById(job._id);
            progressCallback(updatedJob);
          }
          
          // Check if job has been paused or cancelled
          const refreshedJob = await ExportJob.findById(job._id);
          if (refreshedJob.status === 'paused') {
            console.log(`Export job ${job._id} was paused, exiting early`);
            return refreshedJob; // Exit early if paused
          }
        }
        
        // Finalize CSV content
        const csvContent = [
          headers.join(','), 
          ...rows.map(row => 
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`)
              .join(',')
          )
        ].join('\n');
        
        result = Buffer.from(csvContent, 'utf-8');
        filename = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        // JSON format
        const jsonOutput = [];
        
        console.log(`Processing JSON export in chunks of ${chunkSize} tasks`);
        
        // Process tasks in chunks
        for (let i = 0; i < tasks.length; i += chunkSize) {
          const chunk = tasks.slice(i, i + chunkSize);
          
          // Add tasks to output
          jsonOutput.push(...chunk);
          
          // Update progress - force a new percentage calculation
          const currentProgress = Math.min(i + chunkSize, tasks.length);
          job.processedItems = currentProgress;
          job.totalItems = totalCount;
          job.progress = Math.floor((currentProgress / totalCount) * 100);
          job.status = 'processing'; // Ensure status stays as processing
          await job.save();
          
          console.log(`Export job ${job._id} progress: ${job.progress}% (${currentProgress}/${totalCount})`);
          
          // Send progress update
          if (progressCallback) {
            // Get a fresh copy to ensure we have the latest state
            const updatedJob = await ExportJob.findById(job._id);
            progressCallback(updatedJob);
          }
          
          // Check if job has been paused or cancelled
          const refreshedJob = await ExportJob.findById(job._id);
          if (refreshedJob.status === 'paused') {
            console.log(`Export job ${job._id} was paused, exiting early`);
            return refreshedJob; // Exit early if paused
          }
        }
        
        result = Buffer.from(JSON.stringify(jsonOutput, null, 2), 'utf-8');
        filename = `tasks_export_${new Date().toISOString().split('T')[0]}.json`;
      }
      
      // Complete the job
      job.status = 'completed';
      job.progress = 100;
      job.result = result;
      job.filename = filename;
      await job.save();
      
      console.log(`Export job ${job._id} completed successfully, file: ${filename}`);
      
      // Final progress update
      if (progressCallback) {
        // Get a fresh copy for the final update
        const completedJob = await ExportJob.findById(job._id);
        progressCallback(completedJob);
      }
      
      return job;
    } catch (error) {
      console.error('Error processing export job:', error);
      await job.fail(error);
      
      if (progressCallback) {
        progressCallback(job);
      }
      
      throw error;
    }
  }

  /**
   * Pause an export job
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Updated export job
   */
  async pauseExportJob(jobId) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }
    
    if (job.status === 'processing') {
      await job.pause();
    }
    
    return job;
  }

  /**
   * Resume an export job
   * @param {string} jobId - Export job ID
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Promise<Object>} Resumed export job
   */
  async resumeExportJob(jobId, progressCallback) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }
    
    if (job.status === 'paused') {
      await job.resume();
      return this.processExportJob(job, progressCallback);
    }
    
    return job;
  }

  /**
   * Get an export job by ID
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Export job
   */
  async getExportJob(jobId) {
    return ExportJob.findById(jobId);
  }

  /**
   * Get export jobs for a client
   * @param {string} clientId - Client socket ID
   * @returns {Promise<Array>} Export jobs
   */
  async getClientExportJobs(clientId) {
    return ExportJob.find({ clientId }).sort({ createdAt: -1 });
  }

  /**
   * Get download data for a completed export job
   * @param {string} jobId - Export job ID
   * @returns {Promise<Object>} Export data with content and filename
   */
  async getExportDownload(jobId) {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }
    
    if (job.status !== 'completed') {
      throw new Error('Export is not completed yet');
    }
    
    return {
      content: job.result,
      filename: job.filename,
      format: job.format
    };
  }

  /**
   * Get recent export jobs with pagination
   * @param {number} [page=1] - Page number
   * @param {number} [limit=10] - Items per page
   * @returns {Promise<Object>} Paginated export jobs
   */
  async getExportHistory(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const jobs = await ExportJob.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await ExportJob.countDocuments();
    
    return {
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

export default new ExportService();