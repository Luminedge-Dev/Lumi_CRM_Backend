import { Request } from 'express';
import { AppError } from '../../core/errors';
import { CreateEditRequestInput } from './leadEditRequest.types';

export const safeString = (value: unknown): string => String(value ?? '').trim();

/** Parses and validates the body of a "request an edit to this lead" call, in the original check order. */
export const parseCreateEditRequest = (req: Request): CreateEditRequestInput => {
  const leadId = req.params.leadId || req.params.id;
  const { section = 'general', payload, note } = req.body ?? {};

  if (!leadId) throw AppError.badRequest('Lead ID is required');

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw AppError.badRequest('Request payload is required');
  }

  if (section === 'follow-up' && !safeString(payload.note)) throw AppError.badRequest('Follow-up note is required');

  if (section === 'stage' && !safeString(payload.lifecycleStage)) {
    throw AppError.badRequest('Lifecycle stage is required');
  }

  return { leadId, section, payload, note };
};

export const parseListStatus = (query: Record<string, unknown>): string | undefined =>
  query.status && query.status !== 'all' ? String(query.status) : undefined;

export const parseReview = (req: Request): { requestId: string; reviewNote: unknown } => ({
  requestId: req.params.requestId || req.params.id,
  reviewNote: (req.body ?? {}).reviewNote,
});
