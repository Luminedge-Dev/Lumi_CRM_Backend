import { Router } from 'express';
import { getNews, createNews, updateNews, deleteNews } from '../controllers/news.controller';
import { authMiddleware, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

router.get('/news', getNews); // public
router.post('/admin/news', authMiddleware, authorizeRoles('admin'), createNews);
router.patch('/admin/news/:id', authMiddleware, authorizeRoles('admin'), updateNews);
router.delete('/admin/news/:id', authMiddleware, authorizeRoles('admin'), deleteNews);

export default router;
