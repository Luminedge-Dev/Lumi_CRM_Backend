import express from 'express';
import { authenticateToken } from '../../middleware/auth/authenticate.middleware';
import { requireStaff } from '../../middleware/authorization/roles.middleware';
import {
  createMockTestPackage,
  createMockTestSchedule,
  deleteMockTestPackage,
  deleteMockTestSchedule,
  getMockTestPackage,
  getMockTestPackages,
  getMockTestSchedule,
  getMockTestSchedules,
  updateMockTestPackage,
  updateMockTestSchedule,
} from './mockTest.controller';

// Mounted at /api/mock-tests. Staff only (students use the public Luminedge schedule feed).
const router = express.Router();

// Mock Test Packages
router.get('/packages', authenticateToken, requireStaff, getMockTestPackages);
router.get('/packages/:id', authenticateToken, requireStaff, getMockTestPackage);
router.post('/packages', authenticateToken, requireStaff, createMockTestPackage);
router.patch('/packages/:id', authenticateToken, requireStaff, updateMockTestPackage);
router.delete('/packages/:id', authenticateToken, requireStaff, deleteMockTestPackage);

// Mock Test Schedules
router.get('/schedules', authenticateToken, requireStaff, getMockTestSchedules);
router.get('/schedules/:id', authenticateToken, requireStaff, getMockTestSchedule);
router.post('/schedules', authenticateToken, requireStaff, createMockTestSchedule);
router.patch('/schedules/:id', authenticateToken, requireStaff, updateMockTestSchedule);
router.delete('/schedules/:id', authenticateToken, requireStaff, deleteMockTestSchedule);

export default router;
