import NewsUpdate from '../../models/NewsUpdate';

export const newsRepository = {
  /** Public feed: pinned first, then newest; at most 50 posts. */
  listActive: (filter: Record<string, any>) =>
    NewsUpdate.find({ isActive: true, ...filter })
      .populate('createdBy', 'name')
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(50),

  create: (data: Record<string, unknown>) => NewsUpdate.create(data),

  update: (id: string, updates: Record<string, unknown>) => NewsUpdate.findByIdAndUpdate(id, updates, { new: true }),

  /** Soft delete. */
  archive: (id: string) => NewsUpdate.findByIdAndUpdate(id, { isActive: false }),
};
