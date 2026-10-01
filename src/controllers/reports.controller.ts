import { Request, Response } from 'express';
import Lead from '../models/Lead';
import User from '../models/User';
import Task from '../models/Task';

function classifyNote(note: string): string {
  const n = note.toLowerCase();
  if (n.includes('call') || n.includes('phone') || n.includes('rang')) return 'call';
  if (n.includes('email') || n.includes('mail')) return 'email';
  if (n.includes('whatsapp') || n.includes('wa')) return 'whatsapp';
  return 'follow_up';
}

function getDateRange(range: string, startDate?: string, endDate?: string, month?: number, year?: number): { start: Date; end: Date } {
  const now = new Date();
  let end = new Date(now); end.setHours(23, 59, 59, 999);

  switch (range) {
    case 'today': {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'specific_date': {
      const start = startDate ? new Date(startDate) : new Date(now);
      start.setHours(0, 0, 0, 0);
      const e = new Date(start);
      e.setHours(23, 59, 59, 999);
      return { start, end: e };
    }
    case 'this_week': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'monthly': {
      const m = month !== undefined ? month : now.getMonth();
      const y = year !== undefined ? year : now.getFullYear();
      const start = new Date(y, m, 1);
      const e = new Date(y, m + 1, 0);
      e.setHours(23, 59, 59, 999);
      return { start, end: e };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      e.setHours(23, 59, 59, 999);
      return { start, end: e };
    }
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      return { start, end };
    }
    case 'custom': {
      return {
        start: startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1),
        end: endDate ? new Date(endDate) : end,
      };
    }
    default: { // this_month
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }
  }
}

export const getBDMReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { range = 'this_month', bdm, startDate, endDate, month, year } = req.query;
    const { start, end } = getDateRange(
      range as string,
      startDate as string,
      endDate as string,
      month ? parseInt(month as string) : undefined,
      year ? parseInt(year as string) : undefined
    );

    // Fetch BDMs
    const bdmFilter: any = {
      isActive: true,
      role: { $in: ['bdm'] },
    };
    if (bdm && bdm !== 'all') {
      bdmFilter._id = bdm;
    }

    const bdmUsers = await User.find(bdmFilter).select('_id name firstName lastName role');

    const performances = await Promise.all(bdmUsers.map(async (uDoc) => {
      const u = uDoc.toObject();
      const leads = await Lead.find({
        assignedTo: u._id,
        createdAt: { $gte: start, $lte: end },
      });

      const leadsAssigned = leads.length;
      const leadsConverted = leads.filter(l => l.lifecycleStage === 'Enrolled').length;
      const conversionRate = leadsAssigned > 0
        ? parseFloat(((leadsConverted / leadsAssigned) * 100).toFixed(1))
        : 0;

      let totalCalls = 0;
      let totalEmails = 0;
      let responseTimes: number[] = [];

      let activities: any[] = [];

      for (const lead of leads) {
        // Handle lead creations and conversions if within range
        if (lead.createdAt >= start && lead.createdAt <= end) {
          activities.push({
            type: 'lead_created',
            leadName: lead.fullName,
            date: lead.createdAt,
            note: `New lead added: ${lead.fullName}`
          });
        }
        if (lead.lifecycleStage === 'Enrolled' && lead.updatedAt >= start && lead.updatedAt <= end) {
          activities.push({
            type: 'lead_converted',
            leadName: lead.fullName,
            date: lead.updatedAt,
            note: `Lead converted: ${lead.fullName}`
          });
        }

        for (const fu of lead.followUps || []) {
          const fuDate = fu.date || fu.createdAt || new Date(0);
          if (fuDate >= start && fuDate <= end) {
            const fuType = classifyNote(fu.note || '');
            activities.push({
              type: fuType,
              leadName: lead.fullName,
              date: fuDate,
              note: fu.note || 'Follow-up with lead'
            });

            const note = (fu.note || '').toLowerCase();
            if (note.includes('call') || note.includes('phone')) totalCalls++;
            if (note.includes('email') || note.includes('mail')) totalEmails++;
          }
        }

        // Average response time: createdAt → first followUp date (hours)
        const firstFU = lead.followUps?.[0];
        if (firstFU?.date && firstFU.date >= start && firstFU.date <= end) {
          const hours = (new Date(firstFU.date).getTime() - new Date(lead.createdAt).getTime()) / 36e5;
          if (hours >= 0) responseTimes.push(hours);
        }
      }

      // Sort activities by date descending
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const avgHours = responseTimes.length > 0
        ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1)
        : null;
      const avgResponseTime = avgHours ? `${avgHours}h` : 'N/A';

      // Fetch name directly from the user document (e.g., 'Rahul Islam' from Compass)
      const name = uDoc.name || `${uDoc.firstName || ''} ${uDoc.lastName || ''}`.trim() || 'Internal BDM';
      
      return {
        _id: uDoc._id,
        name: name,
        role: uDoc.role,
        leadsAssigned,
        leadsConverted,
        conversionRate,
        totalCalls,
        totalEmails,
        avgResponseTime,
        revenue: 0,
        activities: activities.slice(0, 50), // Return last 50 actions for the period
      };
    }));

    const totalLeadsAssigned = performances.reduce((s, p) => s + p.leadsAssigned, 0);
    const convertedLeads = performances.reduce((s, p) => s + p.leadsConverted, 0);
    const overallConversionRate = totalLeadsAssigned > 0
      ? parseFloat(((convertedLeads / totalLeadsAssigned) * 100).toFixed(1))
      : 0;

    const summary = {
      totalBDMs: performances.length,
      totalLeadsAssigned,
      convertedLeads,
      overallConversionRate,
      totalRevenue: 0,
      totalCalls: performances.reduce((s, p) => s + p.totalCalls, 0),
      totalEmails: performances.reduce((s, p) => s + p.totalEmails, 0),
      avgResponseTime: 'N/A', // Placeholder for now
      activeLeads: totalLeadsAssigned - convertedLeads,
    };

    res.json({ performances, summary });
  } catch (error) {
    console.error('Error generating BDM report:', error);
    res.status(500).json({ message: 'Failed to generate report' });
  }
};

export const getBDMTaskStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bdmId, date } = req.query;
    if (!bdmId) {
      res.status(400).json({ message: 'BDM ID is required' });
      return;
    }

    const { start, end } = getDateRange('specific_date', date as string);

    const tasks = await Task.find({
      assignedTo: bdmId,
      status: { $in: ['pending', 'in-progress', 'completed'] },
      $or: [
        { dueDate: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } },
        { completedAt: { $gte: start, $lte: end } },
      ],
    })
      .populate('entityId')
      .populate('completedBy', 'name');

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching BDM task status:', error);
    res.status(500).json({ message: 'Failed to fetch task status' });
  }
};
