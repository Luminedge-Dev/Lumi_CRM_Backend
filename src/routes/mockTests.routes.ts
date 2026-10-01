import express from 'express';
import {
  getMockTestPackages,
  getMockTestPackage,
  createMockTestPackage,
  updateMockTestPackage,
  deleteMockTestPackage,
  getMockTestSchedules,
  getMockTestSchedule,
  createMockTestSchedule,
  updateMockTestSchedule,
  deleteMockTestSchedule,
} from '../controllers/mockTests.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = express.Router();

// Mock Test Packages
router.get('/packages', authenticateToken, getMockTestPackages);
router.get('/packages/:id', authenticateToken, getMockTestPackage);
router.post('/packages', authenticateToken, createMockTestPackage);
router.patch('/packages/:id', authenticateToken, updateMockTestPackage);
router.delete('/packages/:id', authenticateToken, deleteMockTestPackage);

// Mock Test Schedules
router.get('/schedules', authenticateToken, getMockTestSchedules);
router.get('/schedules/:id', authenticateToken, getMockTestSchedule);
router.post('/schedules', authenticateToken, createMockTestSchedule);
router.patch('/schedules/:id', authenticateToken, updateMockTestSchedule);
router.delete('/schedules/:id', authenticateToken, deleteMockTestSchedule);

export default router;
