import { Router } from 'express';
import {
  getAllPackages,
  getPackageByTestType,
  createPackage,
  updatePackage,
  deletePackage,
  seedPackages
} from '../controllers/mockTestPackages.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// GET /api/mock-test-packages - Get all packages
router.get('/', authenticateToken, getAllPackages);

// POST /api/mock-test-packages/seed - Seed initial packages
router.post('/seed', authenticateToken, seedPackages);

// GET /api/mock-test-packages/:testType - Get package by test type
router.get('/:testType', authenticateToken, getPackageByTestType);

// POST /api/mock-test-packages - Create new package
router.post('/', authenticateToken, createPackage);

// PUT /api/mock-test-packages/:testType - Update package
router.put('/:testType', authenticateToken, updatePackage);

// DELETE /api/mock-test-packages/:testType - Delete package
router.delete('/:testType', authenticateToken, deletePackage);

export default router;
