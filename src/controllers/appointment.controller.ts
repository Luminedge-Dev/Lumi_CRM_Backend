import { Request, Response } from 'express';
import Appointment from '../models/Appointment';

export const requestAppointment = async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).studentId;
    const { type, scheduledAt, durationMinutes, notes } = req.body;

    const appt = await Appointment.create({ studentId, type, scheduledAt, durationMinutes, notes });
    res.status(201).json({ success: true, appointment: appt });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMyAppointments = async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).studentId;
    const appts = await Appointment.find({ studentId })
      .populate('staffId', 'name role')
      .sort({ scheduledAt: 1 });
    res.json({ success: true, appointments: appts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllAppointments = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const filter: any = {};
    if (status) filter.status = status;

    const appts = await Appointment.find(filter)
      .populate('studentId', 'name email')
      .populate('staffId', 'name role')
      .sort({ scheduledAt: 1 });

    res.json({ success: true, appointments: appts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateAppointment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const appt = await Appointment.findByIdAndUpdate(id, updates, { new: true })
      .populate('studentId', 'name email')
      .populate('staffId', 'name role');

    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    res.json({ success: true, appointment: appt });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
