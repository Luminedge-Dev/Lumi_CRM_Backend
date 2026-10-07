import { pickFields } from '../../shared/validators/request';

// createdBy, _id and timestamps are server-managed; only these fields are client-editable.
const NEWS_CREATE_FIELDS = ['title', 'content', 'category', 'isPinned'] as const;
const NEWS_UPDATABLE_FIELDS = ['title', 'content', 'category', 'isPinned', 'isActive'] as const;

export const parseNewsCreate = (body: unknown) => pickFields(body, NEWS_CREATE_FIELDS);
export const parseNewsUpdate = (body: unknown) => pickFields(body, NEWS_UPDATABLE_FIELDS);

export const parseNewsFilter = (query: Record<string, any>): Record<string, any> => {
  const filter: Record<string, any> = {};
  if (query.category) filter.category = query.category;
  return filter;
};
