import { asyncHandler } from '../../core/http';
import { mockTestService } from './mockTest.service';
import { parsePackageBody, parseScheduleBody, parseScheduleListQuery } from './mockTest.validation';

// `{ error }` on failure; writes answer an unexpected failure with 400, reads and deletes with 500.

// ── Mock test packages ──
export const getMockTestPackages = asyncHandler(
  async (_req, res) => {
    res.json(await mockTestService.listPackages());
  },
  { fallbackMessage: 'Failed to fetch mock test packages', logLabel: 'Error fetching mock test packages:' },
);

export const getMockTestPackage = asyncHandler(
  async (req, res) => {
    res.json(await mockTestService.getPackage(req.params.id));
  },
  { fallbackMessage: 'Failed to fetch mock test package', logLabel: 'Error fetching mock test package:' },
);

export const createMockTestPackage = asyncHandler(
  async (req, res) => {
    res.status(201).json(await mockTestService.createPackage(parsePackageBody(req.body)));
  },
  { fallbackMessage: 'Failed to create mock test package', fallbackStatus: 400, logLabel: 'Error creating mock test package:' },
);

export const updateMockTestPackage = asyncHandler(
  async (req, res) => {
    res.json(await mockTestService.updatePackage(req.params.id, parsePackageBody(req.body)));
  },
  { fallbackMessage: 'Failed to update mock test package', fallbackStatus: 400, logLabel: 'Error updating mock test package:' },
);

export const deleteMockTestPackage = asyncHandler(
  async (req, res) => {
    await mockTestService.deletePackage(req.params.id);
    res.json({ message: 'Mock test package deleted successfully' });
  },
  { fallbackMessage: 'Failed to delete mock test package', logLabel: 'Error deleting mock test package:' },
);

// ── Mock test schedules ──
export const getMockTestSchedules = asyncHandler(
  async (req, res) => {
    const { query, sort } = parseScheduleListQuery(req.query);
    res.json(await mockTestService.listSchedules(query, sort));
  },
  { fallbackMessage: 'Failed to fetch mock test schedules', logLabel: 'Error fetching mock test schedules:' },
);

export const getMockTestSchedule = asyncHandler(
  async (req, res) => {
    res.json(await mockTestService.getSchedule(req.params.id));
  },
  { fallbackMessage: 'Failed to fetch mock test schedule', logLabel: 'Error fetching mock test schedule:' },
);

export const createMockTestSchedule = asyncHandler(
  async (req, res) => {
    res.status(201).json(await mockTestService.createSchedule(parseScheduleBody(req.body)));
  },
  { fallbackMessage: 'Failed to create mock test schedule', fallbackStatus: 400, logLabel: 'Error creating mock test schedule:' },
);

export const updateMockTestSchedule = asyncHandler(
  async (req, res) => {
    res.json(await mockTestService.updateSchedule(req.params.id, parseScheduleBody(req.body)));
  },
  { fallbackMessage: 'Failed to update mock test schedule', fallbackStatus: 400, logLabel: 'Error updating mock test schedule:' },
);

export const deleteMockTestSchedule = asyncHandler(
  async (req, res) => {
    await mockTestService.deleteSchedule(req.params.id);
    res.json({ message: 'Mock test schedule deleted successfully' });
  },
  { fallbackMessage: 'Failed to delete mock test schedule', logLabel: 'Error deleting mock test schedule:' },
);
