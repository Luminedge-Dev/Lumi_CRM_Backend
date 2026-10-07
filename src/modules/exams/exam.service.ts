import { found } from '../../core/errors';
import { examRepository } from './exam.repository';

export const examService = {
  list: (query: Record<string, any>, sort: Record<string, 1 | -1>) => examRepository.list(query, sort),

  async get(id: string) {
    return found(await examRepository.findById(id), 'Exam not found');
  },

  create: (data: Record<string, unknown>) => examRepository.create(data),

  async update(id: string, data: Record<string, unknown>) {
    return found(await examRepository.update(id, data), 'Exam not found');
  },

  async delete(id: string): Promise<void> {
    found(await examRepository.delete(id), 'Exam not found');
  },
};
