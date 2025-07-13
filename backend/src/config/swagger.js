/**
 * @fileoverview Swagger/OpenAPI configuration for Task Analytics API
 * @module config/swagger
 */

import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Swagger configuration options
 */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Task Analytics API',
      version: '1.0.0',
      description: `
# Task Analytics API Documentation

A comprehensive REST API for task management with advanced querying capabilities, real-time analytics, and WebSocket support.

## Features

- **Advanced Query Builder**: Granular filtering with all possible combinations
- **Real-time Updates**: WebSocket integration for live data updates
- **Analytics Dashboard**: Comprehensive task statistics and metrics
- **Redis Caching**: Performance optimization with intelligent caching
- **MongoDB Integration**: Robust data persistence with Mongoose ODM

## Query Builder Capabilities

The API provides a powerful query builder that supports:

- **Text Search**: Full-text search across title and description
- **Status Filtering**: Filter by task status (pending, in-progress, completed)
- **Priority Filtering**: Filter by priority (low, medium, high)
- **Date Ranges**: Filter by creation, update, or completion dates
- **Time Analysis**: Filter by estimated/actual time ranges
- **Time Efficiency**: Find over/under-estimated tasks
- **Custom Conditions**: Advanced MongoDB query conditions
- **Sorting & Pagination**: Flexible result ordering and pagination

## Authentication

Currently, this API does not require authentication for demonstration purposes.

## Rate Limiting

No rate limiting is currently implemented for development use.

## Error Handling

All endpoints return consistent error responses with appropriate HTTP status codes.
      `,
      contact: {
        name: 'API Support',
        email: 'support@taskanalytics.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001/api',
        description: 'Development server'
      },
      {
        url: 'https://api.taskanalytics.com/api',
        description: 'Production server'
      }
    ],
    components: {
      schemas: {
        Task: {
          type: 'object',
          required: ['title'],
          properties: {
            _id: {
              type: 'string',
              description: 'Unique task identifier',
              example: '507f1f77bcf86cd799439011'
            },
            title: {
              type: 'string',
              description: 'Task title (required, max 200 chars)',
              maxLength: 200,
              example: 'Implement user authentication'
            },
            description: {
              type: 'string',
              description: 'Task description (optional, max 1000 chars)',
              maxLength: 1000,
              example: 'Add JWT-based authentication with refresh tokens'
            },
            status: {
              type: 'string',
              enum: ['pending', 'in-progress', 'completed'],
              default: 'pending',
              description: 'Current task status',
              example: 'in-progress'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
              default: 'medium',
              description: 'Task priority level',
              example: 'high'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Task creation timestamp',
              example: '2024-01-15T10:30:00.000Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
              example: '2024-01-16T14:45:00.000Z'
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Task completion timestamp (null if not completed)',
              example: '2024-01-17T16:20:00.000Z'
            },
            estimatedTime: {
              type: 'number',
              minimum: 0,
              description: 'Estimated completion time in minutes',
              example: 120
            },
            actualTime: {
              type: 'number',
              minimum: 0,
              description: 'Actual completion time in minutes',
              example: 135
            }
          }
        },
        TaskList: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              properties: {
                tasks: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Task'
                  }
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: {
                      type: 'integer',
                      example: 1
                    },
                    limit: {
                      type: 'integer',
                      example: 10
                    },
                    total: {
                      type: 'integer',
                      example: 150
                    },
                    pages: {
                      type: 'integer',
                      example: 15
                    }
                  }
                }
              }
            }
          }
        },
        TaskStats: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              properties: {
                total: {
                  type: 'integer',
                  example: 150
                },
                byStatus: {
                  type: 'object',
                  properties: {
                    pending: {
                      type: 'integer',
                      example: 45
                    },
                    'in-progress': {
                      type: 'integer',
                      example: 30
                    },
                    completed: {
                      type: 'integer',
                      example: 75
                    }
                  }
                },
                byPriority: {
                  type: 'object',
                  properties: {
                    low: {
                      type: 'integer',
                      example: 20
                    },
                    medium: {
                      type: 'integer',
                      example: 80
                    },
                    high: {
                      type: 'integer',
                      example: 50
                    }
                  }
                },
                byTimeEfficiency: {
                  type: 'object',
                  properties: {
                    'over-estimated': {
                      type: 'integer',
                      example: 25
                    },
                    'under-estimated': {
                      type: 'integer',
                      example: 15
                    },
                    accurate: {
                      type: 'integer',
                      example: 10
                    }
                  }
                }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Task not found'
            },
            error: {
              type: 'string',
              example: 'ValidationError'
            }
          }
        },
        QueryFilters: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description: 'Text search in title and description',
              example: 'urgent meeting'
            },
            title: {
              type: 'string',
              description: 'Filter by title (regex match)',
              example: 'meeting'
            },
            description: {
              type: 'string',
              description: 'Filter by description (regex match)',
              example: 'review'
            },
            status: {
              oneOf: [
                {
                  type: 'string',
                  enum: ['pending', 'in-progress', 'completed'],
                  example: 'pending'
                },
                {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['pending', 'in-progress', 'completed']
                  },
                  example: ['pending', 'completed']
                }
              ],
              description: 'Filter by task status (single or multiple)'
            },
            priority: {
              oneOf: [
                {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                  example: 'high'
                },
                {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['low', 'medium', 'high']
                  },
                  example: ['high', 'medium']
                }
              ],
              description: 'Filter by task priority (single or multiple)'
            },
            createdAtRange: {
              type: 'object',
              properties: {
                start: {
                  type: 'string',
                  format: 'date',
                  example: '2024-01-01'
                },
                end: {
                  type: 'string',
                  format: 'date',
                  example: '2024-12-31'
                }
              },
              description: 'Filter by creation date range'
            },
            updatedAtRange: {
              type: 'object',
              properties: {
                start: {
                  type: 'string',
                  format: 'date',
                  example: '2024-01-01'
                },
                end: {
                  type: 'string',
                  format: 'date',
                  example: '2024-12-31'
                }
              },
              description: 'Filter by update date range'
            },
            completedAtRange: {
              type: 'object',
              properties: {
                start: {
                  type: 'string',
                  format: 'date',
                  example: '2024-01-01'
                },
                end: {
                  type: 'string',
                  format: 'date',
                  example: '2024-12-31'
                }
              },
              description: 'Filter by completion date range'
            },
            isCompleted: {
              type: 'boolean',
              description: 'Filter by completion status',
              example: true
            },
            estimatedTimeRange: {
              type: 'object',
              properties: {
                min: {
                  type: 'number',
                  minimum: 0,
                  example: 30
                },
                max: {
                  type: 'number',
                  minimum: 0,
                  example: 120
                }
              },
              description: 'Filter by estimated time range (minutes)'
            },
            actualTimeRange: {
              type: 'object',
              properties: {
                min: {
                  type: 'number',
                  minimum: 0,
                  example: 45
                },
                max: {
                  type: 'number',
                  minimum: 0,
                  example: 180
                }
              },
              description: 'Filter by actual time range (minutes)'
            },
            hasEstimatedTime: {
              type: 'boolean',
              description: 'Filter tasks with/without estimated time',
              example: true
            },
            hasActualTime: {
              type: 'boolean',
              description: 'Filter tasks with/without actual time',
              example: true
            },
            timeEfficiency: {
              type: 'string',
              enum: ['over-estimated', 'under-estimated', 'accurate'],
              description: 'Filter by time efficiency',
              example: 'over-estimated'
            },
            where: {
              type: 'object',
              description: 'Custom MongoDB conditions (JSON object)',
              example: { title: { $regex: 'urgent', $options: 'i' } }
            },
            orWhere: {
              type: 'array',
              items: {
                type: 'object'
              },
              description: 'Custom OR conditions (JSON array)',
              example: [{ status: 'pending' }, { priority: 'high' }]
            },
            andWhere: {
              type: 'array',
              items: {
                type: 'object'
              },
              description: 'Custom AND conditions (JSON array)',
              example: [{ status: 'completed' }, { priority: 'high' }]
            }
          }
        },
        QueryOptions: {
          type: 'object',
          properties: {
            sortBy: {
              type: 'string',
              enum: [
                'title',
                'status',
                'priority',
                'createdAt',
                'updatedAt',
                'completedAt',
                'estimatedTime',
                'actualTime'
              ],
              default: 'createdAt',
              description: 'Field to sort by',
              example: 'createdAt'
            },
            sortOrder: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
              description: 'Sort order',
              example: 'desc'
            },
            select: {
              oneOf: [
                {
                  type: 'string',
                  description: 'Comma-separated field names',
                  example: 'title,status,priority'
                },
                {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'Array of field names',
                  example: ['title', 'status', 'priority']
                }
              ],
              description: 'Fields to include in response'
            },
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description: 'Page number for pagination',
              example: 1
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 10,
              description: 'Number of tasks per page',
              example: 20
            }
          }
        }
      },
      parameters: {
        taskId: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Task ID',
          schema: {
            type: 'string'
          },
          example: '507f1f77bcf86cd799439011'
        }
      }
    },
    tags: [
      {
        name: 'Tasks',
        description: 'Task management operations'
      },
      {
        name: 'Query Builder',
        description: 'Advanced querying and filtering operations'
      },
      {
        name: 'Analytics',
        description: 'Task analytics and statistics'
      },
      {
        name: 'System',
        description: 'System health and information'
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/models/*.js', './src/docs/*.js']
};

const specs = swaggerJsdoc(options);

export default specs;
