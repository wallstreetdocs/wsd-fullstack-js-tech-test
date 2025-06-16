import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3001/api';

class TaskAnalyticsDemo {
  constructor() {
    this.socket = null;
    this.tasks = [];
  }

  async init() {
    console.log('🚀 Starting Task Analytics Demo');
    console.log('================================');

    try {
      await this.testHealthCheck();
      await this.connectSocket();
      await this.demonstrateTaskCRUD();
      await this.demonstrateAnalytics();
      await this.demonstrateRealTimeFeatures();
      
      console.log('\n✅ Demo completed successfully!');
      console.log('🎯 All features working as expected');
      
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
    } finally {
      if (this.socket) {
        this.socket.disconnect();
      }
    }
  }

  async testHealthCheck() {
    console.log('\n🔍 Testing API Health Check...');
    
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ API is healthy');
    } else {
      throw new Error('API health check failed');
    }
  }

  async connectSocket() {
    console.log('\n🔌 Connecting to Socket.IO...');
    
    return new Promise((resolve, reject) => {
      this.socket = io('http://localhost:3001');
      
      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected');
        this.socket.emit('join-analytics');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        reject(new Error(`Socket connection failed: ${error.message}`));
      });

      this.socket.on('analytics-update', (data) => {
        console.log('📊 Real-time analytics update received:', {
          totalTasks: data.totalTasks,
          completionRate: data.completionRate + '%',
          tasksCreatedToday: data.tasksCreatedToday
        });
      });

      this.socket.on('task-update', (data) => {
        console.log(`📝 Real-time task update: ${data.action} - ${data.task.title}`);
      });

      this.socket.on('notification', (notification) => {
        console.log(`🔔 Notification: ${notification.message}`);
      });
    });
  }

  async demonstrateTaskCRUD() {
    console.log('\n📝 Demonstrating Task CRUD Operations...');

    // Create tasks
    console.log('\n📝 Creating sample tasks...');
    const sampleTasks = [
      { 
        title: 'Setup Development Environment', 
        description: 'Install Node.js, MongoDB, and Redis',
        priority: 'high',
        status: 'completed'
      },
      { 
        title: 'Implement User Authentication', 
        description: 'Add JWT-based authentication system',
        priority: 'high',
        status: 'in-progress'
      },
      { 
        title: 'Write API Documentation', 
        description: 'Document all REST endpoints',
        priority: 'medium',
        status: 'pending'
      },
      { 
        title: 'Setup CI/CD Pipeline', 
        description: 'Configure GitHub Actions',
        priority: 'low',
        status: 'pending'
      },
      { 
        title: 'Performance Optimization', 
        description: 'Optimize database queries',
        priority: 'medium',
        status: 'pending'
      }
    ];

    for (const taskData of sampleTasks) {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      
      const result = await response.json();
      if (result.success) {
        this.tasks.push(result.data);
        console.log(`   ✅ Created: ${result.data.title}`);
      }
      
      // Small delay to demonstrate real-time updates
      await this.delay(500);
    }

    // Read tasks
    console.log('\n📖 Reading tasks...');
    const tasksResponse = await fetch(`${API_BASE}/tasks?limit=20`);
    const tasksData = await tasksResponse.json();
    
    if (tasksData.success) {
      console.log(`   ✅ Retrieved ${tasksData.data.tasks.length} tasks`);
      console.log(`   📊 Pagination: Page ${tasksData.data.pagination.page} of ${tasksData.data.pagination.pages}`);
    }

    // Update a task
    if (this.tasks.length > 0) {
      console.log('\n📝 Updating a task...');
      const taskToUpdate = this.tasks[0];
      
      const updateResponse = await fetch(`${API_BASE}/tasks/${taskToUpdate._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'completed',
          description: 'Updated: Setup completed successfully!'
        })
      });
      
      const updateResult = await updateResponse.json();
      if (updateResult.success) {
        console.log(`   ✅ Updated: ${updateResult.data.title}`);
      }
    }

    // Test individual task retrieval (Redis caching)
    if (this.tasks.length > 0) {
      console.log('\n🗄️  Testing Redis caching...');
      const taskId = this.tasks[0]._id;
      
      // First request (cache miss)
      const start1 = Date.now();
      await fetch(`${API_BASE}/tasks/${taskId}`);
      const time1 = Date.now() - start1;
      
      // Second request (cache hit)
      const start2 = Date.now();
      await fetch(`${API_BASE}/tasks/${taskId}`);
      const time2 = Date.now() - start2;
      
      console.log(`   ✅ Cache test - First: ${time1}ms, Second: ${time2}ms`);
    }
  }

  async demonstrateAnalytics() {
    console.log('\n📊 Demonstrating Analytics Engine...');
    
    const analyticsResponse = await fetch(`${API_BASE}/analytics`);
    const analyticsData = await analyticsResponse.json();
    
    if (analyticsData.success) {
      const metrics = analyticsData.data;
      console.log('   📈 Current Metrics:');
      console.log(`      📝 Total Tasks: ${metrics.totalTasks}`);
      console.log(`      ✅ Completion Rate: ${metrics.completionRate}%`);
      console.log(`      📅 Created Today: ${metrics.tasksCreatedToday}`);
      console.log(`      🎯 Completed Today: ${metrics.tasksCompletedToday}`);
      console.log(`      ⏱️  Average Completion Time: ${metrics.averageCompletionTime}h`);
      
      console.log('\n   📊 Status Distribution:');
      Object.entries(metrics.tasksByStatus).forEach(([status, count]) => {
        console.log(`      ${this.getStatusEmoji(status)} ${status}: ${count}`);
      });
      
      console.log('\n   🚨 Priority Distribution:');
      Object.entries(metrics.tasksByPriority).forEach(([priority, count]) => {
        console.log(`      ${this.getPriorityEmoji(priority)} ${priority}: ${count}`);
      });
    }
  }

  async demonstrateRealTimeFeatures() {
    console.log('\n⚡ Demonstrating Real-time Features...');
    
    // Request real-time analytics
    this.socket.emit('request-analytics');
    
    // Create a high-priority task to trigger notifications
    console.log('\n🔥 Creating high-priority task to trigger notifications...');
    
    const urgentTask = {
      title: 'URGENT: Production Issue',
      description: 'Critical bug affecting users',
      priority: 'high',
      status: 'pending'
    };
    
    await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(urgentTask)
    });
    
    // Wait for real-time updates
    await this.delay(2000);
    
    console.log('   ✅ Real-time features demonstrated');
  }

  getStatusEmoji(status) {
    switch (status) {
      case 'pending': return '⏳';
      case 'in-progress': return '🔄';
      case 'completed': return '✅';
      default: return '❓';
    }
  }

  getPriorityEmoji(priority) {
    switch (priority) {
      case 'low': return '🟢';
      case 'medium': return '🟡';
      case 'high': return '🔴';
      default: return '⚪';
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the demo
const demo = new TaskAnalyticsDemo();
demo.init();