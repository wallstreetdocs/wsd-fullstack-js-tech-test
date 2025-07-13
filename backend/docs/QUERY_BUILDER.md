# Task Query Builder Documentation

This document provides comprehensive information about the Task Query Builder system, which enables granular querying of tasks with all possible combinations and scenarios.

## Overview

The Task Query Builder provides a fluent interface for building complex MongoDB queries with support for:

- Text search across title and description
- Filtering by all task fields
- Date range queries
- Time-based filtering
- Custom MongoDB conditions
- Sorting and pagination
- Field selection
- Statistical queries

## API Endpoints

### 1. GET /api/tasks - Basic Filtering

The main endpoint supports comprehensive filtering through query parameters:

```javascript
GET /api/tasks?search=urgent&status=pending,completed&priority=high&page=1&limit=20
```

#### Query Parameters

| Parameter          | Type         | Description                                       | Example                                                  |
| ------------------ | ------------ | ------------------------------------------------- | -------------------------------------------------------- |
| `search`           | string       | Full-text search in title and description         | `?search=urgent task`                                    |
| `title`            | string       | Filter by title (regex match)                     | `?title=meeting`                                         |
| `description`      | string       | Filter by description (regex match)               | `?description=review`                                    |
| `status`           | string/array | Filter by status (comma-separated for multiple)   | `?status=pending,completed`                              |
| `priority`         | string/array | Filter by priority (comma-separated for multiple) | `?priority=high,medium`                                  |
| `createdAtStart`   | string       | Start date for createdAt range                    | `?createdAtStart=2024-01-01`                             |
| `createdAtEnd`     | string       | End date for createdAt range                      | `?createdAtEnd=2024-12-31`                               |
| `updatedAtStart`   | string       | Start date for updatedAt range                    | `?updatedAtStart=2024-01-01`                             |
| `updatedAtEnd`     | string       | End date for updatedAt range                      | `?updatedAtEnd=2024-12-31`                               |
| `completedAtStart` | string       | Start date for completedAt range                  | `?completedAtStart=2024-01-01`                           |
| `completedAtEnd`   | string       | End date for completedAt range                    | `?completedAtEnd=2024-12-31`                             |
| `isCompleted`      | boolean      | Filter by completion status                       | `?isCompleted=true`                                      |
| `estimatedTimeMin` | number       | Minimum estimated time (minutes)                  | `?estimatedTimeMin=30`                                   |
| `estimatedTimeMax` | number       | Maximum estimated time (minutes)                  | `?estimatedTimeMax=120`                                  |
| `actualTimeMin`    | number       | Minimum actual time (minutes)                     | `?actualTimeMin=45`                                      |
| `actualTimeMax`    | number       | Maximum actual time (minutes)                     | `?actualTimeMax=180`                                     |
| `hasEstimatedTime` | boolean      | Filter tasks with/without estimated time          | `?hasEstimatedTime=true`                                 |
| `hasActualTime`    | boolean      | Filter tasks with/without actual time             | `?hasActualTime=true`                                    |
| `timeEfficiency`   | string       | Filter by time efficiency                         | `?timeEfficiency=over-estimated`                         |
| `where`            | JSON string  | Custom MongoDB conditions                         | `?where={"title":{"$regex":"urgent"}}`                   |
| `orWhere`          | JSON string  | Custom OR conditions                              | `?orWhere=[{"status":"pending"},{"priority":"high"}]`    |
| `andWhere`         | JSON string  | Custom AND conditions                             | `?andWhere=[{"status":"completed"},{"priority":"high"}]` |
| `sortBy`           | string       | Field to sort by                                  | `?sortBy=createdAt`                                      |
| `sortOrder`        | string       | Sort order (asc/desc)                             | `?sortOrder=desc`                                        |
| `select`           | string       | Fields to include (comma-separated)               | `?select=title,status,priority`                          |
| `page`             | number       | Page number for pagination                        | `?page=1`                                                |
| `limit`            | number       | Number of tasks per page                          | `?limit=20`                                              |

### 2. GET /api/tasks/search - Advanced Search

Full-text search endpoint with additional filter support:

```javascript
GET /api/tasks/search?q=urgent meeting&filters={"status":"pending"}&options={"sortBy":"priority"}
```

#### Parameters

| Parameter | Type        | Description                       |
| --------- | ----------- | --------------------------------- |
| `q`       | string      | Search query for full-text search |
| `filters` | JSON string | Additional filters object         |
| `options` | JSON string | Query options object              |

### 3. POST /api/tasks/query - Raw Query Builder

Direct query builder endpoint for complex queries:

```javascript
POST /api/tasks/query
Content-Type: application/json

{
  "filters": {
    "search": "urgent",
    "status": ["pending", "in-progress"],
    "priority": "high",
    "createdAtRange": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    },
    "timeEfficiency": "over-estimated"
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

### 4. GET /api/tasks/stats - Statistics

Get task statistics and counts:

```javascript
GET /api/tasks/stats?status=pending&priority=high
```

Returns:

```json
{
  "success": true,
  "data": {
    "total": 150,
    "byStatus": {
      "pending": 45,
      "in-progress": 30,
      "completed": 75
    },
    "byPriority": {
      "low": 20,
      "medium": 80,
      "high": 50
    },
    "byTimeEfficiency": {
      "over-estimated": 25,
      "under-estimated": 15,
      "accurate": 10
    }
  }
}
```

## Query Builder Class Usage

### Basic Usage

```javascript
import Task from '../models/Task.js';

// Create a query builder
const builder = Task.queryBuilder();

// Build complex query
const result = await builder
  .search('urgent')
  .status(['pending', 'in-progress'])
  .priority('high')
  .createdAtRange({ start: '2024-01-01', end: '2024-12-31' })
  .timeEfficiency('over-estimated')
  .sortBy('createdAt', 'desc')
  .paginate(1, 20)
  .executeWithPagination();
```

### Available Methods

#### Text Search

```javascript
builder.search('search term'); // Full-text search in title and description
```

#### Field Filters

```javascript
builder.title('meeting'); // Regex match on title
builder.description('review'); // Regex match on description
builder.status('pending'); // Single status
builder.status(['pending', 'completed']); // Multiple statuses
builder.priority('high'); // Single priority
builder.priority(['high', 'medium']); // Multiple priorities
```

#### Date Range Filters

```javascript
builder.createdAtRange({ start: '2024-01-01', end: '2024-12-31' });
builder.updatedAtRange({ start: '2024-01-01', end: '2024-12-31' });
builder.completedAtRange({ start: '2024-01-01', end: '2024-12-31' });
```

#### Completion Status

```javascript
builder.isCompleted(true); // Only completed tasks
builder.isCompleted(false); // Only non-completed tasks
```

#### Time Range Filters

```javascript
builder.estimatedTimeRange({ min: 30, max: 120 }); // 30-120 minutes
builder.actualTimeRange({ min: 45, max: 180 }); // 45-180 minutes
```

#### Existence Filters

```javascript
builder.hasEstimatedTime(true); // Tasks with estimated time
builder.hasEstimatedTime(false); // Tasks without estimated time
builder.hasActualTime(true); // Tasks with actual time
builder.hasActualTime(false); // Tasks without actual time
```

#### Time Efficiency

```javascript
builder.timeEfficiency('over-estimated'); // Actual > Estimated
builder.timeEfficiency('under-estimated'); // Actual < Estimated
builder.timeEfficiency('accurate'); // Actual = Estimated
```

#### Custom Conditions

```javascript
builder.where({ title: { $regex: 'urgent' } });
builder.orWhere([{ status: 'pending' }, { priority: 'high' }]);
builder.andWhere([{ status: 'completed' }, { priority: 'high' }]);
```

#### Sorting and Pagination

```javascript
builder.sortBy('createdAt', 'desc');
builder.select(['title', 'status', 'priority']);
builder.paginate(1, 20);
```

#### Execution Methods

```javascript
const tasks = await builder.execute(); // Returns array of tasks
const count = await builder.count(); // Returns total count
const result = await builder.executeWithPagination(); // Returns with pagination metadata
```

## Advanced Search Examples

### 1. Find Overdue High Priority Tasks

```javascript
const overdueTasks = await Task.queryBuilder()
  .priority('high')
  .status(['pending', 'in-progress'])
  .createdAtRange({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  })
  .execute();
```

### 2. Find Tasks Completed This Week

```javascript
const thisWeek = new Date();
thisWeek.setDate(thisWeek.getDate() - 7);

const completedThisWeek = await Task.queryBuilder()
  .status('completed')
  .completedAtRange({ start: thisWeek.toISOString() })
  .execute();
```

### 3. Find Inefficient Tasks

```javascript
const inefficientTasks = await Task.queryBuilder()
  .timeEfficiency('over-estimated')
  .hasEstimatedTime(true)
  .hasActualTime(true)
  .sortBy('actualTime', 'desc')
  .execute();
```

### 4. Complex Search with Multiple Conditions

```javascript
const complexQuery = await Task.queryBuilder()
  .search('urgent meeting')
  .orWhere([{ status: 'pending' }, { priority: 'high' }])
  .andWhere([{ hasEstimatedTime: true }, { estimatedTime: { $gte: 60 } }])
  .createdAtRange({
    start: '2024-01-01',
    end: '2024-12-31'
  })
  .sortBy('priority', 'desc')
  .sortBy('createdAt', 'desc')
  .paginate(1, 50)
  .executeWithPagination();
```

### 5. Statistical Analysis

```javascript
// Get tasks by efficiency
const overEstimated = await Task.queryBuilder()
  .timeEfficiency('over-estimated')
  .count();

const underEstimated = await Task.queryBuilder()
  .timeEfficiency('under-estimated')
  .count();

const accurate = await Task.queryBuilder().timeEfficiency('accurate').count();
```

## Performance Considerations

1. **Indexes**: The system includes optimized indexes for common query patterns
2. **Text Search**: Full-text search uses MongoDB's text index on title and description
3. **Compound Indexes**: Status+priority and other common combinations are indexed
4. **Pagination**: Always use pagination for large result sets
5. **Field Selection**: Use `select()` to limit returned fields when possible

## Error Handling

The query builder includes comprehensive error handling:

- Invalid JSON in custom conditions is gracefully ignored
- Invalid date ranges are handled safely
- Missing or invalid parameters are handled with defaults
- Database errors are propagated with proper error messages

## Best Practices

1. **Use Specific Filters**: Prefer specific field filters over text search when possible
2. **Limit Result Sets**: Always use pagination for potentially large queries
3. **Select Fields**: Use field selection to reduce data transfer
4. **Cache Results**: Use Redis caching for frequently accessed data
5. **Monitor Performance**: Use MongoDB's explain() for query optimization
6. **Validate Input**: Validate user input before building queries
7. **Use Indexes**: Ensure your queries utilize available indexes

## Migration from Old API

The enhanced query builder is backward compatible. Old API calls will continue to work:

```javascript
// Old way (still works)
GET /api/tasks?status=pending&priority=high&page=1&limit=10

// New way (more powerful)
GET /api/tasks?status=pending&priority=high&search=urgent&timeEfficiency=over-estimated&page=1&limit=10
```

## Testing

The query builder includes comprehensive test coverage for:

- All filter methods
- Complex query combinations
- Error handling
- Performance optimization
- Edge cases

Run tests with:

```bash
npm test
```
