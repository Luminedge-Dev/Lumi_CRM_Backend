import { AppError } from '../../core/errors';
import { LEAD_STAGES } from '../../shared/constants/leadStages';
import { createAndEmitNotification, createAndEmitToAdmins } from '../notifications/notification.service';
import type { ILeadEditRequest } from '../../models/LeadEditRequest';
import { leadRepository } from '../leads/lead.repository';
import { leadService } from '../leads/lead.service';
import { userRepository } from '../users/user.repository';
import { leadEditRequestRepository } from './leadEditRequest.repository';
import { safeString } from './leadEditRequest.validation';
import { CreateEditRequestInput, EditRequestActor, ReviewDecision } from './leadEditRequest.types';

// BDMs cannot edit leads they do not own directly: they file an edit request against a lead
// assigned to them, and an admin approves or rejects it. Approval applies the change.

const REQUESTS_LINK = '/admin/edit-request';

const normalizeServiceInterest = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => safeString(item)).filter(Boolean);
  const single = safeString(value);
  return single ? [single] : [];
};

/**
 * Converts an approved request payload into a lead update. Validation failures here are plain
 * Errors on purpose: the endpoint has always answered them with its generic 500 message.
 */
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
    if (phone && (await leadService.isPhoneTaken(phone, leadId))) {
      throw new Error('This number already exists. Already used, try with another number.');
    }
    if (phone) updateData.phone = phone;
  }
  if (payload.whom !== undefined) {
    updateData.whom = safeString(payload.whom) || undefined;
  }
  if (payload.source !== undefined) {
    updateData.source = safeString(payload.source) || undefined;
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

/** One-line description of what the request asks for, shown in the admin list. */
export const summarizeRequest = (request: ILeadEditRequest): string => {
  const section = request.section || 'general';
  const payload: Record<string, any> = request.payload || {};

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

export const leadEditRequestService = {
  async createRequest(actor: EditRequestActor, { leadId, section, payload, note }: CreateEditRequestInput) {
    const lead: any = await leadRepository.findForEditRequest(leadId);
    if (!lead) throw AppError.notFound('Lead not found');

    // Ownership rule: a BDM may only file requests for a lead assigned to them.
    if (actor.role !== 'admin') {
      const assignedToId = lead.assignedTo?._id?.toString() ?? lead.assignedTo?.toString();
      if (assignedToId !== actor.userId) throw AppError.forbidden('You are not assigned to this lead');
    }

    const requester = actor.userId ? await userRepository.findNameAndRoleById(actor.userId) : null;

    const requestDoc = await leadEditRequestRepository.create({
      leadId,
      section: safeString(section) || 'general',
      payload,
      note: safeString(note) || undefined,
      status: 'pending',
      requestedBy: actor.userId,
      requestedByName: requester?.name || 'BDM',
      leadSnapshot: {
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        lifecycleStage: lead.lifecycleStage,
        source: lead.source,
        serviceInterest: Array.isArray(lead.serviceInterest) ? lead.serviceInterest : [],
        assignedTo: lead.assignedTo && typeof lead.assignedTo === 'object' ? lead.assignedTo.name : undefined,
      },
    });

    await createAndEmitToAdmins(
      'Lead Edit Request',
      `${requester?.name || 'A BDM'} requested an update for ${lead.fullName || 'Unnamed lead'}`,
      'warning',
      REQUESTS_LINK,
    );

    return { request: requestDoc, summary: summarizeRequest(requestDoc) };
  },

  /** Admins see every request; a BDM sees only their own. */
  async listRequests(actor: EditRequestActor, status?: string) {
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (String(actor.role || '') !== 'admin') filter.requestedBy = actor.userId;

    return leadEditRequestRepository.findAll(filter);
  },

  async review(requestId: string, decision: ReviewDecision, actor: EditRequestActor, reviewNote: unknown) {
    const requestDoc = await leadEditRequestRepository.findById(requestId);
    if (!requestDoc) throw AppError.notFound('Request not found');
    if (requestDoc.status !== 'pending') throw AppError.badRequest('Request has already been reviewed');

    const reviewer = actor.userId ? await userRepository.findNameAndRoleById(actor.userId) : null;

    if (decision === 'approved') {
      const leadId = String(requestDoc.leadId);
      const payload: Record<string, any> = requestDoc.payload || {};

      if (requestDoc.section === 'follow-up') {
        const followUp = buildFollowUpPayload(payload);
        if (!followUp.note) throw AppError.badRequest('Follow-up note is required');

        const updatedLead = await leadRepository.pushFollowUp(leadId, followUp);
        if (!updatedLead) throw AppError.notFound('Lead not found');
      } else {
        const updateData = await buildLeadUpdateData(leadId, payload);
        if (Object.keys(updateData).length === 0) {
          throw AppError.badRequest('No updatable fields found in request payload');
        }

        const updatedLead = await leadRepository.updateById(leadId, updateData);
        if (!updatedLead) throw AppError.notFound('Lead not found');
      }
    }

    requestDoc.status = decision;
    requestDoc.reviewedBy = actor.userId as any;
    requestDoc.reviewedAt = new Date();
    requestDoc.reviewNote = safeString(reviewNote) || undefined;
    await leadEditRequestRepository.save(requestDoc);

    const requesterId = requestDoc.requestedBy?.toString();
    if (requesterId) {
      const reviewerName = reviewer?.name || 'Admin';
      if (decision === 'approved') {
        await createAndEmitNotification(
          requesterId,
          'Lead Edit Request Approved',
          `${reviewerName} approved your ${requestDoc.section} request.`,
          'success',
          REQUESTS_LINK,
        );
      } else {
        await createAndEmitNotification(
          requesterId,
          'Lead Edit Request Rejected',
          `${reviewerName} rejected your ${requestDoc.section} request.`,
          'warning',
          REQUESTS_LINK,
        );
      }
    }

    return leadEditRequestRepository.findByIdPopulated(requestDoc._id);
  },
};
