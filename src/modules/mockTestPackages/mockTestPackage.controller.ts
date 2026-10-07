import { asyncHandler } from '../../core/http';
import { mockTestPackageService } from './mockTestPackage.service';

// `{ message }` on failure with fixed messages (these endpoints have always answered 500, not 400, on unexpected failures).

export const getAllPackages = asyncHandler(
  async (_req, res) => {
    res.json(await mockTestPackageService.listActive());
  },
  { shape: 'message', fallbackMessage: 'Failed to fetch mock test packages', logLabel: 'Error fetching mock test packages:' },
);

export const getPackageByTestType = asyncHandler(
  async (req, res) => {
    res.json(await mockTestPackageService.getByTestType(req.params.testType));
  },
  { shape: 'message', fallbackMessage: 'Failed to fetch package', logLabel: 'Error fetching package:' },
);

export const createPackage = asyncHandler(
  async (req, res) => {
    const { testType, features, pricing } = req.body;
    res.status(201).json(await mockTestPackageService.create({ testType, features, pricing }));
  },
  { shape: 'message', fallbackMessage: 'Failed to create package', logLabel: 'Error creating package:' },
);

export const updatePackage = asyncHandler(
  async (req, res) => {
    const { features, pricing } = req.body;
    res.json(await mockTestPackageService.update(req.params.testType, { features, pricing }));
  },
  { shape: 'message', fallbackMessage: 'Failed to update package', logLabel: 'Error updating package:' },
);

export const deletePackage = asyncHandler(
  async (req, res) => {
    await mockTestPackageService.deactivate(req.params.testType);
    res.json({ message: 'Package deleted successfully' });
  },
  { shape: 'message', fallbackMessage: 'Failed to delete package', logLabel: 'Error deleting package:' },
);

export const seedPackages = asyncHandler(
  async (_req, res) => {
    res.status(201).json(await mockTestPackageService.seed());
  },
  { shape: 'message', fallbackMessage: 'Failed to seed packages', logLabel: 'Error seeding packages:' },
);
