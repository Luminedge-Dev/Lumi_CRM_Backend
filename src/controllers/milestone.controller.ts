import { Request, Response } from 'express';
import Milestone from '../models/Milestone';

export const getMyMilestones = async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).studentId;
    const milestones = await Milestone.find({ studentId }).sort({ order: 1 });
    res.json({ success: true, milestones });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getStudentMilestones = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const milestones = await Milestone.find({ studentId }).sort({ order: 1 });
    res.json({ success: true, milestones });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateMilestone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = (req as any).userId;

    const update: any = { status, updatedBy: userId };
    if (notes !== undefined) update.notes = notes;
    if (status === 'Completed') update.completedAt = new Date();

    const milestone = await Milestone.findByIdAndUpdate(id, update, { new: true });
    if (!milestone) return res.status(404).json({ success: false, message: 'Milestone not found' });

    res.json({ success: true, milestone });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
