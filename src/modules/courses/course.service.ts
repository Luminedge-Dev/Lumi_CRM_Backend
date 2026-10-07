import { AppError, found } from '../../core/errors';
import { publicErrorMessage } from '../../shared/utils/httpError';
import { courseRepository } from './course.repository';

export const courseService = {
  list: (query: Record<string, any>, sort: Record<string, 1 | -1>) => courseRepository.list(query, sort),

  async get(id: string) {
    return found(await courseRepository.findById(id), 'Course not found');
  },

  /** A failed create answers 400 with a short, safe reason (never the raw error text). */
  async create(data: Record<string, unknown>) {
    try {
      return await courseRepository.create(data);
    } catch (error) {
      console.error('Error creating course:', error);
      throw AppError.badRequest('Failed to create course', { details: publicErrorMessage(error, 'Invalid course data') });
    }
  },

  async update(id: string, data: Record<string, unknown>) {
    return found(await courseRepository.update(id, data), 'Course not found');
  },

  async delete(id: string): Promise<void> {
    found(await courseRepository.delete(id), 'Course not found');
  },
};
