import Task from '../../models/Task';
import { createCrudRepository } from '../../shared/db/crud.repository';

// Only `name email role` of an assignee and `name` of the completer are ever populated: never
// the whole user document (credential fields must not reach a response).
const populated = <T extends { populate: (path: string, select: string) => any }>(query: T) =>
  query.populate('assignedTo', 'name email role').populate('completedBy', 'name');

const crud = createCrudRepository(Task);

export const taskRepository = {
  findAll: () => populated(Task.find()),

  findByIdPopulated: (id: string) => populated(Task.findById(id)),

  /** Unpopulated, used to read the current status before an update. */
  findById: crud.findById,

  create: crud.create,

  update: (id: string, data: Record<string, unknown>) => populated(Task.findByIdAndUpdate(id, data, { new: true })),

  /** A BDM's tasks that were due, created or completed inside a date range (report input). */
  findForAssigneeInRange: (assigneeId: unknown, start: Date, end: Date) =>
    Task.find({
      assignedTo: assigneeId,
      status: { $in: ['pending', 'in-progress', 'completed'] },
      $or: [
        { dueDate: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } },
        { completedAt: { $gte: start, $lte: end } },
      ],
    })
      .populate('entityId')
      .populate('completedBy', 'name'),

  delete: crud.delete,
};
