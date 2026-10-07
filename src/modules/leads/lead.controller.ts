import { Request } from 'express';
import { asyncHandler, HandlerOptions } from '../../core/http';
import { leadService } from './lead.service';
import {
  parseAssign,
  parseFollowUp,
  parseImport,
  parseLeadPagination,
  parseLeadWrite,
  parsePhoneLookup,
  parseStageUpdate,
} from './lead.validation';

// Leads speak `{ error: string }` on every failure; the frontend reads `data.error`.
// A Mongoose validation failure is answered 400 with its (caller-input-only) text; every other
// unexpected failure gets the fixed fallback message and is logged server-side.
const opts = (fallbackMessage: string, logLabel: string, extra: HandlerOptions = {}): HandlerOptions => ({
  shape: 'error',
  fallbackMessage,
  logLabel,
  ...extra,
});

const actorFrom = (req: Request) => ({ userId: (req as any).user?.userId as string | undefined, role: (req as any).user?.role });

export const getLeads = asyncHandler(
  async (req, res) => {
    const { page, limit, skip } = parseLeadPagination(req.query);
    res.json(await leadService.getLeads(req.query, page, limit, skip));
  },
  opts('Failed to fetch leads', 'Error fetching leads:'),
);

export const getFollowUpLeads = asyncHandler(
  async (req, res) => {
    const assignedTo = req.query.assignedTo ? String(req.query.assignedTo) : undefined;
    res.json({ leads: await leadService.getFollowUpLeads({ assignedTo }) });
  },
  opts('Failed to fetch follow-up leads', 'Error fetching follow-up leads:'),
);

export const lookupLeadPhone = asyncHandler(
  async (req, res) => {
    const { query, limit, excludeId } = parsePhoneLookup(req.query);
    res.json(await leadService.lookupPhone(query, limit, excludeId));
  },
  opts('Failed to lookup phone suggestions', 'Error looking up phone suggestions:'),
);

export const getLead = asyncHandler(
  async (req, res) => {
    res.json(await leadService.getLead(req.params.id));
  },
  opts('Failed to fetch lead', 'Error fetching lead:'),
);

export const createLead = asyncHandler(
  async (req, res) => {
    res.status(201).json(await leadService.createLead(actorFrom(req), parseLeadWrite(req.body)));
  },
  opts('Failed to create lead', 'Error creating lead:', { exposeValidation: true }),
);

export const updateLead = asyncHandler(
  async (req, res) => {
    res.json(await leadService.updateLead(req.params.id, parseLeadWrite(req.body)));
  },
  opts('Failed to update lead', 'Error updating lead:', { exposeValidation: true }),
);

export const deleteLead = asyncHandler(
  async (req, res) => {
    await leadService.deleteLead(req.params.id);
    res.json({ message: 'Lead deleted successfully' });
  },
  opts('Failed to delete lead', 'Error deleting lead:'),
);

export const addFollowUp = asyncHandler(
  async (req, res) => {
    res.json(await leadService.addFollowUp(req.params.id, parseFollowUp(req.body)));
  },
  opts('Failed to add follow-up', 'Error adding follow-up:'),
);

export const updateLeadStage = asyncHandler(
  async (req, res) => {
    const stage = parseStageUpdate(req.body);
    res.json(await leadService.updateStage(req.params.id, stage, actorFrom(req)));
  },
  opts('Failed to update lead stage', 'Error updating lead stage:'),
);

export const getBDMs = asyncHandler(
  async (_req, res) => {
    res.json(await leadService.listAssignableUsers());
  },
  opts('Failed to fetch BDMs', 'Error fetching BDMs:'),
);

export const getLeadBdmNames = asyncHandler(
  async (_req, res) => {
    res.json(await leadService.getBdmNames());
  },
  opts('Failed to fetch lead BDM names', 'Error fetching lead BDM names:'),
);

export const importLeads = asyncHandler(
  async (req, res) => {
    res.json(await leadService.importLeads(parseImport(req.body)));
  },
  opts('Failed to import leads', 'Error importing leads:'),
);

export const getLeadStats = asyncHandler(
  async (_req, res) => {
    res.json(await leadService.getStats());
  },
  opts('Failed to fetch lead statistics', 'Error fetching lead stats:'),
);

export const getLeadStageCounts = asyncHandler(
  async (req, res) => {
    res.json(await leadService.getStageCounts(req.query));
  },
  opts('Failed to fetch lead stage counts', 'Error fetching lead stage counts:'),
);

export const assignLeads = asyncHandler(
  async (req, res) => {
    const { leadIds, bdmId } = parseAssign(req.body);
    res.json(await leadService.assignLeads(leadIds, bdmId));
  },
  opts('Failed to assign leads', 'Error assigning leads:'),
);
