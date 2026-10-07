import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth/authenticate.middleware';
import { authorizeRoles } from '../../middleware/authorization/roles.middleware';
import { createNews, deleteNews, getNews, updateNews } from './news.controller';

// Mounted at /api.
const router = Router();

router.get('/news', getNews); // public
router.post('/admin/news', authMiddleware, authorizeRoles('admin'), createNews);
router.patch('/admin/news/:id', authMiddleware, authorizeRoles('admin'), updateNews);
router.delete('/admin/news/:id', authMiddleware, authorizeRoles('admin'), deleteNews);

export default router;
