/**
 * @fileoverview API documentation for Swagger/OpenAPI
 * @module docs/api-docs
 *
 * This file contains JSDoc comments that Swagger uses to generate API documentation.
 * The actual route logic is kept clean in the routes files.
 */

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get tasks with advanced filtering
 *     description: |
 *       Retrieve tasks with comprehensive filtering capabilities including text search,
 *       status/priority filtering, date ranges, time analysis, and custom MongoDB conditions.
 *
 *       ## Query Builder Features:
 *       - **Text Search**: Search in title and description
 *       - **Status Filtering**: Filter by pending, in-progress, or completed
 *       - **Priority Filtering**: Filter by low, medium, or high priority
 *       - **Date Ranges**: Filter by creation, update, or completion dates
 *       - **Time Analysis**: Filter by estimated/actual time ranges
 *       - **Time Efficiency**: Find over/under-estimated tasks
 *       - **Custom Conditions**: Advanced MongoDB query conditions
 *       - **Sorting & Pagination**: Flexible result ordering
 *     tags: [Tasks, Query Builder]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search in title and description
 *         example: urgent meeting
 *       - in: query
 *         name: status
 *         schema:
 *           oneOf:
 *             - type: string
 *               enum: [pending, in-progress, completed]
 *             - type: string
 *               description: Comma-separated values
 *         description: Filter by task status (single or comma-separated multiple)
 *         example: pending,completed
 *       - in: query
 *         name: priority
 *         schema:
 *           oneOf:
 *             - type: string
 *               enum: [low, medium, high]
 *             - type: string
 *               description: Comma-separated values
 *         description: Filter by task priority (single or comma-separated multiple)
 *         example: high,medium
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of tasks per page
 *         example: 20
 *     responses:
 *       200:
 *         description: Successfully retrieved tasks
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskList'
 *       400:
 *         description: Bad request - invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /tasks/search:
 *   get:
 *     summary: Advanced search with full-text search
 *     description: |
 *       Perform advanced search with full-text search capabilities and additional filters.
 *       This endpoint is optimized for text-based queries and supports complex filtering.
 *     tags: [Query Builder]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query for full-text search
 *         example: urgent meeting bug fix
 *       - in: query
 *         name: filters
 *         schema:
 *           type: string
 *         description: Additional filters as JSON string
 *         example: '{"status":"pending","priority":"high"}'
 *     responses:
 *       200:
 *         description: Successfully retrieved search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskList'
 *       400:
 *         description: Bad request - invalid JSON in filters or options
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /tasks/query:
 *   post:
 *     summary: Raw query builder for complex queries
 *     description: |
 *       Execute complex queries using the raw query builder interface.
 *       This endpoint accepts complete filter and option objects for maximum flexibility.
 *     tags: [Query Builder]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filters:
 *                 $ref: '#/components/schemas/QueryFilters'
 *               options:
 *                 $ref: '#/components/schemas/QueryOptions'
 *     responses:
 *       200:
 *         description: Successfully executed query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskList'
 *       400:
 *         description: Bad request - invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /tasks/stats:
 *   get:
 *     summary: Get task statistics and counts
 *     description: |
 *       Retrieve comprehensive task statistics including counts by status, priority,
 *       and time efficiency. Supports the same filtering parameters as the main tasks endpoint.
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           oneOf:
 *             - type: string
 *               enum: [pending, in-progress, completed]
 *             - type: string
 *               description: Comma-separated values
 *         description: Filter by task status for statistics
 *         example: pending,completed
 *       - in: query
 *         name: priority
 *         schema:
 *           oneOf:
 *             - type: string
 *               enum: [low, medium, high]
 *             - type: string
 *               description: Comma-separated values
 *         description: Filter by task priority for statistics
 *         example: high,medium
 *     responses:
 *       200:
 *         description: Successfully retrieved task statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskStats'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Get task by ID
 *     description: Retrieve a specific task by its unique identifier with Redis caching for performance.
 *     tags: [Tasks]
 *     parameters:
 *       - $ref: '#/components/parameters/taskId'
 *     responses:
 *       200:
 *         description: Successfully retrieved task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a new task
 *     description: Create a new task with the provided data. Real-time updates will be broadcast to connected clients.
 *     tags: [Tasks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 description: Task title (required)
 *                 example: "Implement user authentication"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Task description (optional)
 *                 example: "Add JWT-based authentication with refresh tokens"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *                 description: Task priority level
 *                 example: "high"
 *               estimatedTime:
 *                 type: number
 *                 minimum: 0
 *                 description: Estimated completion time in minutes
 *                 example: 120
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *                 message:
 *                   type: string
 *                   example: "Task created successfully"
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Update an existing task
 *     description: Update an existing task with the provided data. Real-time updates will be broadcast to connected clients.
 *     tags: [Tasks]
 *     parameters:
 *       - $ref: '#/components/parameters/taskId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 description: Task title
 *                 example: "Implement user authentication"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Task description
 *                 example: "Add JWT-based authentication with refresh tokens"
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed]
 *                 description: Task status
 *                 example: "completed"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Task priority level
 *                 example: "high"
 *               estimatedTime:
 *                 type: number
 *                 minimum: 0
 *                 description: Estimated completion time in minutes
 *                 example: 120
 *               actualTime:
 *                 type: number
 *                 minimum: 0
 *                 description: Actual completion time in minutes
 *                 example: 135
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *                 message:
 *                   type: string
 *                   example: "Task updated successfully"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Delete a task by ID
 *     description: Delete a task by its unique identifier. Real-time updates will be broadcast to connected clients.
 *     tags: [Tasks]
 *     parameters:
 *       - $ref: '#/components/parameters/taskId'
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Task deleted successfully"
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /analytics:
 *   get:
 *     summary: Get comprehensive task analytics
 *     description: |
 *       Retrieve comprehensive task analytics including metrics, charts, and performance data.
 *       This endpoint provides real-time analytics for the dashboard.
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Successfully retrieved analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalTasks:
 *                       type: integer
 *                       example: 150
 *                     completedTasks:
 *                       type: integer
 *                       example: 75
 *                     pendingTasks:
 *                       type: integer
 *                       example: 45
 *                     inProgressTasks:
 *                       type: integer
 *                       example: 30
 *                     completionRate:
 *                       type: number
 *                       format: float
 *                       example: 50.0
 *                     averageCompletionTime:
 *                       type: number
 *                       format: float
 *                       example: 120.5
 *                     priorityDistribution:
 *                       type: object
 *                       properties:
 *                         low:
 *                           type: integer
 *                           example: 20
 *                         medium:
 *                           type: integer
 *                           example: 80
 *                         high:
 *                           type: integer
 *                           example: 50
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check the health status of the API server and its dependencies.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "API is healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *       503:
 *         description: Service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
