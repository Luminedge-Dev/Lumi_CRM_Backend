import { found } from '../../core/errors';
import { mockTestRepository } from './mockTest.repository';

export const mockTestService = {
  // ── packages ──
  listPackages: () => mockTestRepository.listActivePackages(),
  async getPackage(id: string) {
    return found(await mockTestRepository.findPackageById(id), 'Mock test package not found');
  },
  createPackage: (data: Record<string, unknown>) => mockTestRepository.createPackage(data),
  async updatePackage(id: string, data: Record<string, unknown>) {
    return found(await mockTestRepository.updatePackage(id, data), 'Mock test package not found');
  },
  async deletePackage(id: string): Promise<void> {
    found(await mockTestRepository.deletePackage(id), 'Mock test package not found');
  },

  // ── schedules ──
  listSchedules: (query: Record<string, any>, sort: Record<string, 1 | -1>) => mockTestRepository.listSchedules(query, sort),
  async getSchedule(id: string) {
    return found(await mockTestRepository.findScheduleById(id), 'Mock test schedule not found');
  },
  createSchedule: (data: Record<string, unknown>) => mockTestRepository.createSchedule(data),
  async updateSchedule(id: string, data: Record<string, unknown>) {
    return found(await mockTestRepository.updateSchedule(id, data), 'Mock test schedule not found');
  },
  async deleteSchedule(id: string): Promise<void> {
    found(await mockTestRepository.deleteSchedule(id), 'Mock test schedule not found');
  },
};
