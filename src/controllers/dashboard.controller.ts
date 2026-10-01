import { Request, Response } from 'express';
import Lead from '../models/Lead';
import Task from '../models/Task';
import User from '../models/User';

// BDM Dashboard Stats - Global (all leads, same as admin)
export const getBDMStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // All 12 counts below are independent of each other — batched into one round-trip
    // instead of 12 sequential awaits.
    const [
      totalLeads, converted, inProgress,
      currentPeriodLeads, previousPeriodLeads,
      currentConverted, previousConverted,
      currentInProgress, previousInProgress,
      prevTotalLeads, prevConverted,
    ] = await Promise.all([
      Lead.countDocuments({}),
      Lead.countDocuments({ lifecycleStage: 'Enrolled' }),
      Lead.countDocuments({ lifecycleStage: { $in: ['New Inquiry', 'Contacted', 'Trial Class'] } }),
      Lead.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Lead.countDocuments({ createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      Lead.countDocuments({ lifecycleStage: 'Enrolled', updatedAt: { $gte: thirtyDaysAgo } }),
      Lead.countDocuments({ lifecycleStage: 'Enrolled', updatedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      Lead.countDocuments({ lifecycleStage: { $in: ['New Inquiry', 'Contacted', 'Trial Class'] }, updatedAt: { $gte: thirtyDaysAgo } }),
      Lead.countDocuments({ lifecycleStage: { $in: ['New Inquiry', 'Contacted', 'Trial Class'] }, updatedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      Lead.countDocuments({ createdAt: { $lt: thirtyDaysAgo } }),
      Lead.countDocuments({ lifecycleStage: 'Enrolled', createdAt: { $lt: thirtyDaysAgo } }),
    ]);

    // Calculate target percentage (converted / total * 100)
    const targetPercentage = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

    const leadsChange = previousPeriodLeads > 0
      ? Math.round(((currentPeriodLeads - previousPeriodLeads) / previousPeriodLeads) * 100)
      : currentPeriodLeads > 0 ? 100 : 0;

    const convertedChange = previousConverted > 0
      ? Math.round(((currentConverted - previousConverted) / previousConverted) * 100)
      : currentConverted > 0 ? 100 : 0;

    const inProgressChange = previousInProgress > 0
      ? Math.round(((currentInProgress - previousInProgress) / previousInProgress) * 100)
      : currentInProgress > 0 ? 100 : 0;

    const prevTargetPercentage = prevTotalLeads > 0 ? Math.round((prevConverted / prevTotalLeads) * 100) : 0;
    const targetChange = prevTargetPercentage > 0
      ? Math.round(((targetPercentage - prevTargetPercentage) / prevTargetPercentage) * 100)
      : targetPercentage > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        totalLeads: { value: totalLeads, change: leadsChange },
        converted: { value: converted, change: convertedChange },
        inProgress: { value: inProgress, change: inProgressChange },
        target: { value: `${targetPercentage}%`, change: targetChange }
      }
    });
  } catch (error) {
    console.error('Error fetching BDM stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
};

// BDM Recent Leads - Global (all leads)
export const getBDMRecentLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;

    const recentLeads = await Lead.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const leads = recentLeads.map((lead) => ({
      id: lead._id,
      name: lead.fullName,
      service: lead.serviceInterest || 'General Inquiry',
      phone: lead.phone || 'N/A',
      createdAt: lead.createdAt,
      stage: lead.lifecycleStage
    }));

    res.json({ success: true, data: leads });
  } catch (error) {
    console.error('Error fetching recent leads:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recent leads' });
  }
};

// BDM Upcoming Tasks - Global (all tasks)
export const getBDMUpcomingTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;

    const tasks = await Task.find({
      status: { $ne: 'completed' },
      dueDate: { $gte: new Date() }
    })
      .sort({ dueDate: 1 })
      .limit(limit)
      .populate('entityId')
      .lean();

    const upcomingTasks = tasks.map(task => ({
      id: task._id,
      title: task.title,
      dueDate: task.dueDate,
      priority: task.priority,
      entityType: task.entityType
    }));

    res.json({ success: true, data: upcomingTasks });
  } catch (error) {
    console.error('Error fetching upcoming tasks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch upcoming tasks' });
  }
};

// Lead Stage Distribution (global — all leads)
export const getLeadStageDistribution = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter = {};

    const stages = ['New Inquiry', 'Contacted', 'Trial Class', 'Enrolled', 'Lost'];
    const distribution = await Promise.all(
      stages.map(async (stage) => ({
        stage,
        count: await Lead.countDocuments({ ...filter, lifecycleStage: stage })
      }))
    );

    res.json({ success: true, data: distribution });
  } catch (error) {
    console.error('Error fetching lead stage distribution:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lead stage distribution' });
  }
};

// Lead Stage Trend (last 6 months — global)
export const getLeadStageTrend = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter = {};

    const now = new Date();
    const monthRanges = Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx;
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      return { date, nextMonth };
    });

    // 24 independent counts (4 stages x 6 months) batched into one round-trip instead of
    // 24 sequential awaits.
    const counts = await Promise.all(
      monthRanges.flatMap(({ date, nextMonth }) => [
        Lead.countDocuments({ ...filter, lifecycleStage: 'Enrolled', updatedAt: { $gte: date, $lt: nextMonth } }),
        Lead.countDocuments({ ...filter, lifecycleStage: 'Trial Class', createdAt: { $gte: date, $lt: nextMonth } }),
        Lead.countDocuments({ ...filter, lifecycleStage: 'New Inquiry', createdAt: { $gte: date, $lt: nextMonth } }),
        Lead.countDocuments({ ...filter, lifecycleStage: 'Contacted', createdAt: { $gte: date, $lt: nextMonth } }),
      ])
    );

    const months = monthRanges.map(({ date }, idx) => ({
      month: date.toLocaleString('default', { month: 'short' }),
      Enrolled: counts[idx * 4],
      'Trial Class': counts[idx * 4 + 1],
      'New Inquiry': counts[idx * 4 + 2],
      Contacted: counts[idx * 4 + 3],
    }));

    res.json({ success: true, data: months });
  } catch (error) {
    console.error('Error fetching lead stage trend:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lead stage trend' });
  }
};

// Lead Source Distribution (global — all leads)
export const getLeadSourceDistribution = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter = {};

    const sources = ['Education Team', 'Phone Call', 'Previous', 'Facebook', 'WhatsApp', 'Google', 'Walk-in', 'Event', 'Reference', 'Others', 'Website'];
    const total = await Lead.countDocuments(filter);

    const distribution = await Promise.all(
      sources.map(async (source) => {
        const count = await Lead.countDocuments({ ...filter, source });
        return {
          source,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0
        };
      })
    );

    res.json({ success: true, data: distribution });
  } catch (error) {
    console.error('Error fetching lead source distribution:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lead source distribution' });
  }
};

// Conversion Rate Trend (last 6 months — global)
export const getConversionRateTrend = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter = {};

    const now = new Date();
    const monthRanges = Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx;
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      return { date, nextMonth };
    });

    // 12 independent counts (2 x 6 months) batched into one round-trip instead of
    // 12 sequential awaits.
    const counts = await Promise.all(
      monthRanges.flatMap(({ date, nextMonth }) => [
        Lead.countDocuments({ ...filter, createdAt: { $gte: date, $lt: nextMonth } }),
        Lead.countDocuments({ ...filter, lifecycleStage: 'Enrolled', updatedAt: { $gte: date, $lt: nextMonth } }),
      ])
    );

    const months = monthRanges.map(({ date }, idx) => {
      const totalInMonth = counts[idx * 2];
      const convertedInMonth = counts[idx * 2 + 1];
      return {
        month: date.toLocaleString('default', { month: 'short' }),
        rate: totalInMonth > 0 ? Math.round((convertedInMonth / totalInMonth) * 100) : 0
      };
    });

    res.json({ success: true, data: months });
  } catch (error) {
    console.error('Error fetching conversion rate trend:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversion rate trend' });
  }
};

// Status Distribution (global — all leads)
export const getStatusDistribution = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter = {};

    // Using lifecycle stages as status
    const statuses = [
      { label: 'New Inquiry', stage: 'New Inquiry', color: '#3B82F6' },
      { label: 'Contacted', stage: 'Contacted', color: '#F59E0B' },
      { label: 'Trial Class', stage: 'Trial Class', color: '#22C55E' },
      { label: 'Enrolled', stage: 'Enrolled', color: '#06B6D4' },
      { label: 'Lost', stage: 'Lost', color: '#EF4444' },
    ];

    const distribution = await Promise.all(
      statuses.map(async (status) => ({
        label: status.label,
        count: await Lead.countDocuments({ ...filter, lifecycleStage: status.stage }),
        color: status.color
      }))
    );

    res.json({ success: true, data: distribution });
  } catch (error) {
    console.error('Error fetching status distribution:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch status distribution' });
  }
};

// ============ ADMIN SPECIFIC ENDPOINTS ============

// Admin Dashboard Stats
export const getAdminStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // All 14 counts below are independent of each other — batched into one round-trip
    // instead of 14 sequential awaits.
    const [
      activeBDMs, totalUsers, totalLeads, convertedLeads,
      currentLeads, previousLeads,
      currentUsers, previousUsers,
      currentBDMs, previousBDMs,
      prevTotalLeads, prevConverted,
    ] = await Promise.all([
      User.countDocuments({ role: { $in: ['bdm'] }, isActive: true }),
      User.countDocuments({ isActive: true }),
      Lead.countDocuments(),
      Lead.countDocuments({ lifecycleStage: 'Enrolled' }),
      Lead.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Lead.countDocuments({ createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      User.countDocuments({ isActive: true, createdAt: { $gte: thirtyDaysAgo } }),
      User.countDocuments({ isActive: true, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      User.countDocuments({ role: { $in: ['bdm'] }, isActive: true, createdAt: { $gte: thirtyDaysAgo } }),
      User.countDocuments({ role: { $in: ['bdm'] }, isActive: true, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      Lead.countDocuments({ createdAt: { $lt: thirtyDaysAgo } }),
      Lead.countDocuments({ lifecycleStage: 'Enrolled', createdAt: { $lt: thirtyDaysAgo } }),
    ]);

    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';

    const leadsChange = previousLeads > 0
      ? Math.round(((currentLeads - previousLeads) / previousLeads) * 100)
      : currentLeads > 0 ? 100 : 0;

    const usersChange = previousUsers > 0
      ? Math.round(((currentUsers - previousUsers) / previousUsers) * 100)
      : currentUsers > 0 ? 100 : 0;

    const bdmsChange = previousBDMs > 0
      ? Math.round(((currentBDMs - previousBDMs) / previousBDMs) * 100)
      : currentBDMs > 0 ? 100 : 0;

    const prevConversionRate = prevTotalLeads > 0 ? (prevConverted / prevTotalLeads) * 100 : 0;
    const currentConversionRate = parseFloat(conversionRate);
    const conversionChange = prevConversionRate > 0
      ? Math.round(((currentConversionRate - prevConversionRate) / prevConversionRate) * 100)
      : currentConversionRate > 0 ? 100 : 0;

    res.json({
      success: true,
      data: {
        activeBDMs: { value: activeBDMs, change: bdmsChange },
        totalUsers: { value: totalUsers, change: usersChange },
        totalLeads: { value: totalLeads, change: leadsChange },
        conversionRate: { value: `${conversionRate}%`, change: conversionChange }
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin stats' });
  }
};

// Admin Recent Activity
export const getRecentActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;

    // Get recent leads with their assigned BDMs
    const recentLeads = await Lead.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('assignedTo', 'name')
      .lean();

    const activities = recentLeads.map((lead) => {
      let action = 'Added new lead';
      let type: 'success' | 'info' | 'warning' = 'info';

      const leadName = lead.fullName || 'Unnamed lead';
      if (lead.lifecycleStage === 'Enrolled') {
        action = `Converted lead "${leadName}"`;
        type = 'success';
      } else if (lead.lifecycleStage === 'Lost') {
        action = `Marked lead as dead`;
        type = 'warning';
      } else {
        action = `Added new lead "${leadName}"`;
      }

      return {
        id: lead._id,
        user: (lead.assignedTo as any)?.name || 'Unassigned',
        action,
        type,
        timestamp: lead.updatedAt
      };
    });

    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recent activity' });
  }
};

// Admin Top Performers
export const getTopPerformers = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 4;

    // Get all BDMs
    const bdms = await User.find({
      role: { $in: ['bdm'] },
      isActive: true
    }).lean();

    // Calculate conversion rate for each BDM
    const performersData = await Promise.all(
      bdms.map(async (bdm) => {
        const totalLeads = await Lead.countDocuments({ assignedTo: bdm._id });
        const convertedLeads = await Lead.countDocuments({
          assignedTo: bdm._id,
          lifecycleStage: 'Enrolled'
        });

        return {
          id: bdm._id,
          name: bdm.name,
          totalLeads,
          convertedLeads,
          conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0'
        };
      })
    );

    // Sort by conversion rate and get top performers
    const topPerformers = performersData
      .sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate))
      .slice(0, limit)
      .map((performer, index) => ({
        rank: index + 1,
        ...performer
      }));

    res.json({ success: true, data: topPerformers });
  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch top performers' });
  }
};

// ============ BATCH ENDPOINTS (1 request instead of 8) ============

// BDM Batch — all BDM dashboard data in one call
export const getBDMDashboardAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    // --- Daily Stats (Today vs Yesterday) ---
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday); endOfToday.setHours(23, 59, 59, 999);
    const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = new Date(startOfToday); endOfYesterday.setMilliseconds(-1);

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      todaysLead, yesterdayLead,
      thisMonthConverted, lastMonthConverted,
      todaysInProcess, yesterdayInProcess,
      followupPending, overdueTaskCount
    ] = await Promise.all([
      Lead.countDocuments({ createdAt: { $gte: startOfToday } }),
      Lead.countDocuments({ createdAt: { $gte: startOfYesterday, $lt: startOfToday } }),
      Lead.countDocuments({ lifecycleStage: 'Enrolled', updatedAt: { $gte: startOfMonth } }),
      Lead.countDocuments({ lifecycleStage: 'Enrolled', updatedAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
      Lead.countDocuments({ lifecycleStage: { $in: ['New Inquiry', 'Contacted', 'Trial Class'] }, updatedAt: { $gte: startOfToday } }),
      Lead.countDocuments({ lifecycleStage: { $in: ['New Inquiry', 'Contacted', 'Trial Class'] }, updatedAt: { $gte: startOfYesterday, $lt: startOfToday } }),
      Task.countDocuments({ status: { $ne: 'completed' }, dueDate: { $gte: startOfToday, $lte: endOfToday } }),
      // overdue = tasks past their due date, still not completed
      Task.countDocuments({ status: { $ne: 'completed' }, dueDate: { $lt: startOfToday } }),
    ]);

    const chg = (cur: number, prev: number) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0;

    const stats = {
      // absolute delta so UI "↑ 3 vs yesterday" reads as a lead count, not a percentage
      todaysLead: { value: todaysLead, change: todaysLead - yesterdayLead },
      converted: { value: thisMonthConverted, change: chg(thisMonthConverted, lastMonthConverted) },
      inProcess: { value: todaysInProcess, change: chg(todaysInProcess, yesterdayInProcess) },
      // change carries the count of past-due tasks; UI renders "X overdue"
      followupPending: { value: followupPending, change: overdueTaskCount },
    };

    // --- Recent Leads ---
    const limit = parseInt(req.query.limit as string) || 5;
    const recentLeadsRaw = await Lead.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    const recentLeads = recentLeadsRaw.map(l => ({ id: l._id, name: l.fullName, service: l.serviceInterest || 'General Inquiry', phone: l.phone || 'N/A', createdAt: l.createdAt, stage: l.lifecycleStage }));

    // --- Upcoming Tasks (from start of today so overdue earlier-today tasks appear) ---
    const tasksRaw = await Task.find({ status: { $ne: 'completed' }, dueDate: { $gte: startOfToday } })
      .sort({ dueDate: 1 })
      .limit(5)
      .lean();

    // Populate lead info for tasks linked to leads
    const leadEntityIds = tasksRaw
      .filter(t => t.entityType === 'lead' && t.entityId)
      .map(t => t.entityId);

    const taskLeadMap = new Map<string, { fullName: string; serviceInterest: string; phone: string }>();
    if (leadEntityIds.length > 0) {
      const taskLeads = await Lead.find({ _id: { $in: leadEntityIds } }, 'fullName serviceInterest phone').lean();
      for (const l of taskLeads) {
        const services = Array.isArray(l.serviceInterest) ? l.serviceInterest.join(', ') : (l.serviceInterest || '');
        taskLeadMap.set(String(l._id), { fullName: l.fullName || '', serviceInterest: services as string, phone: l.phone || '' });
      }
    }

    const upcomingTasks = tasksRaw.map(t => {
      const leadInfo = t.entityType === 'lead' ? taskLeadMap.get(String(t.entityId)) : null;
      return {
        id: t._id,
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        entityType: t.entityType,
        ...(leadInfo && {
          leadId: String(t.entityId),
          leadName: leadInfo.fullName,
          serviceInterest: leadInfo.serviceInterest,
          leadPhone: leadInfo.phone,
        }),
      };
    });

    const stages = ['New Inquiry', 'Contacted', 'Trial Class', 'Enrolled', 'Lost'];
    // All supported source values in Lead model (including social channels)
    const sources = ['Education Team', 'Phone Call', 'Previous', 'Facebook', 'WhatsApp', 'Google', 'Walk-in', 'Event', 'Reference', 'Others', 'Website'];
    const sourceColors = ['#7C3AED', '#F59E0B', '#60A5FA', '#3B82F6', '#22C55E', '#EF4444', '#15803D', '#6B7280', '#A855F7', '#94A3B8', '#EC4899'];
    const courseLabels = [
      'IELTS Reg', 'PTE Reg', 'TOEFL Reg', 'GRE Reg', 'Duolingo Reg',
      'IELTS Premium', 'IELTS Crash', 'IELTS Intense', 'IELTS 1 Module', 'IELTS 1-on-1', 'IELTS Mock Tests',
      'PTE Premium', 'PTE Crash', 'PTE Intense', 'PTE 1 Module', 'PTE 1-on-1', 'PTE Mock Tests',
      'TOEFL Premium', 'TOEFL Crash', 'TOEFL 1 Module', 'TOEFL 1-on-1', 'TOEFL Mock Tests',
      'GRE Premium', 'GRE Quant', 'GRE Verbal', 'GRE 1-on-1', 'GRE Mock Tests', 'GRE Portal',
      'Basic English', 'Spoken', 'Service Charge', 'SSC English', 'Study Abroad', 'Others',
    ];
    const courseColors = [
      '#64748B', '#64748B', '#64748B', '#64748B', '#64748B',
      '#EF4444', '#F87171', '#DC2626', '#FCA5A5', '#FF6B6B', '#B91C1C',
      '#A855F7', '#C084FC', '#9333EA', '#D8B4FE', '#7E22CE', '#6B21A8',
      '#3B82F6', '#60A5FA', '#2563EB', '#93C5FD', '#1D4ED8',
      '#22C55E', '#4ADE80', '#16A34A', '#86EFAC', '#15803D', '#166534',
      '#F97316', '#FB923C', '#94A3B8', '#FDBA74', '#0D9488', '#78716C',
    ];

    const monthKeys = Array.from({ length: 6 }, (_, idx) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: date.toLocaleString('default', { month: 'short' }),
      };
    });

    // Run heavy monthly datasets as grouped aggregations.
    const [monthlyStageServiceAgg, monthlySourceAgg, monthlyCourseAgg, createdStageByMonthAgg, updatedStageByMonthAgg] = await Promise.all([
      Lead.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $unwind: { path: '$serviceInterest', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            stage: '$lifecycleStage',
            normalizedService: {
              $toUpper: {
                $trim: {
                  input: {
                    $cond: {
                      if: { $eq: [{ $type: "$serviceInterest" }, "string"] },
                      then: "$serviceInterest",
                      else: ""
                    }
                  }
                },
              },
            },
          },
        },
        { $group: { _id: { stage: '$stage', service: '$normalizedService' }, count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { serviceInterest: { $in: courseLabels } } },
        { $unwind: '$serviceInterest' },
        { $match: { serviceInterest: { $in: courseLabels } } },
        { $group: { _id: '$serviceInterest', count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        { $project: { stage: '$lifecycleStage', monthKey: { $dateToString: { format: '%Y-%m', date: '$createdAt' } } } },
        { $group: { _id: { monthKey: '$monthKey', stage: '$stage' }, count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { updatedAt: { $gte: sixMonthsAgo }, lifecycleStage: { $in: ['Enrolled', 'Lost'] } } },
        { $project: { stage: '$lifecycleStage', monthKey: { $dateToString: { format: '%Y-%m', date: '$updatedAt' } } } },
        { $group: { _id: { monthKey: '$monthKey', stage: '$stage' }, count: { $sum: 1 } } },
      ]),
    ]);

    const monthStageCreatedMap = new Map<string, number>();
    for (const row of createdStageByMonthAgg) {
      monthStageCreatedMap.set(`${row._id.monthKey}|${row._id.stage}`, row.count);
    }

    const monthStageUpdatedMap = new Map<string, number>();
    for (const row of updatedStageByMonthAgg) {
      monthStageUpdatedMap.set(`${row._id.monthKey}|${row._id.stage}`, row.count);
    }

    const stageDistMap = new Map<string, { count: number; ieltsCount: number; pteCount: number }>();
    for (const stage of stages) {
      stageDistMap.set(stage, { count: 0, ieltsCount: 0, pteCount: 0 });
    }
    for (const row of monthlyStageServiceAgg) {
      const stage = row?._id?.stage as string | undefined;
      if (!stage || !stageDistMap.has(stage)) continue;
      const current = stageDistMap.get(stage)!;
      const service = row?._id?.service as string | undefined;
      current.count += row.count;
      if (service === 'IELTS') current.ieltsCount += row.count;
      if (service === 'PTE') current.pteCount += row.count;
    }
    const stageDistribution = stages.map((stage) => ({ stage, ...stageDistMap.get(stage)! }));

    const sourceCountMap = new Map<string, number>();
    let totalLeadsMonth = 0;
    for (const row of monthlySourceAgg) {
      const source = row?._id as string | undefined;
      if (!source) continue;
      sourceCountMap.set(source, row.count);
      totalLeadsMonth += row.count;
    }
    const sourceDistribution = sources.map((source, i) => {
      const count = sourceCountMap.get(source) || 0;
      return {
        source,
        count,
        percentage: totalLeadsMonth > 0 ? Math.round((count / totalLeadsMonth) * 100) : 0,
        color: sourceColors[i],
      };
    });

    const courseCountMap = new Map<string, number>();
    for (const row of monthlyCourseAgg) {
      const label = row?._id as string | undefined;
      if (!label) continue;
      courseCountMap.set(label, row.count);
    }
    const coursePerformance = courseLabels.map((label, i) => ({
      label,
      count: courseCountMap.get(label) || 0,
      color: courseColors[i],
    }));

    const stageTrend = monthKeys.map(({ key, label }) => ({
      month: label,
      Enrolled: monthStageUpdatedMap.get(`${key}|Enrolled`) || 0,
      'Trial Class': monthStageCreatedMap.get(`${key}|Trial Class`) || 0,
      'New Inquiry': monthStageCreatedMap.get(`${key}|New Inquiry`) || 0,
      Contacted: monthStageCreatedMap.get(`${key}|Contacted`) || 0,
      Lost: monthStageUpdatedMap.get(`${key}|Lost`) || 0,
    }));

    const conversionTrend = monthKeys.map(({ key, label }) => {
      const total = stages.reduce((sum, stage) => sum + (monthStageCreatedMap.get(`${key}|${stage}`) || 0), 0);
      const converted = monthStageUpdatedMap.get(`${key}|Enrolled`) || 0;
      return {
        month: label,
        rate: total > 0 ? Math.round((converted / total) * 100) : 0,
      };
    });

    res.json({
      success: true,
      version: '1.3.1-course-alltime',
      data: { stats, recentLeads, upcomingTasks, stageDistribution, stageTrend, sourceDistribution, conversionTrend, coursePerformance }
    });
  } catch (error) {
    console.error('Error fetching BDM dashboard:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch BDM dashboard data' });
  }
};

// Admin Batch — all admin dashboard data in one call
export const getAdminDashboardAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday); endOfToday.setHours(23, 59, 59, 999);
    const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = new Date(startOfToday); endOfYesterday.setMilliseconds(-1);

    const limit = parseInt(req.query.limit as string) || 5;
    const monthRanges = Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx;
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      return { date, nextMonth };
    });

    // The 9 sections below are independent of each other (each reads distinct data and
    // populates a different key of the response) — running them concurrently instead of
    // one after another cuts total wall-clock time roughly to the slowest single section.
    const [
      stats,
      recentActivity,
      topPerformers,
      stageDistribution,
      stageTrend,
      sourceDistribution,
      conversionTrend,
      coursePerformance,
      statusDistribution,
    ] = await Promise.all([
      // --- Admin Stats ---
      (async () => {
        const [activeBDMs, totalUsers, totalLeads, convertedLeads,
          currentLeads, previousLeads, currentUsers, previousUsers,
          currentBDMs, previousBDMs, prevTotalLeads, prevConverted,
          todaysLead, yesterdayLead, todaysConverted, yesterdayConverted,
          followupPending, yesterdayFollowupPending] = await Promise.all([
          User.countDocuments({ role: { $in: ['bdm'] }, isActive: true }),
          User.countDocuments({ isActive: true }),
          Lead.countDocuments(),
          Lead.countDocuments({ lifecycleStage: 'Enrolled' }),
          Lead.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
          Lead.countDocuments({ createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
          User.countDocuments({ isActive: true, createdAt: { $gte: thirtyDaysAgo } }),
          User.countDocuments({ isActive: true, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
          User.countDocuments({ role: { $in: ['bdm'] }, isActive: true, createdAt: { $gte: thirtyDaysAgo } }),
          User.countDocuments({ role: { $in: ['bdm'] }, isActive: true, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
          Lead.countDocuments({ createdAt: { $lt: thirtyDaysAgo } }),
          Lead.countDocuments({ lifecycleStage: 'Enrolled', createdAt: { $lt: thirtyDaysAgo } }),
          Lead.countDocuments({ createdAt: { $gte: startOfToday } }),
          Lead.countDocuments({ createdAt: { $gte: startOfYesterday, $lt: startOfToday } }),
          Lead.countDocuments({ lifecycleStage: 'Enrolled', updatedAt: { $gte: startOfToday } }),
          Lead.countDocuments({ lifecycleStage: 'Enrolled', updatedAt: { $gte: startOfYesterday, $lt: startOfToday } }),
          Task.countDocuments({ status: { $ne: 'completed' }, dueDate: { $gte: startOfToday, $lte: endOfToday } }),
          Task.countDocuments({ status: { $ne: 'completed' }, dueDate: { $gte: startOfYesterday, $lt: startOfToday } })
        ]);
        const convRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';
        const prevConvRate = prevTotalLeads > 0 ? (prevConverted / prevTotalLeads) * 100 : 0;
        const chg = (cur: number, prev: number) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0;
        return {
          activeBDMs: { value: activeBDMs, change: chg(currentBDMs, previousBDMs) },
          totalUsers: { value: totalUsers, change: chg(currentUsers, previousUsers) },
          totalLeads: { value: totalLeads, change: chg(currentLeads, previousLeads) },
          conversionRate: { value: `${convRate}%`, change: prevConvRate > 0 ? Math.round(((parseFloat(convRate) - prevConvRate) / prevConvRate) * 100) : parseFloat(convRate) > 0 ? 100 : 0 },
          todaysLead: { value: todaysLead, change: chg(todaysLead, yesterdayLead) },
          todaysConverted: { value: todaysConverted, change: chg(todaysConverted, yesterdayConverted) },
          followupPending: { value: followupPending, change: chg(followupPending, yesterdayFollowupPending) }
        };
      })(),

      // --- Recent Activity ---
      (async () => {
        const recentLeadsRaw = await Lead.find().sort({ updatedAt: -1 }).limit(limit).populate('assignedTo', 'name').lean();
        return recentLeadsRaw.map(lead => {
          const leadName = lead.fullName || 'Unnamed lead';
          let action = `Added new lead "${leadName}"`;
          let type: 'success' | 'info' | 'warning' = 'info';
          if (lead.lifecycleStage === 'Enrolled') { action = `Converted lead "${leadName}"`; type = 'success'; }
          else if (lead.lifecycleStage === 'Lost') { action = `Marked lead as dead`; type = 'warning'; }
          return { id: lead._id, user: (lead.assignedTo as any)?.name || 'Unassigned', action, type, timestamp: lead.updatedAt };
        });
      })(),

      // --- Top Performers ---
      (async () => {
        const bdms = await User.find({ role: { $in: ['bdm'] }, isActive: true }).lean();
        const performersRaw = await Promise.all(bdms.map(async bdm => {
          const [bdmTotal, bdmConverted] = await Promise.all([Lead.countDocuments({ assignedTo: bdm._id }), Lead.countDocuments({ assignedTo: bdm._id, lifecycleStage: 'Enrolled' })]);
          return { id: bdm._id, name: bdm.name, totalLeads: bdmTotal, convertedLeads: bdmConverted, conversionRate: bdmTotal > 0 ? ((bdmConverted / bdmTotal) * 100).toFixed(1) : '0' };
        }));
        return performersRaw.sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate)).slice(0, 4).map((p, i) => ({ rank: i + 1, ...p }));
      })(),

      // --- Stage Distribution (This Month) ---
      (async () => {
        const stages = ['New Inquiry', 'Contacted', 'Trial Class', 'Enrolled', 'Lost'];
        const stageCounts = await Promise.all(stages.map(s => Lead.countDocuments({ lifecycleStage: s, createdAt: { $gte: startOfMonth } })));
        return stages.map((stage, i) => ({ stage, count: stageCounts[i] }));
      })(),

      // --- Stage Trend ---
      (async () => {
        // 24 independent counts (4 stages x 6 months) batched into one round-trip instead of
        // 6 sequential round-trips.
        const counts = await Promise.all(
          monthRanges.flatMap(({ date, nextMonth }) => [
            Lead.countDocuments({ lifecycleStage: 'Enrolled', updatedAt: { $gte: date, $lt: nextMonth } }),
            Lead.countDocuments({ lifecycleStage: 'Trial Class', createdAt: { $gte: date, $lt: nextMonth } }),
            Lead.countDocuments({ lifecycleStage: 'New Inquiry', createdAt: { $gte: date, $lt: nextMonth } }),
            Lead.countDocuments({ lifecycleStage: 'Contacted', createdAt: { $gte: date, $lt: nextMonth } }),
          ])
        );
        return monthRanges.map(({ date }, idx) => ({
          month: date.toLocaleString('default', { month: 'short' }),
          Enrolled: counts[idx * 4],
          'Trial Class': counts[idx * 4 + 1],
          'New Inquiry': counts[idx * 4 + 2],
          Contacted: counts[idx * 4 + 3],
        }));
      })(),

      // --- Source Distribution (This Month) ---
      (async () => {
        const sources = ['Education Team', 'Phone Call', 'Previous', 'Facebook', 'WhatsApp', 'Google', 'Walk-in', 'Event', 'Reference', 'Others', 'Website'];
        const [totalLeadsMonth, sourceCounts] = await Promise.all([
          Lead.countDocuments({ createdAt: { $gte: startOfMonth } }),
          Promise.all(sources.map(s => Lead.countDocuments({ source: s, createdAt: { $gte: startOfMonth } }))),
        ]);
        return sources.map((source, i) => ({ source, count: sourceCounts[i], percentage: totalLeadsMonth > 0 ? Math.round((sourceCounts[i] / totalLeadsMonth) * 100) : 0 }));
      })(),

      // --- Conversion Rate Trend ---
      (async () => {
        // 12 independent counts (2 x 6 months) batched into one round-trip instead of
        // 6 sequential round-trips.
        const counts = await Promise.all(
          monthRanges.flatMap(({ date, nextMonth }) => [
            Lead.countDocuments({ createdAt: { $gte: date, $lt: nextMonth } }),
            Lead.countDocuments({ lifecycleStage: 'Enrolled', updatedAt: { $gte: date, $lt: nextMonth } }),
          ])
        );
        return monthRanges.map(({ date }, idx) => {
          const total = counts[idx * 2];
          const conv = counts[idx * 2 + 1];
          return { month: date.toLocaleString('default', { month: 'short' }), rate: total > 0 ? Math.round((conv / total) * 100) : 0 };
        });
      })(),

      // --- Course Performance (This Month) ---
      (async () => {
        const courseLabels = [
          'IELTS Reg', 'PTE Reg', 'TOEFL Reg', 'GRE Reg', 'Duolingo Reg',
          'IELTS Premium', 'IELTS Crash', 'IELTS Intense', 'IELTS 1 Module', 'IELTS 1-on-1', 'IELTS Mock Tests',
          'PTE Premium', 'PTE Crash', 'PTE Intense', 'PTE 1 Module', 'PTE 1-on-1', 'PTE Mock Tests',
          'TOEFL Premium', 'TOEFL Crash', 'TOEFL 1 Module', 'TOEFL 1-on-1', 'TOEFL Mock Tests',
          'GRE Premium', 'GRE Quant', 'GRE Verbal', 'GRE 1-on-1', 'GRE Mock Tests', 'GRE Portal',
          'Basic English', 'Spoken', 'Service Charge', 'SSC English', 'Study Abroad', 'Others',
        ];
        const courseColors = [
          '#64748B', '#64748B', '#64748B', '#64748B', '#64748B',
          '#EF4444', '#F87171', '#DC2626', '#FCA5A5', '#FF6B6B', '#B91C1C',
          '#A855F7', '#C084FC', '#9333EA', '#D8B4FE', '#7E22CE', '#6B21A8',
          '#3B82F6', '#60A5FA', '#2563EB', '#93C5FD', '#1D4ED8',
          '#22C55E', '#4ADE80', '#16A34A', '#86EFAC', '#15803D', '#166534',
          '#F97316', '#FB923C', '#94A3B8', '#FDBA74', '#0D9488', '#78716C',
        ];
        const courseAgg = await Lead.aggregate([
          { $match: { createdAt: { $gte: startOfMonth }, serviceInterest: { $in: courseLabels } } },
          { $unwind: '$serviceInterest' },
          { $match: { serviceInterest: { $in: courseLabels } } },
          { $group: { _id: '$serviceInterest', count: { $sum: 1 } } },
        ]);
        const courseMap = new Map<string, number>();
        for (const row of courseAgg) {
          const label = row?._id as string | undefined;
          if (!label) continue;
          courseMap.set(label, row.count);
        }
        return courseLabels.map((label, i) => ({ label, count: courseMap.get(label) || 0, color: courseColors[i] }));
      })(),

      // --- Status Distribution ---
      (async () => {
        const statuses = [
          { label: 'New Inquiry', stage: 'New Inquiry', color: '#3B82F6' },
          { label: 'Contacted', stage: 'Contacted', color: '#F59E0B' },
          { label: 'Trial Class', stage: 'Trial Class', color: '#22C55E' },
          { label: 'Enrolled', stage: 'Enrolled', color: '#06B6D4' },
          { label: 'Lost', stage: 'Lost', color: '#EF4444' },
        ];
        const statusCounts = await Promise.all(statuses.map(s => Lead.countDocuments({ lifecycleStage: s.stage })));
        return statuses.map((s, i) => ({ label: s.label, count: statusCounts[i], color: s.color }));
      })(),
    ]);

    res.json({
      success: true,
      data: { stats, recentActivity, topPerformers, stageDistribution, stageTrend, sourceDistribution, conversionTrend, statusDistribution, coursePerformance }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin dashboard data' });
  }
};
