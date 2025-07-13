#!/usr/bin/env node
/**
 * @fileoverview Sample task data generator for the Task Analytics Dashboard
 * @description Generates realistic sample tasks with various statuses, priorities, and completion times
 * @usage npm run seed or node scripts/seed-tasks.js
 */

import mongoose from 'mongoose';
import { connectMongoDB } from '../src/config/database.js';
import Task from '../src/models/Task.js';
import ExportHistory from '../src/models/ExportHistory.js';

/**
 * Sample task titles categorized by type
 */
const TASK_TEMPLATES = {
  development: [
    'Implement user authentication system',
    'Fix responsive design issues on mobile',
    'Optimize database query performance',
    'Add unit tests for API endpoints',
    'Refactor legacy codebase components',
    'Setup CI/CD pipeline configuration',
    'Implement error handling middleware',
    'Create API documentation',
    'Add real-time notifications feature',
    'Setup monitoring and logging system'
  ],
  design: [
    'Create wireframes for new dashboard',
    'Design user onboarding flow',
    'Update brand color palette',
    'Create icon set for navigation',
    'Design mobile app interface',
    'Update marketing website layout',
    'Create user persona documentation',
    'Design email templates',
    'Update component library',
    'Create accessibility guidelines'
  ],
  planning: [
    'Review quarterly project goals',
    'Plan sprint backlog for next iteration',
    'Conduct user research interviews',
    'Analyze competitor feature analysis',
    'Define technical requirements document',
    'Schedule team retrospective meeting',
    'Review and update project timeline',
    'Prepare stakeholder presentation',
    'Define acceptance criteria for features',
    'Plan database migration strategy'
  ],
  maintenance: [
    'Update dependencies to latest versions',
    'Clean up unused code and files',
    'Backup production database',
    'Review and update security policies',
    'Monitor system performance metrics',
    'Update server configurations',
    'Review error logs and fix issues',
    'Optimize image assets for web',
    'Update documentation wiki',
    'Audit third-party integrations'
  ]
};

/**
 * Sample descriptions matching each task category
 */
const DESCRIPTIONS = {
  development: [
    'Implement secure authentication with JWT tokens, password hashing, and session management. Include password reset functionality and email verification.',
    'Address layout issues on tablets and smartphones. Ensure proper touch interactions and optimize for various screen sizes.',
    'Analyze slow-running queries and implement indexing strategies. Consider query optimization and caching mechanisms.',
    'Write comprehensive test coverage for all API endpoints including edge cases, error scenarios, and authentication flows.',
    'Modernize outdated code patterns, improve code structure, and enhance maintainability while preserving functionality.',
    'Configure automated testing, building, and deployment pipeline with proper staging environments and rollback capabilities.',
    'Create robust error handling system with proper logging, user-friendly messages, and graceful degradation.',
    'Generate comprehensive API documentation with examples, authentication details, and integration guides.',
    'Build real-time notification system using WebSockets with proper error handling and offline support.',
    'Setup application monitoring with metrics collection, alerting, and log aggregation for production systems.'
  ],
  design: [
    'Create detailed wireframes showing user flow, navigation structure, and key interface elements for the new dashboard.',
    'Design intuitive step-by-step onboarding process to help new users understand key features and get started quickly.',
    'Refresh brand colors to align with current design trends while maintaining accessibility and brand recognition.',
    'Design consistent icon set for navigation elements ensuring clarity, accessibility, and visual harmony across the interface.',
    'Create mobile-first interface design with touch-optimized interactions and responsive layout patterns.',
    'Redesign marketing pages with improved conversion focus, better content hierarchy, and modern visual appeal.',
    'Document target user personas with demographics, goals, pain points, and behavioral patterns for better product decisions.',
    'Design responsive email templates for notifications, newsletters, and transactional messages with dark mode support.',
    'Update design system components with latest patterns, improved accessibility, and consistent spacing guidelines.',
    'Establish accessibility standards including color contrast ratios, keyboard navigation, and screen reader compatibility.'
  ],
  planning: [
    'Conduct comprehensive review of quarterly objectives, assess progress against goals, and identify areas for improvement.',
    'Prioritize and estimate user stories for upcoming sprint, ensuring balanced workload and clear acceptance criteria.',
    'Schedule and conduct user interviews to gather feedback on current features and understand future needs.',
    'Research competitor features, pricing strategies, and market positioning to identify opportunities and threats.',
    'Document detailed technical specifications including architecture decisions, data models, and integration requirements.',
    'Facilitate team retrospective to discuss what went well, areas for improvement, and actionable next steps.',
    'Update project timeline with realistic estimates, dependency mapping, and risk mitigation strategies.',
    'Prepare executive presentation with project status, key metrics, upcoming milestones, and resource requirements.',
    'Define clear, testable acceptance criteria for all user stories ensuring shared understanding across the team.',
    'Plan database schema changes, migration scripts, and rollback procedures for upcoming feature releases.'
  ],
  maintenance: [
    'Review and update all project dependencies, checking for security vulnerabilities and breaking changes.',
    'Audit codebase for unused imports, dead code, and outdated patterns. Clean up and optimize for better performance.',
    'Perform scheduled backup of production database with verification of backup integrity and restore procedures.',
    'Review current security policies, access controls, and compliance requirements. Update based on latest best practices.',
    'Analyze system performance metrics, identify bottlenecks, and implement optimizations for better user experience.',
    'Update server configurations for security patches, performance improvements, and compliance requirements.',
    'Investigate recent error patterns, implement fixes, and establish monitoring to prevent similar issues.',
    'Compress and optimize images for faster loading times while maintaining visual quality across all devices.',
    'Update internal documentation, API guides, and onboarding materials to reflect recent changes and improvements.',
    'Review third-party service integrations for security, performance, and cost optimization opportunities.'
  ]
};

/**
 * Generate a random date between two dates
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Date} Random date between start and end
 */
function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Generate a random number between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random number between min and max
 */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get a random element from an array
 * @param {Array} array - Source array
 * @returns {*} Random element from array
 */
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate sample tasks with realistic data distribution
 * @param {number} count - Number of tasks to generate
 * @returns {Array} Array of task objects
 */
function generateSampleTasks(count = 50) {
  const tasks = [];
  const categories = Object.keys(TASK_TEMPLATES);
  const statuses = ['pending', 'in-progress', 'completed'];
  const priorities = ['low', 'medium', 'high'];
  
  // Status distribution: 40% completed, 30% in-progress, 30% pending
  const statusWeights = {
    'completed': 0.4,
    'in-progress': 0.3,
    'pending': 0.3
  };
  
  // Priority distribution: 20% high, 50% medium, 30% low
  const priorityWeights = {
    'high': 0.2,
    'medium': 0.5,
    'low': 0.3
  };
  
  // Date ranges for realistic task creation
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
  const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  
  for (let i = 0; i < count; i++) {
    // Select random category and corresponding task
    const category = getRandomElement(categories);
    const taskTitles = TASK_TEMPLATES[category];
    const taskDescriptions = DESCRIPTIONS[category];
    
    const titleIndex = getRandomInt(0, taskTitles.length - 1);
    const title = taskTitles[titleIndex];
    const description = taskDescriptions[titleIndex];
    
    // Weight-based random selection for status and priority
    const statusRand = Math.random();
    let status;
    if (statusRand < statusWeights.completed) {
      status = 'completed';
    } else if (statusRand < statusWeights.completed + statusWeights['in-progress']) {
      status = 'in-progress';
    } else {
      status = 'pending';
    }
    
    const priorityRand = Math.random();
    let priority;
    if (priorityRand < priorityWeights.high) {
      priority = 'high';
    } else if (priorityRand < priorityWeights.high + priorityWeights.medium) {
      priority = 'medium';
    } else {
      priority = 'low';
    }
    
    // Generate realistic timestamps
    const createdAt = getRandomDate(threeMonthsAgo, now);
    let updatedAt = createdAt;
    let completedAt = null;
    
    // For completed tasks, set completion date
    if (status === 'completed') {
      completedAt = getRandomDate(createdAt, now);
      updatedAt = completedAt;
    } else if (status === 'in-progress') {
      updatedAt = getRandomDate(createdAt, now);
    }
    
    // Generate estimated and actual time (in minutes)
    const estimatedTime = getRandomInt(30, 480); // 30 minutes to 8 hours
    let actualTime = null;
    
    if (status === 'completed') {
      // Actual time can vary from 50% to 150% of estimated time
      const variance = 0.5 + Math.random();
      actualTime = Math.round(estimatedTime * variance);
    }
    
    const task = {
      title,
      description,
      status,
      priority,
      createdAt,
      updatedAt,
      completedAt,
      estimatedTime,
      actualTime
    };
    
    tasks.push(task);
  }
  
  return tasks;
}

/**
 * Generate sample export history with realistic data
 * @param {number} count - Number of export records to generate
 * @returns {Array} Array of export history objects
 */
function generateSampleExportHistory(count = 20) {
  const exports = [];
  const formats = ['csv', 'json'];
  const statuses = ['pending', 'completed', 'failed'];
  
  // Status distribution: 70% completed, 20% failed, 10% pending
  const statusWeights = {
    'completed': 0.7,
    'failed': 0.2,
    'pending': 0.1
  };
  
  // Sample filter combinations that users might use
  const filterCombinations = [
    {},
    { status: ['pending'] },
    { status: ['completed'] },
    { status: ['in-progress'] },
    { priority: ['high'] },
    { priority: ['low', 'medium'] },
    { status: ['pending', 'in-progress'] },
    { createdWithin: 'last-30-days' },
    { createdWithin: 'last-7-days' },
    { status: ['completed'], priority: ['high'] },
    { overdueTasks: true },
    { recentlyCompleted: true },
    { status: ['pending'], createdWithin: 'last-7-days' },
    { priority: ['high'], overdueTasks: true }
  ];
  
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
    'curl/7.68.0',
    'Postman Runtime/7.29.2'
  ];
  
  const ipAddresses = [
    '192.168.1.100',
    '10.0.0.50',
    '172.16.0.25',
    '127.0.0.1',
    '203.0.113.45',
    '198.51.100.78'
  ];
  
  // Date range for export history (last 2 months)
  const now = new Date();
  const twoMonthsAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
  
  for (let i = 0; i < count; i++) {
    // Select format and status
    const format = getRandomElement(formats);
    
    const statusRand = Math.random();
    let status;
    if (statusRand < statusWeights.completed) {
      status = 'completed';
    } else if (statusRand < statusWeights.completed + statusWeights.failed) {
      status = 'failed';
    } else {
      status = 'pending';
    }
    
    // Generate timestamps
    const createdAt = getRandomDate(twoMonthsAgo, now);
    const updatedAt = status === 'pending' ? createdAt : getRandomDate(createdAt, now);
    
    // Generate realistic data based on status
    const totalRecords = getRandomInt(5, 500);
    const filters = getRandomElement(filterCombinations);
    
    // Generate filename
    const timestamp = createdAt.toISOString().replace(/[:.]/g, '-');
    const uniqueId = Math.random().toString(36).substring(2, 8);
    let filterDesc = '';
    if (filters.status) {
      filterDesc += `-${Array.isArray(filters.status) ? filters.status.join('-') : filters.status}`;
    }
    if (filters.priority) {
      filterDesc += `-${Array.isArray(filters.priority) ? filters.priority.join('-') : filters.priority}`;
    }
    const filename = `tasks-export${filterDesc}-${timestamp}-${uniqueId}.${format}`;
    
    const exportRecord = {
      filename,
      format,
      status,
      totalRecords,
      filters,
      ipAddress: getRandomElement(ipAddresses),
      userAgent: getRandomElement(userAgents),
      createdAt,
      updatedAt
    };
    
    // Add completion-specific data
    if (status === 'completed') {
      exportRecord.executionTimeMs = getRandomInt(500, 15000); // 0.5 to 15 seconds
      exportRecord.fileSizeBytes = getRandomInt(1024, 1024 * 1024); // 1KB to 1MB
    } else if (status === 'failed') {
      exportRecord.executionTimeMs = getRandomInt(100, 5000); // Failed faster
      exportRecord.errorMessage = getRandomElement([
        'Database connection timeout',
        'Insufficient memory to process request',
        'Invalid filter parameters provided',
        'Export file size exceeds maximum limit',
        'Temporary storage unavailable',
        'Query execution timeout'
      ]);
    }
    
    exports.push(exportRecord);
  }
  
  return exports;
}

/**
 * Clear existing tasks and seed new sample data
 * @async
 * @function seedTasks
 * @param {number} count - Number of tasks to generate (default: 50)
 * @param {number} exportCount - Number of export history records to generate (default: 20)
 */
async function seedTasks(count = 50, exportCount = 20) {
  try {
    console.log('🌱 Starting task data seeding...');
    
    // Connect to database
    await connectMongoDB();
    
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    const taskDeleteResult = await Task.deleteMany({});
    console.log(`   Deleted ${taskDeleteResult.deletedCount} existing tasks`);
    
    const exportDeleteResult = await ExportHistory.deleteMany({});
    console.log(`   Deleted ${exportDeleteResult.deletedCount} existing export records`);
    
    // Generate sample tasks
    console.log(`🎲 Generating ${count} sample tasks...`);
    const sampleTasks = generateSampleTasks(count);
    
    // Insert tasks into database
    console.log('💾 Inserting tasks into database...');
    const taskInsertResult = await Task.insertMany(sampleTasks);
    console.log(`   Successfully inserted ${taskInsertResult.length} tasks`);
    
    // Generate sample export history
    console.log(`📊 Generating ${exportCount} sample export records...`);
    const sampleExports = generateSampleExportHistory(exportCount);
    
    // Insert export history into database
    console.log('💾 Inserting export history into database...');
    const exportInsertResult = await ExportHistory.insertMany(sampleExports);
    console.log(`   Successfully inserted ${exportInsertResult.length} export records`);
    
    // Display summary statistics
    const stats = await Task.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const priorityStats = await Task.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    console.log('\n📊 Task Summary:');
    console.log('Status Distribution:');
    stats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} tasks`);
    });
    
    console.log('Priority Distribution:');
    priorityStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} tasks`);
    });
    
    // Display export history statistics
    const exportStats = await ExportHistory.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const formatStats = await ExportHistory.aggregate([
      {
        $group: {
          _id: '$format',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: 'completed' });
    const completionRate = ((completedTasks / totalTasks) * 100).toFixed(1);
    
    const totalExports = await ExportHistory.countDocuments();
    const completedExports = await ExportHistory.countDocuments({ status: 'completed' });
    const exportSuccessRate = totalExports > 0 ? ((completedExports / totalExports) * 100).toFixed(1) : 0;
    
    console.log('\n📊 Export History Summary:');
    console.log('Status Distribution:');
    exportStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} exports`);
    });
    
    console.log('Format Distribution:');
    formatStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} exports`);
    });
    
    console.log(`\n✅ Seeding completed successfully!`);
    console.log(`   Total tasks: ${totalTasks}`);
    console.log(`   Task completion rate: ${completionRate}%`);
    console.log(`   Total exports: ${totalExports}`);
    console.log(`   Export success rate: ${exportSuccessRate}%`);
    
  } catch (error) {
    console.error('❌ Error seeding tasks:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run seeding if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const count = process.argv[2] ? parseInt(process.argv[2]) : 50;
  const exportCount = process.argv[3] ? parseInt(process.argv[3]) : 20;
  
  if (isNaN(count) || count <= 0) {
    console.error('❌ Please provide a valid number of tasks to generate');
    console.log('Usage: node scripts/seed-tasks.js [taskCount] [exportCount]');
    process.exit(1);
  }
  
  if (isNaN(exportCount) || exportCount < 0) {
    console.error('❌ Please provide a valid number of export records to generate');
    console.log('Usage: node scripts/seed-tasks.js [taskCount] [exportCount]');
    process.exit(1);
  }
  
  console.log(`🚀 Seeding ${count} sample tasks and ${exportCount} export records...`);
  seedTasks(count, exportCount);
}

export { seedTasks, generateSampleTasks, generateSampleExportHistory };