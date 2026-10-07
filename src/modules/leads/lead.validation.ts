import { AppError } from '../../core/errors';
import { isLeadStage } from '../../shared/constants/leadStages';
import { parsePagination, pickFields } from '../../shared/validators/request';
import { LeadWriteInput } from './lead.types';

// Request parsing for the leads endpoints. Each function selects only the fields the endpoint
// accepts; protected fields (assignedAt, bdmName, createdAt...) can never come from a client.

const LEAD_FIELDS = [
  'fullName',
  'email',
  'phone',
  'whom',
  'source',
  'serviceInterest',
  'assignedTo',
  'notes',
  'followUps',
  'lifecycleStage',
] as const;

export const parseLeadWrite = (body: unknown): LeadWriteInput => pickFields(body, LEAD_FIELDS) as LeadWriteInput;

/** Lead list pagination: default 50, capped at 500 (the Lead Center renders large pages). */
export const parseLeadPagination = (query: { page?: unknown; limit?: unknown }) =>
  parsePagination(query, { defaultLimit: 50, maxLimit: 500 });

export const parseFollowUp = (body: any) => {
  const { date, note, nextFollowUpDate } = body;
  return { date, note, nextFollowUpDate };
};

export const parseStageUpdate = (body: any): string => {
  const { lifecycleStage } = body;
  if (!isLeadStage(lifecycleStage)) throw AppError.badRequest('Invalid lifecycle stage');
  return lifecycleStage;
};

export const parsePhoneLookup = (query: Record<string, unknown>) => {
  const text = String(query.query ?? query.phone ?? '').trim();
  const limit = Number.parseInt(String(query.limit ?? '8'), 10);
  const excludeId = query.excludeId ? String(query.excludeId) : undefined;
  return { query: text, limit: Number.isNaN(limit) ? 8 : Math.min(Math.max(limit, 1), 20), excludeId };
};

export const parseAssign = (body: any): { leadIds: unknown[]; bdmId: unknown } => {
  const { leadIds, bdmId } = body;
  if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) throw AppError.badRequest('Lead IDs are required');
  return { leadIds, bdmId };
};

export const parseImport = (body: any): any[] => {
  const { leads } = body;
  if (!leads || !Array.isArray(leads)) throw AppError.badRequest('Invalid leads data. Expected array of leads.');
  return leads;
};
