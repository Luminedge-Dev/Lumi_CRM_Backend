import { AppError } from '../../core/errors';
import { isObjectId, pickFields } from '../../shared/validators/request';

// Mass-assignment whitelist: completedAt/completedBy are set by the server on completion and
// must never come from the request body.
const TASK_FIELDS = [
  'title',
  'description',
  'entityType',
  'entityId',
  'studentId',
  'assignedToType',
  'dueDate',
  'priority',
  'status',
  'assignedTo',
] as const;

const TASK_ID_FIELDS = ['entityId', 'studentId', 'assignedTo'] as const;

export const parseTaskId = (id: string): string => {
  if (!isObjectId(id)) throw AppError.badRequest('Invalid task id');
  return id;
};

/** Selects the writable task fields and rejects malformed ObjectIds. */
export const parseTaskBody = (body: unknown): Record<string, unknown> => {
  const data: Record<string, unknown> = pickFields(body, TASK_FIELDS);
  if (TASK_ID_FIELDS.some((field) => data[field] !== undefined && !isObjectId(data[field]))) {
    throw AppError.badRequest('Invalid id in request');
  }
  return data;
};
