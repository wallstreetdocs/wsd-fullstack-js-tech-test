# Swagger/OpenAPI Integration

This document explains how to use the Swagger/OpenAPI integration for testing the Task Analytics API.

## Overview

The backend now includes comprehensive Swagger/OpenAPI documentation that provides an interactive interface for testing all API endpoints, including the advanced query builder functionality.

## Accessing the Documentation

### Interactive Swagger UI

- **URL**: `http://localhost:3001/api-docs`
- **Description**: Interactive web interface for testing API endpoints
- **Features**:
  - Try-it-out functionality for all endpoints
  - Request/response examples
  - Parameter validation
  - Real-time API testing

### Swagger JSON

- **URL**: `http://localhost:3001/api-docs.json`
- **Description**: Raw OpenAPI specification in JSON format
- **Use Cases**:
  - Integration with other tools
  - Code generation
  - API client generation

## Getting Started

1. **Start the server**:

   ```bash
   npm start
   ```

2. **Open Swagger UI**:
   Navigate to `http://localhost:3001/api-docs` in your browser

3. **Explore the API**:
   - Browse through different endpoint categories
   - Try out the interactive "Try it out" buttons
   - View request/response examples

## API Categories

### 1. Tasks

Basic CRUD operations for task management:

- `GET /tasks` - List tasks with filtering
- `POST /tasks` - Create new task
- `GET /tasks/{id}` - Get task by ID
- `PUT /tasks/{id}` - Update task
- `DELETE /tasks/{id}` - Delete task

### 2. Query Builder

Advanced querying and filtering operations:

- `GET /tasks/search` - Advanced search with full-text search
- `POST /tasks/query` - Raw query builder for complex queries
- `GET /tasks/stats` - Task statistics and counts

### 3. Analytics

Task analytics and statistics:

- `GET /analytics` - Comprehensive task analytics

### 4. System

System health and information:

- `GET /health` - Health check endpoint

## Testing Query Builder Features

### Basic Filtering

Use the `GET /tasks` endpoint to test basic filtering:

```bash
# Filter by status
GET /tasks?status=pending

# Filter by priority
GET /tasks?priority=high

# Multiple statuses
GET /tasks?status=pending,completed

# Text search
GET /tasks?search=authentication

# Date range
GET /tasks?createdAtStart=2024-01-01&createdAtEnd=2024-12-31
```

### Advanced Search

Use the `GET /tasks/search` endpoint for advanced search:

```bash
# Full-text search with filters
GET /tasks/search?q=urgent&filters={"status":"pending","priority":"high"}

# With options
GET /tasks/search?q=meeting&options={"sortBy":"createdAt","sortOrder":"desc","limit":10}
```

### Raw Query Builder

Use the `POST /tasks/query` endpoint for complex queries:

```json
{
  "filters": {
    "search": "urgent meeting",
    "status": ["pending", "in-progress"],
    "priority": "high",
    "timeEfficiency": "over-estimated",
    "createdAtRange": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    }
  },
  "options": {
    "sortBy": "createdAt",
    "sortOrder": "desc",
    "page": 1,
    "limit": 20,
    "select": ["title", "status", "priority", "createdAt"]
  }
}
```

### Statistics

Use the `GET /tasks/stats` endpoint for analytics:

```bash
# All statistics
GET /tasks/stats

# Filtered statistics
GET /tasks/stats?status=pending&priority=high
```

## Query Parameters Reference

### Filter Parameters

| Parameter          | Type         | Description             | Example                          |
| ------------------ | ------------ | ----------------------- | -------------------------------- |
| `search`           | string       | Full-text search        | `?search=urgent meeting`         |
| `title`            | string       | Title regex match       | `?title=meeting`                 |
| `description`      | string       | Description regex match | `?description=review`            |
| `status`           | string/array | Task status             | `?status=pending,completed`      |
| `priority`         | string/array | Task priority           | `?priority=high,medium`          |
| `createdAtStart`   | date         | Start date              | `?createdAtStart=2024-01-01`     |
| `createdAtEnd`     | date         | End date                | `?createdAtEnd=2024-12-31`       |
| `isCompleted`      | boolean      | Completion status       | `?isCompleted=true`              |
| `estimatedTimeMin` | number       | Min estimated time      | `?estimatedTimeMin=30`           |
| `estimatedTimeMax` | number       | Max estimated time      | `?estimatedTimeMax=120`          |
| `actualTimeMin`    | number       | Min actual time         | `?actualTimeMin=45`              |
| `actualTimeMax`    | number       | Max actual time         | `?actualTimeMax=180`             |
| `hasEstimatedTime` | boolean      | Has estimated time      | `?hasEstimatedTime=true`         |
| `hasActualTime`    | boolean      | Has actual time         | `?hasActualTime=true`            |
| `timeEfficiency`   | string       | Time efficiency         | `?timeEfficiency=over-estimated` |

### Option Parameters

| Parameter   | Type   | Description       | Example                         |
| ----------- | ------ | ----------------- | ------------------------------- |
| `sortBy`    | string | Sort field        | `?sortBy=createdAt`             |
| `sortOrder` | string | Sort order        | `?sortOrder=desc`               |
| `select`    | string | Fields to include | `?select=title,status,priority` |
| `page`      | number | Page number       | `?page=1`                       |
| `limit`     | number | Items per page    | `?limit=20`                     |

## Examples

### Example 1: Find Overdue High Priority Tasks

```bash
GET /tasks?priority=high&status=pending,in-progress&createdAtStart=2024-01-01&sortBy=createdAt&sortOrder=asc
```

### Example 2: Search for Bug-Related Tasks

```bash
GET /tasks/search?q=bug&filters={"status":"pending","priority":"high"}&options={"limit":10}
```

### Example 3: Complex Query for Time Analysis

```json
POST /tasks/query
{
  "filters": {
    "timeEfficiency": "over-estimated",
    "hasEstimatedTime": true,
    "hasActualTime": true,
    "status": "completed"
  },
  "options": {
    "sortBy": "actualTime",
    "sortOrder": "desc",
    "limit": 10
  }
}
```

### Example 4: Get Statistics for High Priority Tasks

```bash
GET /tasks/stats?priority=high&status=pending,in-progress
```

## Tips for Using Swagger UI

1. **Expand Endpoints**: Click on any endpoint to see detailed information
2. **Try It Out**: Use the "Try it out" button to test endpoints interactively
3. **Parameter Validation**: Swagger validates your input parameters
4. **Response Examples**: View example responses for each endpoint
5. **Copy cURL**: Use the "Copy cURL" feature to get command-line examples

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ErrorType"
}
```

Common HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

## Integration with Other Tools

The Swagger JSON can be used with various tools:

- **Postman**: Import the OpenAPI spec
- **Insomnia**: Import for API testing
- **Code Generation**: Generate client libraries
- **API Gateway**: Use for API management

## Troubleshooting

### Common Issues

1. **Server not running**: Make sure the backend server is started
2. **CORS issues**: The API includes CORS headers for frontend integration
3. **Invalid JSON**: Ensure JSON parameters are properly formatted
4. **Date format**: Use ISO date format (YYYY-MM-DD)

### Getting Help

- Check the server logs for detailed error messages
- Use the health endpoint: `GET /health`
- Review the API documentation in Swagger UI
- Check the query builder documentation: `docs/QUERY_BUILDER.md`

## Next Steps

1. **Explore the API**: Use Swagger UI to test all endpoints
2. **Try Complex Queries**: Experiment with the query builder features
3. **Integrate with Frontend**: Use the API endpoints in your frontend application
4. **Generate Client Code**: Use the OpenAPI spec to generate client libraries
