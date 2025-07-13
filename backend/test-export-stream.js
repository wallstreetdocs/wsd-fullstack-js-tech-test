/**
 * Test script for streaming export functionality
 * This script tests the export service with streaming to ensure it handles large datasets efficiently
 */

import mongoose from 'mongoose';
import ExportService from './src/services/exportService.js';
import Task from './src/models/Task.js';
import { config } from './src/config/database.js';

// Connect to database
await mongoose.connect(config.url);

console.log('🚀 Testing streaming export functionality...\n');

try {
  // Create test data (if needed)
  const taskCount = await Task.countDocuments();
  console.log(`📊 Current task count: ${taskCount}`);

  if (taskCount < 100) {
    console.log('📝 Creating test data...');
    const testTasks = [];
    for (let i = 1; i <= 100; i++) {
      testTasks.push({
        title: `Test Task ${i}`,
        description: `This is test task number ${i} for streaming export testing`,
        status: ['pending', 'in-progress', 'completed'][
          Math.floor(Math.random() * 3)
        ],
        priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        estimatedTime: Math.floor(Math.random() * 120) + 30,
        actualTime: Math.floor(Math.random() * 180) + 20,
        createdAt: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
        )
      });
    }
    await Task.insertMany(testTasks);
    console.log('✅ Test data created');
  }

  // Test CSV export with streaming
  console.log('\n📄 Testing CSV export with streaming...');
  const csvStartTime = Date.now();

  const csvResult = await ExportService.createExport({
    format: 'csv',
    filters: {},
    options: {
      sortBy: 'createdAt',
      sortOrder: 'desc'
    }
  });

  const csvEndTime = Date.now();
  console.log(`✅ CSV export completed in ${csvEndTime - csvStartTime}ms`);
  console.log(`📊 Records exported: ${csvResult.recordCount}`);
  console.log(`📁 File path: ${csvResult.filePath}`);

  // Test JSON export with streaming
  console.log('\n📄 Testing JSON export with streaming...');
  const jsonStartTime = Date.now();

  const jsonResult = await ExportService.createExport({
    format: 'json',
    filters: {
      status: 'completed'
    },
    options: {
      sortBy: 'completedAt',
      sortOrder: 'desc'
    }
  });

  const jsonEndTime = Date.now();
  console.log(`✅ JSON export completed in ${jsonEndTime - jsonStartTime}ms`);
  console.log(`📊 Records exported: ${jsonResult.recordCount}`);
  console.log(`📁 File path: ${jsonResult.filePath}`);

  // Test with filters
  console.log('\n🔍 Testing filtered export...');
  const filterStartTime = Date.now();

  const filterResult = await ExportService.createExport({
    format: 'csv',
    filters: {
      priority: 'high',
      status: ['pending', 'in-progress']
    },
    options: {
      sortBy: 'createdAt',
      sortOrder: 'asc'
    }
  });

  const filterEndTime = Date.now();
  console.log(
    `✅ Filtered export completed in ${filterEndTime - filterStartTime}ms`
  );
  console.log(`📊 Records exported: ${filterResult.recordCount}`);
  console.log(`📁 File path: ${filterResult.filePath}`);

  console.log('\n🎉 All streaming export tests completed successfully!');
  console.log('\n📈 Performance Summary:');
  console.log(
    `- CSV Export: ${csvEndTime - csvStartTime}ms for ${csvResult.recordCount} records`
  );
  console.log(
    `- JSON Export: ${jsonEndTime - jsonStartTime}ms for ${jsonResult.recordCount} records`
  );
  console.log(
    `- Filtered Export: ${filterEndTime - filterStartTime}ms for ${filterResult.recordCount} records`
  );
} catch (error) {
  console.error('❌ Test failed:', error);
} finally {
  await mongoose.disconnect();
  console.log('\n🔌 Database connection closed');
}
