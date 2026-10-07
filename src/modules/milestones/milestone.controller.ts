import { asyncHandler, HandlerOptions } from '../../core/http';
import { milestoneService } from './milestone.service';

// `{ success: false, message }` on failure; unexpected errors are logged and answered generically.
const opts: HandlerOptions = {
  shape: 'success',
  fallbackMessage: 'Internal server error',
  logLabel: 'milestone controller error:',
  exposeValidation: true,
  validationStatus: 500,
};

export const getMyMilestones = asyncHandler(async (req, res) => {
  res.json({ success: true, milestones: await milestoneService.listForStudent((req as any).studentId) });
}, opts);

export const getStudentMilestones = asyncHandler(async (req, res) => {
  res.json({ success: true, milestones: await milestoneService.listForStudent(req.params.studentId) });
}, opts);

export const updateMilestone = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  const milestone = await milestoneService.update(req.params.id, { status, notes }, (req as any).userId);
  res.json({ success: true, milestone });
}, opts);
