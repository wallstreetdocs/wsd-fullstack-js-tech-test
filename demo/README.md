# Task Analytics Demo

This demo application showcases all the features of the Task Analytics Dashboard.

## Features Demonstrated

- ✅ REST API endpoints (CRUD operations)
- ✅ MongoDB data persistence
- ✅ Redis caching for individual task lookups
- ✅ Real-time Socket.IO updates
- ✅ Analytics engine with live metrics
- ✅ Notification system
- ✅ Error handling and validation

## Prerequisites

Before running the demo, ensure you have:

1. **Docker and Docker Compose** installed
2. **Node.js v24+** installed
3. **Backend and database services running**

## Setup Instructions

### 1. Start the Database Services

```bash
# From the project root directory
docker-compose up -d
```

This will start:
- MongoDB on port 27018 (no authentication)
- Redis on port 6380 (no authentication)

### 2. Start the Backend API

```bash
# From the project root directory
cd backend
npm install
npm run dev
```

The backend will start on `http://localhost:3001`

### 3. Install Demo Dependencies

```bash
# From the project root directory
cd demo
npm install
```

### 4. Run the Demo

```bash
npm start
```

## What the Demo Does

The demo will:

1. **Health Check**: Verify the API is running
2. **Socket Connection**: Connect to real-time features
3. **Task CRUD**: Create, read, update sample tasks
4. **Caching**: Demonstrate Redis caching performance
5. **Analytics**: Show real-time metrics calculation
6. **Real-time Updates**: Display live notifications and updates

## Expected Output

You should see output similar to:

```
🚀 Starting Task Analytics Demo
================================

🔍 Testing API Health Check...
✅ API is healthy

🔌 Connecting to Socket.IO...
✅ Socket.IO connected

📝 Demonstrating Task CRUD Operations...
📝 Creating sample tasks...
   ✅ Created: Setup Development Environment
   ✅ Created: Implement User Authentication
   ...

📊 Real-time analytics update received: {
  totalTasks: 5,
  completionRate: 20%,
  tasksCreatedToday: 5
}

✅ Demo completed successfully!
```

## Testing Different Scenarios

You can modify the demo script to test:

- Different task priorities and statuses
- Pagination with large datasets
- Error handling (invalid data)
- Performance under load

## Troubleshooting

If the demo fails:

1. Check that MongoDB and Redis are running:
   ```bash
   docker-compose ps
   ```

2. Verify the backend is accessible:
   ```bash
   curl http://localhost:3001/api/health
   ```

3. Test database connections:
   ```bash
   mongosh "mongodb://localhost:27018/task_analytics"
   redis-cli -h localhost -p 6380 ping
   ```

3. Check the console logs for specific error messages

## Frontend Demo

To see the complete UI in action:

```bash
# In a new terminal, from project root
cd frontend
npm install
npm run dev
```

Then visit `http://localhost:5173` to see the full dashboard interface.