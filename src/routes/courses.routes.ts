import express from 'express';
import { getCourses, getCourse, createCourse, updateCourse, deleteCourse } from '../controllers/courses.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/', authenticateToken, getCourses);
router.get('/:id', authenticateToken, getCourse);
router.post('/', authenticateToken, authorizeRoles('admin'), createCourse);
router.patch('/:id', authenticateToken, authorizeRoles('admin'), updateCourse);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), deleteCourse);

export default router;
