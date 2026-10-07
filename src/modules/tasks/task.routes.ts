import express from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles } from '../../middleware/authorization/roles.middleware';
import { createTask, deleteTask, getTask, getTasks, updateTask } from './task.controller';

// Mounted at /api/tasks.
const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('admin', 'bdm'), getTasks);
router.get('/:id', authenticateToken, authorizeRoles('admin', 'bdm'), getTask);
router.post('/', authenticateToken, authorizeRoles('admin', 'bdm'), createTask);
router.patch('/:id', authenticateToken, authorizeRoles('admin', 'bdm'), updateTask);
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'bdm'), deleteTask);

export default router;
