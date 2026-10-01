import mongoose from 'mongoose';
import Lead from '../models/Lead';
import { getDhakaDayBounds } from '../utils/date';

export type FollowUpDueStatus = 'overdue' | 'today' | 'upcoming';

// Single source of truth for "which leads need a follow-up", shared by the reminder cron
// (checkFollowUpsDueToday in scheduler.service.ts) and the /leads/follow-ups endpoint, so the
// dashboard widget, the Follow-up Reminders page, and the sidebar badge all agree.
export async function findFollowUpLeads(opts: { assignedTo?: string }): Promise<any[]> {
  const { todayStart, todayEnd } = getDhakaDayBounds();

  const match: Record<string, any> = { 'followUps.0': { $exists: true } };
  if (opts.assignedTo) {
    match.assignedTo = new mongoose.Types.ObjectId(opts.assignedTo);
  }

  const leads = await Lead.aggregate([
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
        // Project only the fields the caller needs — never leak passwordHash et al.
        pipeline: [{ $project: { name: 1, email: 1 } }],
      },
    },
    { $unwind: { path: '$assignedUser', preserveNullAndEmptyArrays: true } },
  ]);

  return leads.map((lead) => {
    const due: Date = lead.lastFollowUp.nextFollowUpDate;
    const dueStatus: FollowUpDueStatus = due < todayStart ? 'overdue' : due <= todayEnd ? 'today' : 'upcoming';
    return { ...lead, dueStatus };
  });
}
