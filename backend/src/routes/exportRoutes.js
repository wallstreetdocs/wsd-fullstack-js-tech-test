import express from 'express';
import {
  downloadExportFile,
  exportTasks,
  getExportHistory
} from '../controllers/exportController.js';

const router = express.Router();
router.post('/tasks', exportTasks);
router.get('/history', getExportHistory);
router.get('/files/:id', downloadExportFile);

export default router;
