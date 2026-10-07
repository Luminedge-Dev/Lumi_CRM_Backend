import { AppError } from '../../core/errors';
import { leadRepository } from '../leads/lead.repository';
import { taskRepository } from '../tasks/task.repository';
import { userRepository } from '../users/user.repository';
import { getDateRange } from './report.range';

function classifyNote(note: string): string {
  const n = note.toLowerCase();
  if (n.includes('call') || n.includes('phone') || n.includes('rang')) return 'call';
  if (n.includes('email') || n.includes('mail')) return 'email';
  if (n.includes('whatsapp') || n.includes('wa')) return 'whatsapp';
  return 'follow_up';
}

export interface BdmReportQuery {
  range?: string;
  bdm?: string;
  startDate?: string;
  endDate?: string;
  month?: string;
  year?: string;
}

export const reportService = {
  /** Per-BDM performance for a date window, plus an overall summary. */
  async getBdmReport({ range = 'this_month', bdm, startDate, endDate, month, year }: BdmReportQuery) {
    const { start, end } = getDateRange(
      range,
      startDate,
      endDate,
      month ? parseInt(month) : undefined,
      year ? parseInt(year) : undefined,
    );

    const bdmFilter: Record<string, unknown> = {};
    if (bdm && bdm !== 'all') bdmFilter._id = bdm;

    const bdmUsers = await userRepository.listBdmsForReport(bdmFilter);

    const performances = await Promise.all(
      bdmUsers.map(async (uDoc) => {
        const u = uDoc.toObject();
        const leads = await leadRepository.findCreatedBetweenForAssignee(u._id, start, end);

        const leadsAssigned = leads.length;
        const leadsConverted = leads.filter((l) => l.lifecycleStage === 'Enrolled').length;
        const conversionRate = leadsAssigned > 0 ? parseFloat(((leadsConverted / leadsAssigned) * 100).toFixed(1)) : 0;

        let totalCalls = 0;
        let totalEmails = 0;
        const responseTimes: number[] = [];
        const activities: any[] = [];

        for (const lead of leads) {
          // Lead creations and conversions inside the window
          if (lead.createdAt >= start && lead.createdAt <= end) {
            activities.push({
              type: 'lead_created',
              leadName: lead.fullName,
              date: lead.createdAt,
              note: `New lead added: ${lead.fullName}`,
            });
          }
          if (lead.lifecycleStage === 'Enrolled' && lead.updatedAt >= start && lead.updatedAt <= end) {
            activities.push({
              type: 'lead_converted',
              leadName: lead.fullName,
              date: lead.updatedAt,
              note: `Lead converted: ${lead.fullName}`,
            });
          }

          for (const fu of lead.followUps || []) {
            const fuDate = fu.date || fu.createdAt || new Date(0);
            if (fuDate >= start && fuDate <= end) {
              activities.push({
                type: classifyNote(fu.note || ''),
                leadName: lead.fullName,
                date: fuDate,
                note: fu.note || 'Follow-up with lead',
              });

              const note = (fu.note || '').toLowerCase();
              if (note.includes('call') || note.includes('phone')) totalCalls++;
              if (note.includes('email') || note.includes('mail')) totalEmails++;
            }
          }

          // Response time: lead created -> first follow-up (hours)
          const firstFU = lead.followUps?.[0];
          if (firstFU?.date && firstFU.date >= start && firstFU.date <= end) {
            const hours = (new Date(firstFU.date).getTime() - new Date(lead.createdAt).getTime()) / 36e5;
            if (hours >= 0) responseTimes.push(hours);
          }
        }

        activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const avgHours =
          responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1) : null;

        return {
          _id: uDoc._id,
          name: uDoc.name || `${uDoc.firstName || ''} ${uDoc.lastName || ''}`.trim() || 'Internal BDM',
          role: uDoc.role,
          leadsAssigned,
          leadsConverted,
          conversionRate,
          totalCalls,
          totalEmails,
          avgResponseTime: avgHours ? `${avgHours}h` : 'N/A',
          revenue: 0,
          activities: activities.slice(0, 50), // last 50 actions for the period
        };
      }),
    );

    const totalLeadsAssigned = performances.reduce((s, p) => s + p.leadsAssigned, 0);
    const convertedLeads = performances.reduce((s, p) => s + p.leadsConverted, 0);

    const summary = {
      totalBDMs: performances.length,
      totalLeadsAssigned,
      convertedLeads,
      overallConversionRate:
        totalLeadsAssigned > 0 ? parseFloat(((convertedLeads / totalLeadsAssigned) * 100).toFixed(1)) : 0,
      totalRevenue: 0,
      totalCalls: performances.reduce((s, p) => s + p.totalCalls, 0),
      totalEmails: performances.reduce((s, p) => s + p.totalEmails, 0),
      avgResponseTime: 'N/A', // placeholder, as before
      activeLeads: totalLeadsAssigned - convertedLeads,
    };

    return { performances, summary };
  },

  /** One BDM's tasks for a given day. */
  async getBdmTaskStatus(bdmId: unknown, date: string | undefined) {
    if (!bdmId) throw AppError.badRequest('BDM ID is required');

    const { start, end } = getDateRange('specific_date', date);
    return taskRepository.findForAssigneeInRange(bdmId, start, end);
  },
};
