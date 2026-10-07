import { found } from '../../core/errors';
import { createAndEmitToAdmins } from '../notifications/notification.service';
import { userRepository } from '../users/user.repository';
import { taskRepository } from './task.repository';
import { parseTaskBody } from './task.validation';

export const taskService = {
  list: () => taskRepository.findAll(),

  async get(id: string) {
    return found(await taskRepository.findByIdPopulated(id), 'Task not found');
  },

  create: (data: Record<string, unknown>) => taskRepository.create(data),

  /** Updates a task; the first time it flips to 'completed' the server stamps who/when and tells the admins. */
  async update(id: string, body: unknown, actorId: string | undefined) {
    const existingTask = found(await taskRepository.findById(id), 'Task not found');

    // Checked after the lookup so an unknown task is still a 404 regardless of the body.
    const incoming = parseTaskBody(body);

    const wasCompleted = existingTask.status === 'completed';
    const isNowCompleted = incoming.status === 'completed';

    if (isNowCompleted && !wasCompleted) {
      incoming.completedAt = new Date();
      incoming.completedBy = actorId;
    }

    const task = found(await taskRepository.update(id, incoming), 'Task not found');

    if (isNowCompleted && !wasCompleted && actorId) {
      try {
        const bdm = await userRepository.findNameById(actorId);
        const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        await createAndEmitToAdmins('Task Completed', `${bdm?.name ?? 'A BDM'} completed task: '${task.title}' at ${time}`, 'success');
      } catch (err) {
        console.error('Task completion notification failed:', err);
      }
    }

    return task;
  },

  async delete(id: string): Promise<void> {
    found(await taskRepository.delete(id), 'Task not found');
  },
};
