import express from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles } from '../../middleware/authorization/roles.middleware';
import { createCourse, deleteCourse, getCourse, getCourses, updateCourse } from './course.controller';

// Mounted at /api/courses. Reading is open to any signed-in user; writing is admin-only.
const router = express.Router();

router.get('/', authenticateToken, getCourses);
router.get('/:id', authenticateToken, getCourse);
router.post('/', authenticateToken, authorizeRoles('admin'), createCourse);
router.patch('/:id', authenticateToken, authorizeRoles('admin'), updateCourse);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteCourse);

export default router;
