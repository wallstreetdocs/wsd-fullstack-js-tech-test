/**
 * @fileoverview Test script for Redis queue system
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function testQueueSystem() {
  console.log('🧪 Testing Redis queue system...\n');

  try {
    // 1. Check queue status
    console.log('1. Checking queue status...');
    const statusResponse = await fetch(`${API_BASE}/exports/queue/status`);
    const statusData = await statusResponse.json();
    console.log('Queue status:', statusData);

    // 2. Create a test export
    console.log('\n2. Creating test export...');
    const exportResponse = await fetch(`${API_BASE}/exports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        format: 'csv',
        filters: { status: 'completed' },
        options: { sortBy: 'createdAt', sortOrder: 'desc' }
      })
    });
    const exportData = await exportResponse.json();
    console.log('Export created:', exportData);

    // 3. Check queue status again
    console.log('\n3. Checking queue status after export...');
    const statusResponse2 = await fetch(`${API_BASE}/exports/queue/status`);
    const statusData2 = await statusResponse2.json();
    console.log('Queue status after export:', statusData2);

    // 4. Wait a bit and check again
    console.log('\n4. Waiting 5 seconds for job processing...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const statusResponse3 = await fetch(`${API_BASE}/exports/queue/status`);
    const statusData3 = await statusResponse3.json();
    console.log('Queue status after 5 seconds:', statusData3);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testQueueSystem();
