import { leadRepository } from '../leads/lead.repository';

type ActivityType = 'lead_created' | 'conversion' | 'follow_up' | 'call' | 'email' | 'stage_changed';

function classifyNote(note: string): ActivityType {
  const n = note.toLowerCase();
  if (n.includes('call') || n.includes('phone') || n.includes('rang')) return 'call';
  if (n.includes('email') || n.includes('mail')) return 'email';
  return 'follow_up';
}

export interface ActivityQuery {
  date?: string;
  type?: string;
}

export const activityService = {
  /**
   * Builds the staff activity feed from leads: creations, conversions and follow-ups, newest
   * first (at most 200), plus today's counters.
   */
  async getFeed({ date, type }: ActivityQuery) {
    const leadFilter: Record<string, any> = {};
    if (date) {
      const d = new Date(date);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      leadFilter.updatedAt = { $gte: start, $lte: end };
    }

    const leads = await leadRepository.findForActivityFeed(leadFilter);

    const activities: any[] = [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const lead of leads) {
      const bdm = lead.assignedTo as any;
      const bdmName = bdm?.name || 'Unassigned';
      const bdmRole = bdm?.role || '-';

      // Lead created event
      activities.push({
        _id: `${lead._id}_created`,
        userName: bdmName,
        userRole: bdmRole,
        actionType: 'lead_created' as ActivityType,
        action: 'Lead Created',
        description: `New lead added: ${lead.fullName}`,
        leadName: lead.fullName,
        timestamp: lead.createdAt,
      });

      // Conversion event
      if (lead.lifecycleStage === 'Enrolled') {
        activities.push({
          _id: `${lead._id}_converted`,
          userName: bdmName,
          userRole: bdmRole,
          actionType: 'lead_converted' as ActivityType,
          action: 'Lead Converted',
          description: `Lead converted: ${lead.fullName}`,
          leadName: lead.fullName,
          timestamp: lead.updatedAt,
        });
      }

      // Follow-up events
      for (const fu of lead.followUps || []) {
        const fuType = classifyNote(fu.note || '');
        const actionLabel = fuType === 'call' ? 'Phone Call' : fuType === 'email' ? 'Email Sent' : 'Follow Up';
        activities.push({
          _id: `${lead._id}_fu_${fu.createdAt?.getTime?.() ?? Math.random()}`,
          userName: bdmName,
          userRole: bdmRole,
          actionType: fuType,
          action: actionLabel,
          description: fu.note ? `${actionLabel}: ${fu.note}` : `Follow-up scheduled for ${lead.fullName}`,
          leadName: lead.fullName,
          timestamp: fu.date || fu.createdAt || lead.updatedAt,
        });
      }
    }

    // Newest first
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const filtered = type && type !== 'all' ? activities.filter((a) => a.actionType === type) : activities;

    const todayActivities = filtered.filter((a) => new Date(a.timestamp) >= todayStart);
    const stats = {
      todayActivities: todayActivities.length,
      callsToday: todayActivities.filter((a) => a.actionType === 'call').length,
      emailsToday: todayActivities.filter((a) => a.actionType === 'email').length,
      conversionsToday: todayActivities.filter((a) => a.actionType === 'lead_converted').length,
    };

    return { activities: filtered.slice(0, 200), stats };
  },
};
