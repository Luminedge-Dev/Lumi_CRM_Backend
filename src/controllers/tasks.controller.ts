import { Request, Response } from 'express';
import Task from '../models/Task';
import User from '../models/User';
import { createAndEmitToAdmins } from '../services/notification.service';

export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const tasks = await Task.find().populate('assignedTo').populate('completedBy', 'name');
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

export const getTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id).populate('assignedTo').populate('completedBy', 'name');
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
};

export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = new Task(req.body);
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create task' });
  }
};

export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const existingTask = await Task.findById(req.params.id);
    if (!existingTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const incoming = { ...req.body };
    const wasCompleted = existingTask.status === 'completed';
    const isNowCompleted = incoming.status === 'completed';

    if (isNowCompleted && !wasCompleted) {
      incoming.completedAt = new Date();
      incoming.completedBy = req.user?.userId;
    }

    const task = await Task.findByIdAndUpdate(req.params.id, incoming, { new: true })
      .populate('assignedTo')
      .populate('completedBy', 'name');

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (isNowCompleted && !wasCompleted && req.user?.userId) {
      try {
        const bdm = await User.findById(req.user.userId).select('name');
        const time = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        await createAndEmitToAdmins(
          'Task Completed',
          `${bdm?.name ?? 'A BDM'} completed task: '${task.title}' at ${time}`,
          'success'
        );
      } catch (err) {
        console.error('Task completion notification failed:', err);
      }
    }

    res.json(task);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update task' });
  }
};

export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
};
