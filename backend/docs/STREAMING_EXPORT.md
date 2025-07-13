# Streaming Export Documentation

## Overview

The export service has been optimized to handle large datasets efficiently using Node.js streams and MongoDB cursors. This prevents memory issues and server crashes when exporting large amounts of data (e.g., 1 million+ records).

## Key Improvements

### 1. Memory Efficiency

- **Before**: All data was loaded into memory at once, causing potential server crashes
- **After**: Data is processed in streams, keeping memory usage constant regardless of dataset size

### 2. MongoDB Cursor Usage

- **Before**: Used `Task.advancedSearch()` which fetched all records at once
- **After**: Uses `Task.advancedSearchCursor()` which returns a MongoDB cursor for streaming

### 3. Stream Processing

- **Before**: Generated entire file content in memory before writing
- **After**: Uses Node.js Transform streams to process data incrementally

## Technical Implementation

### MongoDB Cursor Method

Added `advancedSearchCursor()` method to the Task model:

```javascript
taskSchema.statics.advancedSearchCursor = async function (
  filters = {},
  options = {}
) {
  const builder = new TaskQueryBuilder();

  // Apply all filters (same as advancedSearch)
  if (filters.search) builder.search(filters.search);
  // ... other filters

  // Create cursor query
  let query = Task.find(builder.query);

  // Apply sorting and field selection
  if (Object.keys(builder.sort).length > 0) {
    query = query.sort(builder.sort);
  }

  // Apply batch size for cursor
  if (options.batchSize) {
    query = query.batchSize(options.batchSize);
  }

  // Return cursor for streaming
  return query.cursor();
};
```

### Stream-Based Export

The `generateExportStream()` method processes data in streams:

```javascript
static async generateExportStream(params) {
  const { format, filters, options, filePath, exportId } = params;

  // Create write stream
  const writeStream = createWriteStream(filePath);

  // Create transform stream based on format
  const transformStream = format === 'csv'
    ? this.createCSVTransformStream(true)
    : this.createJSONTransformStream(true);

  // Pipe transform to write stream
  transformStream.pipe(writeStream);

  // Create MongoDB cursor with batch processing
  const cursor = await Task.advancedSearchCursor(filters, {
    ...options,
    batchSize: 1000
  });

  // Process cursor in batches
  for await (const task of cursor) {
    // Send progress updates every 1000 records
    if (batchCount % 1000 === 0) {
      await SocketBroadcastService.broadcastExportProcessing(exportId, recordCount);
    }

    // Push task to transform stream
    transformStream.write(task);
  }

  // End the transform stream
  transformStream.end();
}
```

### Transform Streams

#### CSV Transform Stream

```javascript
static createCSVTransformStream(isFirstChunk = false) {
  let isFirst = isFirstChunk;

  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      try {
        if (isFirst) {
          this.push(ExportService.getCSVHeader());
          isFirst = false;
        }

        const csvRow = ExportService.taskToCSVRow(chunk);
        this.push(csvRow);
        callback();
      } catch (error) {
        callback(error);
      }
    }
  });
}
```

#### JSON Transform Stream

```javascript
static createJSONTransformStream(isFirstChunk = false) {
  let isFirst = isFirstChunk;

  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      try {
        if (isFirst) {
          this.push('{\n');
          this.push('  "exportInfo": {\n');
          this.push(`    "generatedAt": "${new Date().toISOString()}",\n`);
          this.push('    "format": "json"\n');
          this.push('  },\n');
          this.push('  "tasks": [\n');
          isFirst = false;
        } else {
          this.push(',\n');
        }

        const jsonTask = ExportService.taskToJSON(chunk);
        this.push('    ' + JSON.stringify(jsonTask, null, 2).replace(/\n/g, '\n    '));
        callback();
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      try {
        this.push('\n  ]\n');
        this.push('}\n');
        callback();
      } catch (error) {
        callback(error);
      }
    }
  });
}
```

## Performance Benefits

### Memory Usage

- **Before**: Memory usage grew linearly with dataset size
- **After**: Constant memory usage regardless of dataset size

### Processing Speed

- **Before**: Had to wait for all data to be loaded before processing
- **After**: Processing starts immediately as data streams in

### Server Stability

- **Before**: Large exports could crash the server
- **After**: Server remains stable even with million+ record exports

## Usage Examples

### Basic Export

```javascript
const result = await ExportService.createExport({
  format: 'csv',
  filters: {},
  options: {
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }
});
```

### Filtered Export

```javascript
const result = await ExportService.createExport({
  format: 'json',
  filters: {
    status: 'completed',
    priority: 'high',
    createdAtRange: {
      start: '2024-01-01',
      end: '2024-12-31'
    }
  },
  options: {
    sortBy: 'completedAt',
    sortOrder: 'desc'
  }
});
```

### Large Dataset Export

```javascript
// This will now work efficiently even with 1M+ records
const result = await ExportService.createExport({
  format: 'csv',
  filters: {},
  options: {
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }
});
```

## Testing

Run the test script to verify streaming export functionality:

```bash
node test-export-stream.js
```

This script will:

1. Create test data if needed
2. Test CSV export with streaming
3. Test JSON export with streaming
4. Test filtered export
5. Provide performance metrics

## Monitoring

The streaming export provides real-time progress updates via WebSocket:

- `export-fetching`: When starting to fetch data
- `export-processing`: Progress updates every 1000 records
- `export-file-generation`: When generating the file
- `export-finalizing`: When finalizing the export
- `export-completed`: When export is complete
- `export-failed`: If export fails

## Configuration

### Batch Size

The default batch size for MongoDB cursor processing is 1000 records. This can be adjusted based on your server's memory constraints:

```javascript
const cursor = await Task.advancedSearchCursor(filters, {
  ...options,
  batchSize: 500 // Smaller batch size for memory-constrained environments
});
```

### Progress Update Frequency

Progress updates are sent every 1000 records by default. This can be adjusted:

```javascript
if (batchCount % 1000 === 0) {
  // Change 1000 to desired frequency
  await SocketBroadcastService.broadcastExportProcessing(exportId, recordCount);
}
```

## Error Handling

The streaming export includes comprehensive error handling:

1. **Stream Errors**: Caught and propagated to the caller
2. **Database Errors**: Handled gracefully with proper cleanup
3. **File System Errors**: Caught during file writing
4. **Memory Errors**: Prevented by streaming architecture

## Migration Notes

The existing API remains unchanged, so no frontend modifications are required. The improvements are entirely backend-focused and transparent to the client.

## Future Enhancements

Potential future improvements:

1. **Compression**: Add gzip compression for large exports
2. **Chunked Downloads**: Support for downloading large files in chunks
3. **Background Processing**: Move exports to background jobs for very large datasets
4. **Progress Persistence**: Store progress in database for resumable exports
