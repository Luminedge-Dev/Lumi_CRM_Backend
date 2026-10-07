import { AppError, found } from '../../core/errors';
import { mockTestPackageRepository } from './mockTestPackage.repository';
import { INITIAL_PACKAGES } from './mockTestPackage.seed';

export const mockTestPackageService = {
  listActive: () => mockTestPackageRepository.listActive(),

  async getByTestType(testType: unknown) {
    return found(await mockTestPackageRepository.findByTestType(testType), 'Package not found');
  },

  async create({ testType, features, pricing }: { testType: unknown; features: unknown; pricing: unknown }) {
    if (await mockTestPackageRepository.findByTestType(testType)) {
      throw AppError.badRequest('Package for this test type already exists');
    }
    return mockTestPackageRepository.create({ testType, features, pricing, isActive: true });
  },

  async update(testType: unknown, { features, pricing }: { features: unknown; pricing: unknown }) {
    return found(await mockTestPackageRepository.updateByTestType(testType, { features, pricing }), 'Package not found');
  },

  /** Soft delete: the package is kept but deactivated. */
  async deactivate(testType: unknown): Promise<void> {
    found(await mockTestPackageRepository.updateByTestType(testType, { isActive: false }), 'Package not found');
  },

  /** Creates any missing default package; existing ones are left untouched. */
  async seed() {
    let created = 0;
    let existing = 0;

    for (const pkg of INITIAL_PACKAGES) {
      if (await mockTestPackageRepository.findByTestType(pkg.testType)) {
        existing++;
      } else {
        await mockTestPackageRepository.create(pkg);
        created++;
      }
    }

    return { message: 'Packages seeded successfully', created, existing, total: INITIAL_PACKAGES.length };
  },
};
