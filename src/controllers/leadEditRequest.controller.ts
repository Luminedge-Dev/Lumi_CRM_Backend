import { Request, Response } from 'express';
import Lead from '../models/Lead';
import User from '../models/User';
import LeadEditRequest, { ILeadEditRequest } from '../models/LeadEditRequest';
import { createAndEmitNotification, createAndEmitToAdmins } from '../services/notification.service';
import { canonicalizePhoneValue, buildPhoneEntryFilter } from '../utils/phone.util';

const LEAD_STAGES = ['New Inquiry', 'Contacted', 'Trial Class', 'Enrolled', 'Lost'] as const;
const PHONE_LOOKUP_MESSAGE = 'This number already exists. Already used, try with another number.';

// Matches any lead whose `phone` field contains the canonical number as one of its (possibly
// multiple, comma-separated) entries. See leads.controller.ts's assertPhoneIsUnique for the
// same helper and rationale.
const isPhoneDuplicate = async (phone: string, excludeId?: string): Promise<boolean> => {
  const canonical = canonicalizePhoneValue(phone);
  if (!canonical) return false;

  const entryFilter = buildPhoneEntryFilter(canonical);
  if (!entryFilter) return false;

  const filter: Record<string, any> = { ...entryFilter };
  if (excludeId) filter._id = { $ne: excludeId };

  const existing = await Lead.exists(filter);
  return Boolean(existing);
};

const safeString = (value: unknown): string => String(value ?? '').trim();

const normalizeServiceInterest = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(item => safeString(item)).filter(Boolean);
  }
  const single = safeString(value);
  return single ? [single] : [];
};

const buildLeadUpdateData = async (leadId: string, payload: Record<string, any>) => {
  const updateData: Record<string, any> = {};

  if (payload.fullName !== undefined) {
    updateData.fullName = safeString(payload.fullName);
  }
  if (payload.email !== undefined) {
    const email = safeString(payload.email).toLowerCase();
    if (email) updateData.email = email;
  }
  if (payload.phone !== undefined) {
    const phone = safeString(payload.phone);
    if (phone && await isPhoneDuplicate(phone, leadId)) {
      throw new Error(PHONE_LOOKUP_MESSAGE);
    }
    if (phone) updateData.phone = phone;
  }
  if (payload.whom !== undefined) {
    const whom = safeString(payload.whom);
    updateData.whom = whom || undefined;
  }
  if (payload.source !== undefined) {
    const source = safeString(payload.source);
    updateData.source = source || undefined;
  }
  if (payload.serviceInterest !== undefined) {
    const serviceInterest = normalizeServiceInterest(payload.serviceInterest);
    if (serviceInterest.length > 0) updateData.serviceInterest = serviceInterest;
  }
  if (payload.notes !== undefined) {
    updateData.notes = safeString(payload.notes);
  }
  if (payload.lifecycleStage !== undefined) {
    const stage = safeString(payload.lifecycleStage);
    if (!LEAD_STAGES.includes(stage as (typeof LEAD_STAGES)[number])) {
      throw new Error('Invalid lifecycle stage');
    }
    updateData.lifecycleStage = stage;
  }

  return updateData;
};

const buildFollowUpPayload = (payload: Record<string, any>) => {
  const note = safeString(payload.note);
  const date = safeString(payload.date);
  const nextFollowUpDate = safeString(payload.nextFollowUpDate);

  return {
    date: date ? new Date(date) : undefined,
    note,
    nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
    createdAt: new Date(),
  };
};

const leadEditRequestSummary = (request: ILeadEditRequest) => {
  const section = request.section || 'general';
  const payload = request.payload || {};

  if (section === 'follow-up') {
    return payload.note ? `Follow-up note: ${safeString(payload.note)}` : 'Follow-up update';
  }
  if (section === 'stage') {
    return payload.lifecycleStage ? `Stage change to ${safeString(payload.lifecycleStage)}` : 'Stage change request';
  }
  if (section === 'contact') {
    const parts: string[] = [];
    if (payload.email !== undefined) parts.push(`email ${safeString(payload.email)}`);
    if (payload.phone !== undefined) parts.push(`phone ${safeString(payload.phone)}`);
    return parts.length > 0 ? parts.join(', ') : 'Contact update';
  }

  const keys = Object.keys(payload);
  return keys.length > 0 ? `Update: ${keys.join(', ')}` : 'General lead update';
};

export const createLeadEditRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const leadId = req.params.leadId || req.params.id;
    const reqUser = (req as any).user;
    const { section = 'general', payload, note } = req.body ?? {};

    if (!leadId) {
      res.status(400).json({ error: 'Lead ID is required' });
      return;
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      res.status(400).json({ error: 'Request payload is required' });
      return;
    }

    if (section === 'follow-up' && !safeString(payload.note)) {
      res.status(400).json({ error: 'Follow-up note is required' });
      return;
    }

    if (section === 'stage' && !safeString(payload.lifecycleStage)) {
      res.status(400).json({ error: 'Lifecycle stage is required' });
      return;
    }

    const lead = await Lead.findById(leadId)
      .populate('assignedTo', 'name')
      .select('fullName email phone lifecycleStage source serviceInterest assignedTo');

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    if (reqUser?.role !== 'admin') {
      const assignedToId = (lead as any).assignedTo?._id?.toString() ?? (lead as any).assignedTo?.toString();
      if (assignedToId !== reqUser?.userId) {
        res.status(403).json({ error: 'You are not assigned to this lead' });
        return;
      }
    }

    const requester = reqUser?.userId
      ? await User.findById(reqUser.userId).select('name role')
      : null;

    const requestDoc = await LeadEditRequest.create({
      leadId,
      section: safeString(section) || 'general',
      payload,
      note: safeString(note) || undefined,
      status: 'pending',
      requestedBy: reqUser?.userId,
      requestedByName: requester?.name || 'BDM',
      leadSnapshot: {
        fullName: (lead as any).fullName,
        email: (lead as any).email,
        phone: (lead as any).phone,
        lifecycleStage: (lead as any).lifecycleStage,
        source: (lead as any).source,
        serviceInterest: Array.isArray((lead as any).serviceInterest) ? (lead as any).serviceInterest : [],
        assignedTo: (lead as any).assignedTo && typeof (lead as any).assignedTo === 'object'
          ? (lead as any).assignedTo.name
          : undefined,
      },
    });

    await createAndEmitToAdmins(
      'Lead Edit Request',
      `${requester?.name || 'A BDM'} requested an update for ${(lead as any).fullName || 'Unnamed lead'}`,
      'warning',
      '/admin/edit-request'
    );

    res.status(201).json({
      success: true,
      message: 'Request sent to admin for approval',
      request: requestDoc,
      summary: leadEditRequestSummary(requestDoc),
    });
  } catch (error: any) {
    console.error('Error creating lead edit request:', error);
    res.status(500).json({ error: error?.message || 'Failed to create request' });
  }
};

export const getLeadEditRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const reqUser = (req as any).user;
    const role = String(reqUser?.role || '');

    const filter: Record<string, any> = {};
    if (status && status !== 'all') {
      filter.status = String(status);
    }

    if (role !== 'admin') {
      filter.requestedBy = reqUser?.userId;
    }

    const requests = await LeadEditRequest.find(filter)
      .populate('leadId', 'fullName email phone lifecycleStage source serviceInterest updatedAt assignedTo')
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error('Error fetching lead edit requests:', error);
    res.status(500).json({ error: 'Failed to fetch lead edit requests' });
  }
};

const reviewLeadEditRequest = async (
  req: Request,
  res: Response,
  nextStatus: 'approved' | 'rejected'
): Promise<void> => {
  try {
    const requestId = req.params.requestId || req.params.id;
    const reqUser = (req as any).user;
    const { reviewNote } = req.body ?? {};

    const requestDoc = await LeadEditRequest.findById(requestId);
    if (!requestDoc) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (requestDoc.status !== 'pending') {
      res.status(400).json({ error: 'Request has already been reviewed' });
      return;
    }

    const reviewer = reqUser?.userId
      ? await User.findById(reqUser.userId).select('name role')
      : null;

    if (nextStatus === 'approved') {
      const leadId = String(requestDoc.leadId);
      const payload = requestDoc.payload || {};

      if (requestDoc.section === 'follow-up') {
        const followUp = buildFollowUpPayload(payload);
        if (!followUp.note) {
          res.status(400).json({ error: 'Follow-up note is required' });
          return;
        }

        const updatedLead = await Lead.findByIdAndUpdate(
          leadId,
          {
            $push: { followUps: followUp },
          },
          { new: true, runValidators: true }
        ).populate('assignedTo', 'name email');

        if (!updatedLead) {
          res.status(404).json({ error: 'Lead not found' });
          return;
        }
      } else {
        const updateData = await buildLeadUpdateData(leadId, payload);

        if (Object.keys(updateData).length === 0) {
          res.status(400).json({ error: 'No updatable fields found in request payload' });
          return;
        }

        const updatedLead = await Lead.findByIdAndUpdate(
          leadId,
          updateData,
          { new: true, runValidators: true }
        ).populate('assignedTo', 'name email');

        if (!updatedLead) {
          res.status(404).json({ error: 'Lead not found' });
          return;
        }
      }

      requestDoc.status = 'approved';
      requestDoc.reviewedBy = reqUser?.userId;
      requestDoc.reviewedAt = new Date();
      requestDoc.reviewNote = safeString(reviewNote) || undefined;
      await requestDoc.save();

      const requesterId = requestDoc.requestedBy?.toString();
      if (requesterId) {
        await createAndEmitNotification(
          requesterId,
          'Lead Edit Request Approved',
          `${reviewer?.name || 'Admin'} approved your ${requestDoc.section} request.`,
          'success',
          '/admin/edit-request'
        );
      }
    } else {
      requestDoc.status = 'rejected';
      requestDoc.reviewedBy = reqUser?.userId;
      requestDoc.reviewedAt = new Date();
      requestDoc.reviewNote = safeString(reviewNote) || undefined;
      await requestDoc.save();

      const requesterId = requestDoc.requestedBy?.toString();
      if (requesterId) {
        await createAndEmitNotification(
          requesterId,
          'Lead Edit Request Rejected',
          `${reviewer?.name || 'Admin'} rejected your ${requestDoc.section} request.`,
          'warning',
          '/admin/edit-request'
        );
      }
    }

    const populatedRequest = await LeadEditRequest.findById(requestDoc._id)
      .populate('leadId', 'fullName email phone lifecycleStage source serviceInterest updatedAt assignedTo')
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role');

    res.json({
      success: true,
      request: populatedRequest,
    });
  } catch (error: any) {
    console.error('Error reviewing lead edit request:', error);
    res.status(500).json({ error: error?.message || 'Failed to review lead edit request' });
  }
};

export const approveLeadEditRequest = async (req: Request, res: Response): Promise<void> => {
  return reviewLeadEditRequest(req, res, 'approved');
};

export const rejectLeadEditRequest = async (req: Request, res: Response): Promise<void> => {
  return reviewLeadEditRequest(req, res, 'rejected');
};

