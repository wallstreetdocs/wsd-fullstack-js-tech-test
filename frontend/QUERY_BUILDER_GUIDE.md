# Advanced Query Builder Guide

The Task Management application includes a powerful query builder that allows you to create complex filters and searches for tasks. This guide explains all the available features and how to use them effectively.

## Overview

The query builder provides three main modes:

1. **Basic Filters** - Simple status, priority, and sorting
2. **Text Search** - Full-text search across titles and descriptions
3. **Advanced Query Builder** - Complex filtering with all API capabilities

## Basic Filters

### Status Filtering

- **Single Status**: Select one status (pending, in-progress, completed)
- **Multiple Statuses**: Select multiple statuses to find tasks in any of those states

### Priority Filtering

- **Single Priority**: Select one priority level (low, medium, high)
- **Multiple Priorities**: Select multiple priorities to find tasks of any of those levels

### Sorting Options

- **Sort By**: Choose the field to sort by (title, status, priority, dates, times)
- **Sort Order**: Choose ascending or descending order

## Text Search

### Full-Text Search

- Searches across both title and description fields
- Supports partial matches and multiple words
- Case-insensitive search

### Field-Specific Search

- **Title Filter**: Search specifically in task titles (supports regex)
- **Description Filter**: Search specifically in task descriptions (supports regex)

## Advanced Query Builder

### Date Range Filtering

#### Created Date Range

- Filter tasks by when they were created
- Set start and end dates
- Useful for finding tasks created in specific time periods

#### Updated Date Range

- Filter tasks by when they were last modified
- Helps identify recently updated tasks

#### Completed Date Range

- Filter completed tasks by when they were finished
- Useful for analyzing completion patterns

### Time Range Filtering

#### Estimated Time Range

- Filter by estimated completion time (in minutes)
- Set minimum and maximum values
- Find tasks with specific time estimates

#### Actual Time Range

- Filter by actual completion time (in minutes)
- Set minimum and maximum values
- Find tasks that took specific amounts of time

### Time Efficiency Filtering

#### Time Efficiency Types

- **Over-estimated**: Tasks that took less time than estimated
- **Under-estimated**: Tasks that took more time than estimated
- **Accurate**: Tasks where estimated and actual times are similar

#### Existence Filters

- **Has Estimated Time**: Filter tasks that have/don't have time estimates
- **Has Actual Time**: Filter tasks that have/don't have actual completion times

### Custom MongoDB Conditions

#### WHERE Conditions

- Use custom MongoDB query objects
- Example: `{"title": {"$regex": "urgent", "$options": "i"}}`
- Supports all MongoDB operators

#### OR Conditions

- Array of conditions where any can match
- Example: `[{"status": "pending"}, {"priority": "high"}]`

#### AND Conditions

- Array of conditions where all must match
- Example: `[{"status": "completed"}, {"priority": "high"}]`

### Sorting and Pagination

#### Advanced Sorting

- Sort by any task field
- Choose ascending or descending order
- Multiple sort options available

#### Field Selection

- Choose which fields to include in results
- Comma-separated list of field names
- Example: `title,status,priority`

#### Pagination

- Set page number and items per page
- Maximum 100 items per page
- Navigate through large result sets

## Query Examples

### High Priority Tasks

```json
{
  "priority": ["high"],
  "status": ["pending", "in-progress"]
}
```

### Over-estimated Tasks

```json
{
  "timeEfficiency": "over-estimated",
  "hasEstimatedTime": true,
  "hasActualTime": true
}
```

### Recent Completed Tasks

```json
{
  "status": ["completed"],
  "completedAtRange": {
    "start": "2024-01-01",
    "end": "2024-12-31"
  }
}
```

### Long Duration Tasks

```json
{
  "actualTimeRange": {
    "min": 120
  },
  "hasActualTime": true
}
```

### Custom MongoDB Query

```json
{
  "where": {
    "$and": [
      { "status": { "$in": ["pending", "in-progress"] } },
      { "priority": "high" },
      { "title": { "$regex": "urgent", "$options": "i" } }
    ]
  }
}
```

## Usage Tips

### Performance Considerations

- Use specific filters rather than broad searches when possible
- Limit result sets with pagination for large datasets
- Use field selection to reduce data transfer

### Best Practices

- Start with basic filters and add complexity as needed
- Use saved queries for frequently used filters
- Test complex queries with small datasets first

### Common Patterns

- **Status + Priority**: Find high-priority pending tasks
- **Date + Status**: Find recently completed tasks
- **Time + Efficiency**: Find tasks that need time estimation review
- **Text + Status**: Find urgent tasks in progress

## Saved Queries

### Saving Queries

- Give your query a descriptive name
- Add an optional description
- Queries are saved locally in your browser

### Loading Queries

- Access saved queries from the query builder
- Load and modify existing queries
- Delete queries you no longer need

### Sharing Queries

- Copy query parameters for sharing
- Export/import query configurations
- Use consistent naming conventions

## API Integration

The query builder integrates with the backend API endpoints:

- **GET /tasks** - Basic filtering and pagination
- **GET /tasks/search** - Full-text search with filters
- **POST /tasks/query** - Advanced query builder
- **GET /tasks/stats** - Statistics with filtering

All queries are converted to the appropriate API format automatically.

## Troubleshooting

### Common Issues

- **No Results**: Check if filters are too restrictive
- **Slow Performance**: Reduce result set size or simplify queries
- **Invalid JSON**: Check custom MongoDB conditions syntax

### Error Handling

- Invalid queries show helpful error messages
- Malformed JSON is caught and reported
- Network errors are handled gracefully

## Advanced Features

### Real-time Updates

- Query results update automatically when tasks change
- WebSocket integration for live data
- No need to refresh manually

### Export Capabilities

- Export query results to various formats
- Save query configurations
- Share queries with team members

### Analytics Integration

- Query results can be used for analytics
- Generate reports based on filtered data
- Track query performance and usage

This query builder provides enterprise-level filtering capabilities while maintaining ease of use for both simple and complex queries.
