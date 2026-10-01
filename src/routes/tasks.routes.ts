import express from 'express';
import { getTasks, getTask, createTask, updateTask, deleteTask } from '../controllers/tasks.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('admin', 'bdm'), getTasks);
router.get('/:id', authenticateToken, authorizeRoles('admin', 'bdm'), getTask);
router.post('/', authenticateToken, authorizeRoles('admin', 'bdm'), createTask);
router.patch('/:id', authenticateToken, authorizeRoles('admin', 'bdm'), updateTask);
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'bdm'), deleteTask);

export default router;
