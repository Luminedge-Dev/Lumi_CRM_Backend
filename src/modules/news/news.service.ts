import { found } from '../../core/errors';
import { newsRepository } from './news.repository';

export const newsService = {
  list: (filter: Record<string, any>) => newsRepository.listActive(filter),

  create: (data: Record<string, unknown>, createdBy: string) => newsRepository.create({ ...data, createdBy }),

  async update(id: string, updates: Record<string, unknown>) {
    return found(await newsRepository.update(id, updates), 'Post not found');
  },

  async archive(id: string): Promise<void> {
    await newsRepository.archive(id);
  },
};
