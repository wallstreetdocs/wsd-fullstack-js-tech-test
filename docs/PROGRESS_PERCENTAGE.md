# Progress Percentage Feature

## Overview

The export system now includes real-time progress percentage tracking for better user experience. Progress percentages are displayed in both the backend logs and frontend UI components.

## Backend Implementation

### SocketBroadcastService

The `SocketBroadcastService` now includes percentage values for each export stage:

- **Queued**: 0%
- **Started**: 5%
- **Fetching Data**: 15%
- **Processing**: 40%
- **File Generation**: 70%
- **Finalizing**: 85%
- **Completed**: 100%
- **Failed**: 0%

### Progress Stages

```javascript
// Example usage in SocketBroadcastService
await SocketBroadcastService.broadcastExportStarted(exportId); // 5%
await SocketBroadcastService.broadcastExportFetching(exportId); // 15%
await SocketBroadcastService.broadcastExportProcessing(exportId, 27); // 40%
await SocketBroadcastService.broadcastExportFileGeneration(exportId); // 70%
await SocketBroadcastService.broadcastExportFinalizing(exportId); // 85%
await SocketBroadcastService.broadcastExportCompleted(exportId, 27); // 100%
```

### Socket Event Structure

Export progress events now include percentage data:

```javascript
{
  exportId: "68730147b8f7e9b7c9bda94b",
  status: "processing",
  message: "Processing 27 tasks...",
  percentage: 40,
  timestamp: "2025-07-13T00:43:54.923Z"
}
```

## Frontend Implementation

### Export Store

The export store tracks percentage values for active exports:

```javascript
// Active exports now include percentage
activeExports.value.set(exportId, {
  ...exportRecord,
  progress: 'Starting export...',
  percentage: 0,
});
```

### UI Components

#### Export History Page

- **Progress Circular**: Shows percentage completion
- **Progress Linear**: Displays percentage bar
- **Percentage Text**: Shows exact percentage value

#### App Snackbar

- **Progress Bar**: Shows during processing
- **Percentage Text**: Displays completion percentage
- **Real-time Updates**: Updates as export progresses

### Component Updates

#### ExportHistory.vue

```vue
<v-progress-circular
  :model-value="exportData.percentage || 0"
  size="24"
  color="primary"
  :indeterminate="!exportData.percentage"></v-progress-circular>

<v-progress-linear
  v-if="exportData.status === 'processing'"
  :model-value="exportData.percentage || 0"
  color="primary"
  class="ml-2"
  style="max-width: 100px"
  :indeterminate="!exportData.percentage"></v-progress-linear>

<span v-if="exportData.percentage" class="ml-2 text-caption">
  {{ exportData.percentage }}%
</span>
```

#### App.vue Snackbar

```vue
<v-progress-linear
  v-if="exportSnackbarStatus === 'processing' && currentExportPercentage > 0"
  :model-value="currentExportPercentage"
  color="white"
  class="mt-1"
  height="4"></v-progress-linear>

<span v-if="exportSnackbarStatus === 'processing' && currentExportPercentage > 0" class="text-caption mt-1">
  {{ currentExportPercentage }}% complete
</span>
```

## Benefits

1. **Better User Experience**: Users can see exact progress
2. **Real-time Feedback**: Immediate visual feedback
3. **Predictable Timing**: Users know how much time is left
4. **Professional Feel**: Modern progress tracking

## Testing

To test the progress percentage feature:

1. Create an export via API or frontend
2. Watch the progress in real-time
3. Check console logs for percentage values
4. Verify UI components show correct percentages

## Example API Response

```bash
curl -X POST http://localhost:3001/api/exports \
  -H "Content-Type: application/json" \
  -d '{"format": "csv", "filters": {"status": "completed"}}'
```

The export will progress through all stages with percentage updates visible in the frontend.
