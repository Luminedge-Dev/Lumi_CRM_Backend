import { Request } from 'express';
import { asyncHandler, HandlerOptions } from '../../core/http';
import { applicationService } from './application.service';
import {
  parseApplicationListQuery,
  parseAssign,
  parseStatusUpdate,
  parseSubmitApplication,
} from './application.validation';

// `{ success: false, message }` on failure. An unexpected failure is a 500 with a fixed message;
// a Mongoose validation failure is also a 500 here (as it always was), carrying its own text.
const opts: HandlerOptions = {
  shape: 'success',
  fallbackMessage: 'Internal server error',
  logLabel: 'application controller error:',
  exposeValidation: true,
  validationStatus: 500,
};

// authenticateStudent sets req.studentId; authenticateToken sets req.userId.
const studentId = (req: Request) => (req as any).studentId;
const staffId = (req: Request) => (req as any).userId;

export const submitApplication = asyncHandler(async (req, res) => {
  const application = await applicationService.submit(studentId(req), parseSubmitApplication(req.body));
  res.status(201).json({ success: true, application });
}, opts);

export const getMyApplications = asyncHandler(async (req, res) => {
  res.json({ success: true, applications: await applicationService.listForStudent(studentId(req)) });
}, opts);

export const getAllApplications = asyncHandler(async (req, res) => {
  const { filter, page, limit } = parseApplicationListQuery(req.query);
  const result = await applicationService.listAll(filter, page, limit);
  res.json({ success: true, ...result });
}, opts);

export const assignStaff = asyncHandler(async (req, res) => {
  const { assignedBDM } = parseAssign(req.body);
  res.json({ success: true, application: await applicationService.assignStaff(req.params.id, assignedBDM, staffId(req)) });
}, opts);

export const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status, note } = parseStatusUpdate(req.body);
  res.json({ success: true, application: await applicationService.updateStatus(req.params.id, status, note, staffId(req)) });
}, opts);

export const getApplicationById = asyncHandler(async (req, res) => {
  res.json({ success: true, application: await applicationService.getById(req.params.id) });
}, opts);

export const getStaffApplications = asyncHandler(async (req, res) => {
  res.json({ success: true, applications: await applicationService.listForStaff(staffId(req)) });
}, opts);
