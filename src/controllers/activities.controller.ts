import { Request, Response } from 'express';
import Lead from '../models/Lead';

type ActivityType = 'lead_created' | 'conversion' | 'follow_up' | 'call' | 'email' | 'stage_changed';

function classifyNote(note: string): ActivityType {
  const n = note.toLowerCase();
  if (n.includes('call') || n.includes('phone') || n.includes('rang')) return 'call';
  if (n.includes('email') || n.includes('mail')) return 'email';
  return 'follow_up';
}

export const getActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, type } = req.query;

    // Build lead query
    const leadFilter: any = {};
    if (date) {
      const d = new Date(date as string);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      leadFilter.updatedAt = { $gte: start, $lte: end };
    }

    const leads = await Lead.find(leadFilter)
      .populate('assignedTo', 'name role')
      .sort({ updatedAt: -1 })
      .limit(500);

    const activities: any[] = [];
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

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
          description: fu.note
            ? `${actionLabel}: ${fu.note}`
            : `Follow-up scheduled for ${lead.fullName}`,
          leadName: lead.fullName,
          timestamp: fu.date || fu.createdAt || lead.updatedAt,
        });
      }
    }

    // Sort descending by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter by type if requested
    const filtered = type && type !== 'all'
      ? activities.filter(a => a.actionType === type)
      : activities;

    // Compute today's stats
    const todayActivities = filtered.filter(a => new Date(a.timestamp) >= todayStart);
    const stats = {
      todayActivities: todayActivities.length,
      callsToday: todayActivities.filter(a => a.actionType === 'call').length,
      emailsToday: todayActivities.filter(a => a.actionType === 'email').length,
      conversionsToday: todayActivities.filter(a => a.actionType === 'lead_converted').length,
    };

    res.json({ activities: filtered.slice(0, 200), stats });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
};
