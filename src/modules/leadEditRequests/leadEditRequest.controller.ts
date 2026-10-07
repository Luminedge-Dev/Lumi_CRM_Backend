import { Request } from 'express';
import { asyncHandler } from '../../core/http';
import { leadEditRequestService } from './leadEditRequest.service';
import { parseCreateEditRequest, parseListStatus, parseReview } from './leadEditRequest.validation';
import { ReviewDecision } from './leadEditRequest.types';

const actorFrom = (req: Request) => ({
  userId: (req as any).user?.userId as string | undefined,
  role: (req as any).user?.role as string | undefined,
});

// `{ error }` on failure. Unexpected failures answer 500 with a fixed message; a Mongoose
// validation failure on create/review has always been answered 500 too, with its own text.

export const createLeadEditRequest = asyncHandler(
  async (req, res) => {
    const { request, summary } = await leadEditRequestService.createRequest(actorFrom(req), parseCreateEditRequest(req));
    res.status(201).json({ success: true, message: 'Request sent to admin for approval', request, summary });
  },
  {
    shape: 'error',
    fallbackMessage: 'Failed to create request',
    logLabel: 'Error creating lead edit request:',
    exposeValidation: true,
    validationStatus: 500,
  },
);

export const getLeadEditRequests = asyncHandler(
  async (req, res) => {
    const requests = await leadEditRequestService.listRequests(actorFrom(req), parseListStatus(req.query));
    res.json({ success: true, requests });
  },
  { shape: 'error', fallbackMessage: 'Failed to fetch lead edit requests', logLabel: 'Error fetching lead edit requests:' },
);

const reviewHandler = (decision: ReviewDecision) =>
  asyncHandler(
    async (req, res) => {
      const { requestId, reviewNote } = parseReview(req);
      const request = await leadEditRequestService.review(requestId, decision, actorFrom(req), reviewNote);
      res.json({ success: true, request });
    },
    {
      shape: 'error',
      fallbackMessage: 'Failed to review lead edit request',
      logLabel: 'Error reviewing lead edit request:',
      exposeValidation: true,
      validationStatus: 500,
    },
  );

export const approveLeadEditRequest = reviewHandler('approved');
export const rejectLeadEditRequest = reviewHandler('rejected');
