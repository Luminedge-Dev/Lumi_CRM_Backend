import mongoose from 'mongoose';
import Lead, { ILead } from '../../models/Lead';

// All database access for leads. Queries, projections and sorts are unchanged from the controller
// they were extracted from; no schema, index or collection is touched.

const ASSIGNEE_FIELDS = 'name email';
const STUDENT_LEAD_FIELDS = 'fullName email phone source serviceInterest lifecycleStage notes followUps assignedTo createdAt';

export const leadRepository = {
  // ── reads ────────────────────────────────────────────────────────────────
  /** Newest-first candidates for phone typeahead (lean documents). */
  findPhoneCandidates: (filter: Record<string, any>, fetchLimit: number) =>
    Lead.find(filter).select('fullName phone whom createdAt').sort({ createdAt: -1 }).limit(fetchLimit).lean(),

  existsByFilter: async (filter: Record<string, any>): Promise<boolean> => Boolean(await Lead.exists(filter)),

  findPage: (filter: Record<string, any>, skip: number, limit: number) =>
    Lead.find(filter).populate('assignedTo', ASSIGNEE_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit),

  count: (filter: Record<string, any> = {}) => Lead.countDocuments(filter),

  findByIdWithAssignee: (id: string) => Lead.findById(id).populate('assignedTo', ASSIGNEE_FIELDS),

  findByEmail: (email: string) => Lead.findOne({ email }),

  /** Activity feed source: the 500 most recently updated leads matching the filter, with assignee name/role. */
  findForActivityFeed: (filter: Record<string, any>) =>
    Lead.find(filter).populate('assignedTo', 'name role').sort({ updatedAt: -1 }).limit(500),

  /** Leads assigned to someone that were created inside a date range (report input). */
  findCreatedBetweenForAssignee: (assigneeId: unknown, start: Date, end: Date) =>
    Lead.find({ assignedTo: assigneeId, createdAt: { $gte: start, $lte: end } }),

  /** Id of the lead filed under an email address (links a student account to its lead). */
  findIdByEmail: (email: string) => Lead.findOne({ email }).select('_id'),

  /** What a student may see of their own lead. */
  findForStudentById: (id: unknown) =>
    Lead.findById(id).populate('assignedTo', 'name').select(STUDENT_LEAD_FIELDS),

  findForStudentByEmail: (email: string) =>
    Lead.findOne({ email }).populate('assignedTo', 'name').select(STUDENT_LEAD_FIELDS),

  /** The slice of a lead an edit request snapshots, with the assignee name resolved. */
  findForEditRequest: (id: string) =>
    Lead.findById(id)
      .populate('assignedTo', 'name')
      .select('fullName email phone lifecycleStage source serviceInterest assignedTo'),

  // ── writes ───────────────────────────────────────────────────────────────
  create: async (data: Record<string, any>): Promise<ILead> => {
    const lead = new Lead(data);
    await lead.save();
    return lead;
  },

  populateAssignee: async (lead: ILead): Promise<ILead> => {
    await lead.populate('assignedTo', ASSIGNEE_FIELDS);
    return lead;
  },

  updateById: (id: string, data: Record<string, any>) =>
    Lead.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('assignedTo', ASSIGNEE_FIELDS),

  deleteById: (id: string) => Lead.findByIdAndDelete(id),

  pushFollowUp: (id: string, followUp: Record<string, any>) =>
    Lead.findByIdAndUpdate(id, { $push: { followUps: followUp } }, { new: true, runValidators: true }).populate(
      'assignedTo',
      ASSIGNEE_FIELDS,
    ),

  setStage: (id: string, lifecycleStage: string) =>
    Lead.findByIdAndUpdate(id, { lifecycleStage }, { new: true }).populate('assignedTo', ASSIGNEE_FIELDS),

  updateOneByEmail: (email: string, update: Record<string, any>) => Lead.updateOne({ email }, update),

  /** Bulk unassign: clears assignedTo and stamps assignedAt. */
  unassignMany: (leadIds: unknown[]) =>
    Lead.updateMany({ _id: { $in: leadIds } }, { $unset: { assignedTo: '' }, $set: { assignedAt: new Date() } }),

  /**
   * Bulk assign. bdmName (the original CSV-imported name) is cleared too: once a lead has a real
   * assignee it should no longer count toward that historical name bucket.
   */
  assignMany: (leadIds: unknown[], bdmId: unknown) =>
    Lead.updateMany(
      { _id: { $in: leadIds } },
      { $set: { assignedTo: bdmId, assignedAt: new Date() }, $unset: { bdmName: '' } },
    ),

  // ── aggregates ───────────────────────────────────────────────────────────
  aggregateStageTotals: () => Lead.aggregate([{ $group: { _id: '$lifecycleStage', count: { $sum: 1 } } }]),

  aggregateStageCounts: (match: Record<string, any>) =>
    Lead.aggregate([{ $match: match }, { $group: { _id: '$lifecycleStage', count: { $sum: 1 } } }]),

  aggregateBdmNameCounts: () =>
    Lead.aggregate([
      { $match: { bdmName: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$bdmName', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),

  /** Leads with neither a real assignee nor an imported BDM name. */
  countUnassigned: () =>
    Lead.countDocuments({
      $and: [
        { $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }] },
        { $or: [{ bdmName: { $exists: false } }, { bdmName: null }, { bdmName: '' }] },
      ],
    }),

  aggregateCountsByAssignee: (userIds: unknown[]) =>
    Lead.aggregate([
      { $match: { assignedTo: { $in: userIds } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
    ]),

  /** Open/converted counts per assignee (user management screen). */
  aggregateAssigneeCounts: (userIds: unknown[]) =>
    Lead.aggregate([
      { $match: { assignedTo: { $in: userIds } } },
      {
        $group: {
          _id: '$assignedTo',
          activeLeads: { $sum: { $cond: [{ $in: ['$lifecycleStage', ['Enrolled', 'Lost']] }, 0, 1] } },
          convertedLeads: { $sum: { $cond: [{ $eq: ['$lifecycleStage', 'Enrolled'] }, 1, 0] } },
        },
      },
    ]),

  countByAssignee: (userId: unknown, extra: Record<string, unknown> = {}) =>
    Lead.countDocuments({ assignedTo: userId, ...extra }),

  /** Leads that have at least one follow-up with a next date, newest-dated last follow-up first. */
  aggregateFollowUps: (assignedTo?: string) => {
    const match: Record<string, any> = { 'followUps.0': { $exists: true } };
    if (assignedTo) match.assignedTo = new mongoose.Types.ObjectId(assignedTo);

    return Lead.aggregate([
      { $match: match },
      { $addFields: { lastFollowUp: { $last: '$followUps' } } },
      { $match: { 'lastFollowUp.nextFollowUpDate': { $exists: true, $ne: null } } },
      { $sort: { 'lastFollowUp.nextFollowUpDate': 1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'assignedUser',
          // Project only the fields the caller needs: never leak passwordHash et al.
          pipeline: [{ $project: { name: 1, email: 1 } }],
        },
      },
      { $unwind: { path: '$assignedUser', preserveNullAndEmptyArrays: true } },
    ]);
  },
};

/** $match bypasses Mongoose's query casting, so ObjectId-typed fields must be cast explicitly. */
export const toObjectId = (value: unknown) => new mongoose.Types.ObjectId(String(value));
