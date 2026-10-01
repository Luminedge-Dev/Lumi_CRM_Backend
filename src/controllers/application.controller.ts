import { Request, Response } from 'express';
import Application from '../models/Application';
import Milestone, { MILESTONE_TEMPLATES } from '../models/Milestone';
import Conversation from '../models/Conversation';
import Student from '../models/Student';
import User from '../models/User';

export const submitApplication = async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).studentId;
    const { serviceType, serviceDetail, targetCountry, targetUniversity, targetCourse, preferredIntake } = req.body;

    const app = await Application.create({
      studentId,
      serviceType,
      serviceDetail,
      targetCountry,
      targetUniversity,
      targetCourse,
      preferredIntake,
      status: 'Submitted',
      stageHistory: [{ status: 'Submitted', changedBy: studentId, changedAt: new Date() }],
    });

    res.status(201).json({ success: true, application: app });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMyApplications = async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).studentId;
    const apps = await Application.find({ studentId })
      .populate('assignedBDM', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ success: true, applications: apps });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllApplications = async (req: Request, res: Response) => {
  try {
    const { status, serviceType, page = 1, limit = 20 } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    if (serviceType) filter.serviceType = serviceType;

    const apps = await Application.find(filter)
      .populate('studentId', 'name email phone serviceCategory')
      .populate('assignedBDM', 'name role')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Application.countDocuments(filter);
    res.json({ success: true, applications: apps, total, page: Number(page) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const assignStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { assignedBDM } = req.body;
    const adminId = (req as any).userId;

    const app = await Application.findById(id).populate('studentId', 'name email');
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    if (assignedBDM) app.assignedBDM = assignedBDM;

    app.stageHistory.push({ status: app.status, changedBy: adminId, changedAt: new Date(), note: 'Staff assigned' });
    await app.save();

    // Update Student assigned BDM
    await Student.findByIdAndUpdate(app.studentId, {
      ...(assignedBDM && { assignedBDM }),
    });

    // Auto-create milestones if none exist for this application
    const existingMilestones = await Milestone.countDocuments({ applicationId: id });
    if (existingMilestones === 0) {
      const templates = MILESTONE_TEMPLATES[app.serviceType] || MILESTONE_TEMPLATES['Study Abroad'];
      const milestones = templates.map((title: string, idx: number) => ({
        studentId: app.studentId,
        applicationId: app._id,
        serviceType: app.serviceType,
        title,
        order: idx + 1,
        status: idx === 0 ? 'In Progress' : 'Pending',
      }));
      await Milestone.insertMany(milestones);
    }

    // Create conversation between student and assigned BDM
    const student = app.studentId as any;
    if (assignedBDM) {
      const bdm = await User.findById(assignedBDM).select('name role');
      if (bdm) {
        const existing = await Conversation.findOne({
          'participants.participantId': { $all: [String(student._id), String(assignedBDM)] },
          applicationId: app._id,
        });
        if (!existing) {
          await Conversation.create({
            participants: [
              { participantId: String(student._id), participantType: 'student', name: student.name, role: 'Student' },
              { participantId: String(assignedBDM), participantType: 'staff', name: bdm.name, role: bdm.role },
            ],
            applicationId: app._id,
            title: `${student.name} — ${bdm.name}`,
          });
        }
      }
    }

    res.json({ success: true, application: app });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateApplicationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const userId = (req as any).userId;

    const app = await Application.findById(id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    app.status = status;
    app.stageHistory.push({ status, changedBy: userId, changedAt: new Date(), note });
    await app.save();

    res.json({ success: true, application: app });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getApplicationById = async (req: Request, res: Response) => {
  try {
    const app = await Application.findById(req.params.id)
      .populate('studentId', 'name email phone serviceCategory onboardingComplete')
      .populate('assignedBDM', 'name email role');

    if (!app) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, application: app });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getStaffApplications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const role = (req as any).role;

    const filter: any = { assignedBDM: userId };

    const apps = await Application.find(filter)
      .populate('studentId', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, applications: apps });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
