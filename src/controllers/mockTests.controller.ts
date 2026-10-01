import { Request, Response } from 'express';
import MockTestPackage from '../models/MockTestPackage';
import MockTestSchedule from '../models/MockTestSchedule';

// Mock Test Packages
export const getMockTestPackages = async (req: Request, res: Response): Promise<void> => {
  try {
    const packages = await MockTestPackage.find({ isActive: true });
    res.json(packages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch mock test packages' });
  }
};

export const getMockTestPackage = async (req: Request, res: Response): Promise<void> => {
  try {
    const pkg = await MockTestPackage.findById(req.params.id);
    if (!pkg) {
      res.status(404).json({ error: 'Mock test package not found' });
      return;
    }
    res.json(pkg);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch mock test package' });
  }
};

export const createMockTestPackage = async (req: Request, res: Response): Promise<void> => {
  try {
    const pkg = new MockTestPackage(req.body);
    await pkg.save();
    res.status(201).json(pkg);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create mock test package' });
  }
};

export const updateMockTestPackage = async (req: Request, res: Response): Promise<void> => {
  try {
    const pkg = await MockTestPackage.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!pkg) {
      res.status(404).json({ error: 'Mock test package not found' });
      return;
    }
    res.json(pkg);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update mock test package' });
  }
};

export const deleteMockTestPackage = async (req: Request, res: Response): Promise<void> => {
  try {
    const pkg = await MockTestPackage.findByIdAndDelete(req.params.id);
    if (!pkg) {
      res.status(404).json({ error: 'Mock test package not found' });
      return;
    }
    res.json({ message: 'Mock test package deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete mock test package' });
  }
};

// Mock Test Schedules
export const getMockTestSchedules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { testType, status, sortBy } = req.query;

    const query: any = {};
    if (testType && testType !== 'all') query.testType = testType;
    if (status && status !== 'all') query.status = status;

    let sortOption: any = { examDate: 1 };
    if (sortBy === 'date-desc') sortOption = { examDate: -1 };
    if (sortBy === 'name') sortOption = { name: 1 };

    const schedules = await MockTestSchedule.find(query).sort(sortOption);
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch mock test schedules' });
  }
};

export const getMockTestSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const schedule = await MockTestSchedule.findById(req.params.id);
    if (!schedule) {
      res.status(404).json({ error: 'Mock test schedule not found' });
      return;
    }
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch mock test schedule' });
  }
};

export const createMockTestSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const schedule = new MockTestSchedule(req.body);
    await schedule.save();
    res.status(201).json(schedule);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create mock test schedule' });
  }
};

export const updateMockTestSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const schedule = await MockTestSchedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!schedule) {
      res.status(404).json({ error: 'Mock test schedule not found' });
      return;
    }
    res.json(schedule);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update mock test schedule' });
  }
};

export const deleteMockTestSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const schedule = await MockTestSchedule.findByIdAndDelete(req.params.id);
    if (!schedule) {
      res.status(404).json({ error: 'Mock test schedule not found' });
      return;
    }
    res.json({ message: 'Mock test schedule deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete mock test schedule' });
  }
};
