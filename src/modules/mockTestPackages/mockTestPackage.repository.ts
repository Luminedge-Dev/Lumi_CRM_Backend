import MockTestPackage from '../../models/MockTestPackage';

// Packages addressed by their test type (IELTS, PTE, ...). Same collection as mockTests' by-id access.
export const mockTestPackageRepository = {
  listActive: () => MockTestPackage.find({ isActive: true }).sort({ testType: 1 }),

  findByTestType: (testType: unknown) => MockTestPackage.findOne({ testType }),

  create: async (data: Record<string, unknown>) => {
    const pkg = new MockTestPackage(data);
    await pkg.save();
    return pkg;
  },

  updateByTestType: (testType: unknown, update: Record<string, unknown>) =>
    MockTestPackage.findOneAndUpdate({ testType }, update, { new: true }),
};
