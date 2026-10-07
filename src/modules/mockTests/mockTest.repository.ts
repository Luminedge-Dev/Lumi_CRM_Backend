import MockTestPackage from '../../models/MockTestPackage';
import MockTestSchedule from '../../models/MockTestSchedule';

// Package-by-id and schedule storage for the /api/mock-tests endpoints. (Packages addressed by
// test type live in the mockTestPackages module; both use the same collection.)
export const mockTestRepository = {
  // ── packages ──
  listActivePackages: () => MockTestPackage.find({ isActive: true }),
  findPackageById: (id: string) => MockTestPackage.findById(id),
  createPackage: async (data: Record<string, unknown>) => {
    const pkg = new MockTestPackage(data);
    await pkg.save();
    return pkg;
  },
  updatePackage: (id: string, data: Record<string, unknown>) => MockTestPackage.findByIdAndUpdate(id, data, { new: true }),
  deletePackage: (id: string) => MockTestPackage.findByIdAndDelete(id),

  // ── schedules ──
  listSchedules: (query: Record<string, any>, sort: Record<string, 1 | -1>) => MockTestSchedule.find(query).sort(sort),
  findScheduleById: (id: string) => MockTestSchedule.findById(id),
  createSchedule: async (data: Record<string, unknown>) => {
    const schedule = new MockTestSchedule(data);
    await schedule.save();
    return schedule;
  },
  updateSchedule: (id: string, data: Record<string, unknown>) => MockTestSchedule.findByIdAndUpdate(id, data, { new: true }),
  deleteSchedule: (id: string) => MockTestSchedule.findByIdAndDelete(id),
};
