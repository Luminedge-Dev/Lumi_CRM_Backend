import LeadEditRequest, { ILeadEditRequest } from '../../models/LeadEditRequest';

const LEAD_FIELDS = 'fullName email phone lifecycleStage source serviceInterest updatedAt assignedTo';

export const leadEditRequestRepository = {
  create: (data: Record<string, any>) => LeadEditRequest.create(data),

  findById: (id: unknown) => LeadEditRequest.findById(id),

  save: (doc: ILeadEditRequest) => doc.save(),

  /** Newest first, with the lead and the people involved resolved. */
  findAll: (filter: Record<string, any>) =>
    LeadEditRequest.find(filter)
      .populate('leadId', LEAD_FIELDS)
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 }),

  findByIdPopulated: (id: unknown) =>
    LeadEditRequest.findById(id)
      .populate('leadId', LEAD_FIELDS)
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role'),
};
