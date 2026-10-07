import { asyncHandler } from '../../core/http';
import { taskService } from './task.service';
import { parseTaskBody, parseTaskId } from './task.validation';

// `{ error }` on failure. Writes have always answered an unexpected failure with 400, reads and
// deletes with 500; the messages are fixed (no internal error text).

export const getTasks = asyncHandler(
  async (_req, res) => {
    res.json(await taskService.list());
  },
  { fallbackMessage: 'Failed to fetch tasks', logLabel: 'Error fetching tasks:' },
);

export const getTask = asyncHandler(
  async (req, res) => {
    res.json(await taskService.get(parseTaskId(req.params.id)));
  },
  { fallbackMessage: 'Failed to fetch task', logLabel: 'Error fetching task:' },
);

export const createTask = asyncHandler(
  async (req, res) => {
    res.status(201).json(await taskService.create(parseTaskBody(req.body)));
  },
  { fallbackMessage: 'Failed to create task', fallbackStatus: 400, logLabel: 'Error creating task:' },
);

export const updateTask = asyncHandler(
  async (req, res) => {
    const id = parseTaskId(req.params.id);
    res.json(await taskService.update(id, req.body, req.user?.userId));
  },
  { fallbackMessage: 'Failed to update task', fallbackStatus: 400, logLabel: 'Error updating task:' },
);

export const deleteTask = asyncHandler(
  async (req, res) => {
    await taskService.delete(parseTaskId(req.params.id));
    res.json({ message: 'Task deleted successfully' });
  },
  { fallbackMessage: 'Failed to delete task', logLabel: 'Error deleting task:' },
);
