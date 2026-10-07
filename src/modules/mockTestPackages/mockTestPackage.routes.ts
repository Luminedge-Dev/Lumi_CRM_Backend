import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { requireStaff } from '../../middleware/authorization/roles.middleware';
import {
  createPackage,
  deletePackage,
  getAllPackages,
  getPackageByTestType,
  seedPackages,
  updatePackage,
} from './mockTestPackage.controller';

// Mounted at /api/mock-test-packages. Staff only. '/seed' is declared before '/:testType'.
const router = Router();

// GET /api/mock-test-packages - Get all packages
router.get('/', authenticateToken, requireStaff, getAllPackages);

// POST /api/mock-test-packages/seed - Seed initial packages
router.post('/seed', authenticateToken, requireStaff, seedPackages);

// GET /api/mock-test-packages/:testType - Get package by test type
router.get('/:testType', authenticateToken, requireStaff, getPackageByTestType);

// POST /api/mock-test-packages - Create new package
router.post('/', authenticateToken, requireStaff, createPackage);

// PUT /api/mock-test-packages/:testType - Update package
router.put('/:testType', authenticateToken, requireStaff, updatePackage);

// DELETE /api/mock-test-packages/:testType - Delete package (soft)
router.delete('/:testType', authenticateToken, requireStaff, deletePackage);

export default router;
