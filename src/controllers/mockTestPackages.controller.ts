import { Request, Response } from 'express';
import MockTestPackage from '../models/MockTestPackage';

// Get all mock test packages
export const getAllPackages = async (req: Request, res: Response) => {
  try {
    const packages = await MockTestPackage.find({ isActive: true }).sort({ testType: 1 });
    res.json(packages);
  } catch (error) {
    console.error('Error fetching mock test packages:', error);
    res.status(500).json({ message: 'Failed to fetch mock test packages' });
  }
};

// Get single package by testType
export const getPackageByTestType = async (req: Request, res: Response) => {
  try {
    const { testType } = req.params;
    const pkg = await MockTestPackage.findOne({ testType });

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json(pkg);
  } catch (error) {
    console.error('Error fetching package:', error);
    res.status(500).json({ message: 'Failed to fetch package' });
  }
};

// Create a new package
export const createPackage = async (req: Request, res: Response) => {
  try {
    const { testType, features, pricing } = req.body;

    const existingPackage = await MockTestPackage.findOne({ testType });
    if (existingPackage) {
      return res.status(400).json({ message: 'Package for this test type already exists' });
    }

    const newPackage = new MockTestPackage({
      testType,
      features,
      pricing,
      isActive: true
    });

    await newPackage.save();
    res.status(201).json(newPackage);
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ message: 'Failed to create package' });
  }
};

// Update a package
export const updatePackage = async (req: Request, res: Response) => {
  try {
    const { testType } = req.params;
    const { features, pricing } = req.body;

    const pkg = await MockTestPackage.findOneAndUpdate(
      { testType },
      { features, pricing },
      { new: true }
    );

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json(pkg);
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ message: 'Failed to update package' });
  }
};

// Delete a package (soft delete)
export const deletePackage = async (req: Request, res: Response) => {
  try {
    const { testType } = req.params;

    const pkg = await MockTestPackage.findOneAndUpdate(
      { testType },
      { isActive: false },
      { new: true }
    );

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }

    res.json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Error deleting package:', error);
    res.status(500).json({ message: 'Failed to delete package' });
  }
};

// Seed initial packages (uses upsert to avoid duplicate errors)
export const seedPackages = async (req: Request, res: Response) => {
  try {
    const initialPackages = [
      {
        testType: 'IELTS',
        features: [
          'Flexible mock test schedule',
          'Real exam experience',
          'Official test standard question',
          'Result published in quick time',
          'Detailed mock feedback',
          'Wireless headphones'
        ],
        pricing: [
          { testCount: 1, fee: 1550 },
          { testCount: 3, fee: 3000 },
          { testCount: 5, fee: 4500 }
        ],
        isActive: true
      },
      {
        testType: 'PTE',
        features: [
          'Flexible mock test schedule',
          'Real exam experience',
          'Official test standard question',
          'Result published in quick time',
          'Detailed mock feedback',
          'Wireless headphones'
        ],
        pricing: [
          { testCount: 1, fee: 1750 },
          { testCount: 3, fee: 3500 },
          { testCount: 5, fee: 5000 }
        ],
        isActive: true
      },
      {
        testType: 'GRE',
        features: [
          'Flexible mock test schedule',
          'Real exam experience',
          'Official test standard question',
          'Result published in quick time',
          'Detailed mock feedback',
          'Wireless headphones'
        ],
        pricing: [
          { testCount: 1, fee: 2000 },
          { testCount: 3, fee: 4000 },
          { testCount: 5, fee: 6000 }
        ],
        isActive: true
      },
      {
        testType: 'TOEFL',
        features: [
          'Flexible mock test schedule',
          'Real exam experience',
          'Official test standard question',
          'Result published in quick time',
          'Detailed mock feedback',
          'Wireless headphones'
        ],
        pricing: [
          { testCount: 1, fee: 1800 },
          { testCount: 3, fee: 3600 },
          { testCount: 5, fee: 5400 }
        ],
        isActive: true
      }
    ];

    // Use upsert to avoid duplicate key errors
    let created = 0;
    let existing = 0;

    for (const pkg of initialPackages) {
      const existingPkg = await MockTestPackage.findOne({ testType: pkg.testType });

      if (existingPkg) {
        existing++;
      } else {
        await MockTestPackage.create(pkg);
        created++;
      }
    }

    res.status(201).json({
      message: 'Packages seeded successfully',
      created,
      existing,
      total: initialPackages.length
    });
  } catch (error) {
    console.error('Error seeding packages:', error);
    res.status(500).json({ message: 'Failed to seed packages' });
  }
};
