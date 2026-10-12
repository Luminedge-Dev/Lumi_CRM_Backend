import Lead from '../../models/Lead';
import Task from '../../models/Task';
import User from '../../models/User';

// Read-only data access for the dashboards. The service decides WHICH counts and aggregates it
// needs (the criteria are business rules); this layer only executes them. Nothing here writes.

type Filter = Record<string, any>;

export const dashboardRepository = {
  // ── counts ──
  countLeads: (filter: Filter = {}) => Lead.countDocuments(filter),
  countUsers: (filter: Filter = {}) => User.countDocuments(filter),
  countTasks: (filter: Filter = {}) => Task.countDocuments(filter),

  // ── lists ──
  /** Newest leads by creation date (lean). */
  findRecentLeads: (limit: number) => Lead.find({}).sort({ createdAt: -1 }).limit(limit).lean(),

  /** Most recently updated leads with the assignee's name resolved (lean). */
  findRecentlyUpdatedLeads: (limit: number) =>
    Lead.find().sort({ updatedAt: -1 }).limit(limit).populate('assignedTo', 'name').lean(),

  /** Tasks not yet done and due from `from` on, soonest first, optionally with the linked entity resolved. */
  findUpcomingTasks: (from: Date, limit: number, populateEntity: boolean) => {
    const query = Task.find({ status: { $ne: 'completed' }, dueDate: { $gte: from } })
      .sort({ dueDate: 1 })
      .limit(limit);
    return (populateEntity ? query.populate('entityId') : query).lean();
  },

  findLeadContactsByIds: (ids: unknown[]) => Lead.find({ _id: { $in: ids } }, 'fullName serviceInterest phone').lean(),

  // lean() skips the toJSON credential strip, so select only what the caller uses.
  findActiveBdms: () => User.find({ role: { $in: ['bdm'] }, isActive: true }).select('_id name').lean(),

  // ── aggregates ──
  /** This month's leads grouped by stage and normalised service name. */
  aggregateStageByService: (since: Date) =>
    Lead.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $unwind: { path: '$serviceInterest', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          stage: '$lifecycleStage',
          normalizedService: {
            $toUpper: {
              $trim: {
                input: {
                  $cond: {
                    if: { $eq: [{ $type: '$serviceInterest' }, 'string'] },
                    then: '$serviceInterest',
                    else: '',
                  },
                },
              },
            },
          },
        },
      },
      { $group: { _id: { stage: '$stage', service: '$normalizedService' }, count: { $sum: 1 } } },
    ]),

  aggregateSourceCounts: (since: Date) =>
    Lead.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$source', count: { $sum: 1 } } }]),

  /** All-time lead counts per course label. */
  aggregateCourseCounts: (courseLabels: string[]) =>
    Lead.aggregate([
      { $match: { serviceInterest: { $in: courseLabels } } },
      { $unwind: '$serviceInterest' },
      { $match: { serviceInterest: { $in: courseLabels } } },
      { $group: { _id: '$serviceInterest', count: { $sum: 1 } } },
    ]),

  /** Lead counts per course label for leads created since `since`. */
  aggregateCourseCountsSince: (courseLabels: string[], since: Date) =>
    Lead.aggregate([
      { $match: { createdAt: { $gte: since }, serviceInterest: { $in: courseLabels } } },
      { $unwind: '$serviceInterest' },
      { $match: { serviceInterest: { $in: courseLabels } } },
      { $group: { _id: '$serviceInterest', count: { $sum: 1 } } },
    ]),

  aggregateCreatedStageByMonth: (since: Date) =>
    Lead.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $project: { stage: '$lifecycleStage', monthKey: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } } },
      { $group: { _id: { monthKey: '$monthKey', stage: '$stage' }, count: { $sum: 1 } } },
    ]),

  aggregateClosedStageByMonth: (since: Date) =>
    Lead.aggregate([
      { $match: { updatedAt: { $gte: since }, lifecycleStage: { $in: ['Enrolled', 'Lost'] } } },
      { $project: { stage: '$lifecycleStage', monthKey: { $dateToString: { format: '%Y-%m', date: '$updatedAt' } } } },
      { $group: { _id: { monthKey: '$monthKey', stage: '$stage' }, count: { $sum: 1 } } },
    ]),

  /** Total and converted lead counts per assignee, in one query instead of two counts per BDM. */
  aggregateLeadCountsByAssignee: (assigneeIds: unknown[]) =>
    Lead.aggregate([
      { $match: { assignedTo: { $in: assigneeIds } } },
      {
        $group: {
          _id: '$assignedTo',
          totalLeads: { $sum: 1 },
          convertedLeads: { $sum: { $cond: [{ $eq: ['$lifecycleStage', 'Enrolled'] }, 1, 0] } },
        },
      },
    ]),
};
