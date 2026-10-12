import { LEAD_STAGES } from '../../shared/constants/leadStages';
import { conversionRate } from '../../shared/utils/conversionRate';
import { dashboardRepository as repo } from './dashboard.repository';
import {
  COURSE_COLORS,
  COURSE_LABELS,
  IN_PROGRESS_STAGES,
  SOURCE_COLORS,
  SOURCES,
  STATUS_COLORS,
} from './dashboard.constants';

// Dashboard numbers. Every figure here is computed exactly as the original controller did; the
// calendar boundaries use the server's local time zone (see the technical-debt note on time zones).

const stages = [...LEAD_STAGES];

/** Percentage change; 100 when growing from nothing, 0 when both are nothing. */
const change = (cur: number, prev: number): number =>
  prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0;

const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const startOfDay = (d = new Date()): Date => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
};

/** The last six calendar months, oldest first. */
const lastSixMonths = (now = new Date()) =>
  Array.from({ length: 6 }, (_, idx) => {
    const i = 5 - idx;
    return {
      date: new Date(now.getFullYear(), now.getMonth() - i, 1),
      nextMonth: new Date(now.getFullYear(), now.getMonth() - i + 1, 1),
    };
  });

const monthLabel = (date: Date): string => date.toLocaleString('default', { month: 'short' });

const toRecentLead = (l: any) => ({
  id: l._id,
  name: l.fullName,
  service: l.serviceInterest || 'General Inquiry',
  phone: l.phone || 'N/A',
  createdAt: l.createdAt,
  stage: l.lifecycleStage,
});

const toActivityItem = (lead: any) => {
  const leadName = lead.fullName || 'Unnamed lead';
  let action = `Added new lead "${leadName}"`;
  let type: 'success' | 'info' | 'warning' = 'info';

  if (lead.lifecycleStage === 'Enrolled') {
    action = `Converted lead "${leadName}"`;
    type = 'success';
  } else if (lead.lifecycleStage === 'Lost') {
    action = 'Marked lead as dead';
    type = 'warning';
  }

  return { id: lead._id, user: (lead.assignedTo as any)?.name || 'Unassigned', action, type, timestamp: lead.updatedAt };
};

const buildTopPerformers = async (limit: number) => {
  const bdms = await repo.findActiveBdms();

  const counts = await repo.aggregateLeadCountsByAssignee(bdms.map((bdm) => bdm._id));
  const countsByBdmId = new Map(
    counts.map((row) => [String(row._id), { totalLeads: row.totalLeads as number, convertedLeads: row.convertedLeads as number }]),
  );

  const performersData = bdms.map((bdm) => {
    const { totalLeads, convertedLeads } = countsByBdmId.get(String(bdm._id)) || { totalLeads: 0, convertedLeads: 0 };
    return {
      id: bdm._id,
      name: bdm.name,
      totalLeads,
      convertedLeads,
      conversionRate: conversionRate(convertedLeads, totalLeads),
    };
  });

  return performersData
    .sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate))
    .slice(0, limit)
    .map((performer, index) => ({ rank: index + 1, ...performer }));
};

/** Six months of per-stage lead counts (Enrolled by update date, the rest by creation date). */
const buildStageTrend = async () => {
  const monthRanges = lastSixMonths();

  // 24 independent counts (4 stages x 6 months) in one round-trip.
  const counts = await Promise.all(
    monthRanges.flatMap(({ date, nextMonth }) => [
      repo.countLeads({ lifecycleStage: 'Enrolled', updatedAt: { $gte: date, $lt: nextMonth } }),
      repo.countLeads({ lifecycleStage: 'Trial Class', createdAt: { $gte: date, $lt: nextMonth } }),
      repo.countLeads({ lifecycleStage: 'New Inquiry', createdAt: { $gte: date, $lt: nextMonth } }),
      repo.countLeads({ lifecycleStage: 'Contacted', createdAt: { $gte: date, $lt: nextMonth } }),
    ]),
  );

  return monthRanges.map(({ date }, idx) => ({
    month: monthLabel(date),
    Enrolled: counts[idx * 4],
    'Trial Class': counts[idx * 4 + 1],
    'New Inquiry': counts[idx * 4 + 2],
    Contacted: counts[idx * 4 + 3],
  }));
};

const buildConversionRateTrend = async () => {
  const monthRanges = lastSixMonths();

  // 12 independent counts (2 x 6 months) in one round-trip.
  const counts = await Promise.all(
    monthRanges.flatMap(({ date, nextMonth }) => [
      repo.countLeads({ createdAt: { $gte: date, $lt: nextMonth } }),
      repo.countLeads({ lifecycleStage: 'Enrolled', updatedAt: { $gte: date, $lt: nextMonth } }),
    ]),
  );

  return monthRanges.map(({ date }, idx) => {
    const total = counts[idx * 2];
    const converted = counts[idx * 2 + 1];
    return { month: monthLabel(date), rate: total > 0 ? Math.round((converted / total) * 100) : 0 };
  });
};

const buildStatusDistribution = async () => {
  const counts = await Promise.all(STATUS_COLORS.map((s) => repo.countLeads({ lifecycleStage: s.stage })));
  return STATUS_COLORS.map((s, i) => ({ label: s.label, count: counts[i], color: s.color }));
};

export const dashboardService = {
  // ============ BDM ENDPOINTS (global: all leads, same as admin) ============

  async getBdmStats() {
    const thirtyDaysAgo = daysAgo(30);
    const sixtyDaysAgo = daysAgo(60);

    const [
      totalLeads, converted, inProgress,
      currentPeriodLeads, previousPeriodLeads,
      currentConverted, previousConverted,
      currentInProgress, previousInProgress,
      prevTotalLeads, prevConverted,
    ] = await Promise.all([
      repo.countLeads({}),
      repo.countLeads({ lifecycleStage: 'Enrolled' }),
      repo.countLeads({ lifecycleStage: { $in: IN_PROGRESS_STAGES } }),
      repo.countLeads({ createdAt: { $gte: thirtyDaysAgo } }),
      repo.countLeads({ createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      repo.countLeads({ lifecycleStage: 'Enrolled', updatedAt: { $gte: thirtyDaysAgo } }),
      repo.countLeads({ lifecycleStage: 'Enrolled', updatedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      repo.countLeads({ lifecycleStage: { $in: IN_PROGRESS_STAGES }, updatedAt: { $gte: thirtyDaysAgo } }),
      repo.countLeads({ lifecycleStage: { $in: IN_PROGRESS_STAGES }, updatedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      repo.countLeads({ createdAt: { $lt: thirtyDaysAgo } }),
      repo.countLeads({ lifecycleStage: 'Enrolled', createdAt: { $lt: thirtyDaysAgo } }),
    ]);

    // Target = converted / total * 100
    const targetPercentage = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;
    const prevTargetPercentage = prevTotalLeads > 0 ? Math.round((prevConverted / prevTotalLeads) * 100) : 0;

    return {
      totalLeads: { value: totalLeads, change: change(currentPeriodLeads, previousPeriodLeads) },
      converted: { value: converted, change: change(currentConverted, previousConverted) },
      inProgress: { value: inProgress, change: change(currentInProgress, previousInProgress) },
      target: { value: `${targetPercentage}%`, change: change(targetPercentage, prevTargetPercentage) },
    };
  },

  async getBdmRecentLeads(limit: number) {
    return (await repo.findRecentLeads(limit)).map(toRecentLead);
  },

  async getBdmUpcomingTasks(limit: number) {
    const tasks = await repo.findUpcomingTasks(new Date(), limit, true);
    return tasks.map((task: any) => ({
      id: task._id,
      title: task.title,
      dueDate: task.dueDate,
      priority: task.priority,
      entityType: task.entityType,
    }));
  },

  async getLeadStageDistribution() {
    return Promise.all(stages.map(async (stage) => ({ stage, count: await repo.countLeads({ lifecycleStage: stage }) })));
  },

  getLeadStageTrend: buildStageTrend,

  async getLeadSourceDistribution() {
    const total = await repo.countLeads({});

    return Promise.all(
      SOURCES.map(async (source) => {
        const count = await repo.countLeads({ source });
        return { source, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 };
      }),
    );
  },

  getConversionRateTrend: buildConversionRateTrend,

  getStatusDistribution: buildStatusDistribution,

  // ============ ADMIN ENDPOINTS ============

  async getAdminStats() {
    const thirtyDaysAgo = daysAgo(30);
    const sixtyDaysAgo = daysAgo(60);

    const [
      activeBDMs, totalUsers, totalLeads, convertedLeads,
      currentLeads, previousLeads,
      currentUsers, previousUsers,
      currentBDMs, previousBDMs,
      prevTotalLeads, prevConverted,
    ] = await Promise.all([
      repo.countUsers({ role: { $in: ['bdm'] }, isActive: true }),
      repo.countUsers({ isActive: true }),
      repo.countLeads(),
      repo.countLeads({ lifecycleStage: 'Enrolled' }),
      repo.countLeads({ createdAt: { $gte: thirtyDaysAgo } }),
      repo.countLeads({ createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      repo.countUsers({ isActive: true, createdAt: { $gte: thirtyDaysAgo } }),
      repo.countUsers({ isActive: true, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      repo.countUsers({ role: { $in: ['bdm'] }, isActive: true, createdAt: { $gte: thirtyDaysAgo } }),
      repo.countUsers({ role: { $in: ['bdm'] }, isActive: true, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      repo.countLeads({ createdAt: { $lt: thirtyDaysAgo } }),
      repo.countLeads({ lifecycleStage: 'Enrolled', createdAt: { $lt: thirtyDaysAgo } }),
    ]);

    const conversionRateStr = conversionRate(convertedLeads, totalLeads);
    const prevConversionRate = prevTotalLeads > 0 ? (prevConverted / prevTotalLeads) * 100 : 0;
    const currentConversionRate = parseFloat(conversionRateStr);
    const conversionChange =
      prevConversionRate > 0
        ? Math.round(((currentConversionRate - prevConversionRate) / prevConversionRate) * 100)
        : currentConversionRate > 0 ? 100 : 0;

    return {
      activeBDMs: { value: activeBDMs, change: change(currentBDMs, previousBDMs) },
      totalUsers: { value: totalUsers, change: change(currentUsers, previousUsers) },
      totalLeads: { value: totalLeads, change: change(currentLeads, previousLeads) },
      conversionRate: { value: `${conversionRateStr}%`, change: conversionChange },
    };
  },

  async getRecentActivity(limit: number) {
    return (await repo.findRecentlyUpdatedLeads(limit)).map(toActivityItem);
  },

  getTopPerformers: buildTopPerformers,

  // ============ BATCH ENDPOINTS (one request instead of eight) ============

  async getBdmDashboardAll(limit: number) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Daily stats: today vs yesterday
    const startOfToday = startOfDay();
    const endOfToday = new Date(startOfToday);
    endOfToday.setHours(23, 59, 59, 999);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      todaysLead, yesterdayLead,
      thisMonthConverted, lastMonthConverted,
      todaysInProcess, yesterdayInProcess,
      followupPending, overdueTaskCount,
    ] = await Promise.all([
      repo.countLeads({ createdAt: { $gte: startOfToday } }),
      repo.countLeads({ createdAt: { $gte: startOfYesterday, $lt: startOfToday } }),
      repo.countLeads({ lifecycleStage: 'Enrolled', updatedAt: { $gte: startOfMonth } }),
      repo.countLeads({ lifecycleStage: 'Enrolled', updatedAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
      repo.countLeads({ lifecycleStage: { $in: IN_PROGRESS_STAGES }, updatedAt: { $gte: startOfToday } }),
      repo.countLeads({ lifecycleStage: { $in: IN_PROGRESS_STAGES }, updatedAt: { $gte: startOfYesterday, $lt: startOfToday } }),
      repo.countTasks({ status: { $ne: 'completed' }, dueDate: { $gte: startOfToday, $lte: endOfToday } }),
      // overdue = tasks past their due date, still not completed
      repo.countTasks({ status: { $ne: 'completed' }, dueDate: { $lt: startOfToday } }),
    ]);

    const stats = {
      // absolute delta so the UI "up 3 vs yesterday" reads as a lead count, not a percentage
      todaysLead: { value: todaysLead, change: todaysLead - yesterdayLead },
      converted: { value: thisMonthConverted, change: change(thisMonthConverted, lastMonthConverted) },
      inProcess: { value: todaysInProcess, change: change(todaysInProcess, yesterdayInProcess) },
      // change carries the count of past-due tasks; the UI renders "X overdue"
      followupPending: { value: followupPending, change: overdueTaskCount },
    };

    const recentLeads = (await repo.findRecentLeads(limit)).map(toRecentLead);

    // Upcoming tasks start from today so overdue earlier-today tasks still appear.
    const tasksRaw: any[] = await repo.findUpcomingTasks(startOfToday, 5, false);

    // Resolve lead info for tasks linked to leads.
    const leadEntityIds = tasksRaw.filter((t) => t.entityType === 'lead' && t.entityId).map((t) => t.entityId);

    const taskLeadMap = new Map<string, { fullName: string; serviceInterest: string; phone: string }>();
    if (leadEntityIds.length > 0) {
      const taskLeads = await repo.findLeadContactsByIds(leadEntityIds);
      for (const l of taskLeads) {
        const services = Array.isArray(l.serviceInterest) ? l.serviceInterest.join(', ') : l.serviceInterest || '';
        taskLeadMap.set(String(l._id), { fullName: l.fullName || '', serviceInterest: services as string, phone: l.phone || '' });
      }
    }

    const upcomingTasks = tasksRaw.map((t) => {
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

    const monthKeys = lastSixMonths(now).map(({ date }) => ({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: monthLabel(date),
    }));

    // Heavy monthly datasets run as grouped aggregations.
    const [monthlyStageServiceAgg, monthlySourceAgg, monthlyCourseAgg, createdStageByMonthAgg, updatedStageByMonthAgg] =
      await Promise.all([
        repo.aggregateStageByService(startOfMonth),
        repo.aggregateSourceCounts(startOfMonth),
        repo.aggregateCourseCounts(COURSE_LABELS),
        repo.aggregateCreatedStageByMonth(sixMonthsAgo),
        repo.aggregateClosedStageByMonth(sixMonthsAgo),
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
    const sourceDistribution = SOURCES.map((source, i) => {
      const count = sourceCountMap.get(source) || 0;
      return {
        source,
        count,
        percentage: totalLeadsMonth > 0 ? Math.round((count / totalLeadsMonth) * 100) : 0,
        color: SOURCE_COLORS[i],
      };
    });

    const courseCountMap = new Map<string, number>();
    for (const row of monthlyCourseAgg) {
      const label = row?._id as string | undefined;
      if (!label) continue;
      courseCountMap.set(label, row.count);
    }
    const coursePerformance = COURSE_LABELS.map((label, i) => ({
      label,
      count: courseCountMap.get(label) || 0,
      color: COURSE_COLORS[i],
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
      return { month: label, rate: total > 0 ? Math.round((converted / total) * 100) : 0 };
    });

    return {
      version: '1.3.1-course-alltime',
      data: { stats, recentLeads, upcomingTasks, stageDistribution, stageTrend, sourceDistribution, conversionTrend, coursePerformance },
    };
  },

  async getAdminDashboardAll(limit: number) {
    const thirtyDaysAgo = daysAgo(30);
    const sixtyDaysAgo = daysAgo(60);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const startOfToday = startOfDay();
    const endOfToday = new Date(startOfToday);
    endOfToday.setHours(23, 59, 59, 999);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    // The nine sections are independent (each reads distinct data and fills one key of the
    // response), so they run concurrently.
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
        const [
          activeBDMs, totalUsers, totalLeads, convertedLeads,
          currentLeads, previousLeads, currentUsers, previousUsers,
          currentBDMs, previousBDMs, prevTotalLeads, prevConverted,
          todaysLead, yesterdayLead, todaysConverted, yesterdayConverted,
          followupPending, yesterdayFollowupPending,
        ] = await Promise.all([
          repo.countUsers({ role: { $in: ['bdm'] }, isActive: true }),
          repo.countUsers({ isActive: true }),
          repo.countLeads(),
          repo.countLeads({ lifecycleStage: 'Enrolled' }),
          repo.countLeads({ createdAt: { $gte: thirtyDaysAgo } }),
          repo.countLeads({ createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
          repo.countUsers({ isActive: true, createdAt: { $gte: thirtyDaysAgo } }),
          repo.countUsers({ isActive: true, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
          repo.countUsers({ role: { $in: ['bdm'] }, isActive: true, createdAt: { $gte: thirtyDaysAgo } }),
          repo.countUsers({ role: { $in: ['bdm'] }, isActive: true, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
          repo.countLeads({ createdAt: { $lt: thirtyDaysAgo } }),
          repo.countLeads({ lifecycleStage: 'Enrolled', createdAt: { $lt: thirtyDaysAgo } }),
          repo.countLeads({ createdAt: { $gte: startOfToday } }),
          repo.countLeads({ createdAt: { $gte: startOfYesterday, $lt: startOfToday } }),
          repo.countLeads({ lifecycleStage: 'Enrolled', updatedAt: { $gte: startOfToday } }),
          repo.countLeads({ lifecycleStage: 'Enrolled', updatedAt: { $gte: startOfYesterday, $lt: startOfToday } }),
          repo.countTasks({ status: { $ne: 'completed' }, dueDate: { $gte: startOfToday, $lte: endOfToday } }),
          repo.countTasks({ status: { $ne: 'completed' }, dueDate: { $gte: startOfYesterday, $lt: startOfToday } }),
        ]);
        const convRate = conversionRate(convertedLeads, totalLeads);
        const prevConvRate = prevTotalLeads > 0 ? (prevConverted / prevTotalLeads) * 100 : 0;
        return {
          activeBDMs: { value: activeBDMs, change: change(currentBDMs, previousBDMs) },
          totalUsers: { value: totalUsers, change: change(currentUsers, previousUsers) },
          totalLeads: { value: totalLeads, change: change(currentLeads, previousLeads) },
          conversionRate: {
            value: `${convRate}%`,
            change:
              prevConvRate > 0
                ? Math.round(((parseFloat(convRate) - prevConvRate) / prevConvRate) * 100)
                : parseFloat(convRate) > 0 ? 100 : 0,
          },
          todaysLead: { value: todaysLead, change: change(todaysLead, yesterdayLead) },
          todaysConverted: { value: todaysConverted, change: change(todaysConverted, yesterdayConverted) },
          followupPending: { value: followupPending, change: change(followupPending, yesterdayFollowupPending) },
        };
      })(),

      // --- Recent Activity ---
      dashboardService.getRecentActivity(limit),

      // --- Top Performers ---
      buildTopPerformers(4),

      // --- Stage Distribution (this month) ---
      (async () => {
        const stageCounts = await Promise.all(
          stages.map((s) => repo.countLeads({ lifecycleStage: s, createdAt: { $gte: startOfMonth } })),
        );
        return stages.map((stage, i) => ({ stage, count: stageCounts[i] }));
      })(),

      // --- Stage Trend ---
      buildStageTrend(),

      // --- Source Distribution (this month) ---
      (async () => {
        const [totalLeadsMonth, sourceCounts] = await Promise.all([
          repo.countLeads({ createdAt: { $gte: startOfMonth } }),
          Promise.all(SOURCES.map((s) => repo.countLeads({ source: s, createdAt: { $gte: startOfMonth } }))),
        ]);
        return SOURCES.map((source, i) => ({
          source,
          count: sourceCounts[i],
          percentage: totalLeadsMonth > 0 ? Math.round((sourceCounts[i] / totalLeadsMonth) * 100) : 0,
        }));
      })(),

      // --- Conversion Rate Trend ---
      buildConversionRateTrend(),

      // --- Course Performance (this month) ---
      (async () => {
        const courseAgg = await repo.aggregateCourseCountsSince(COURSE_LABELS, startOfMonth);
        const courseMap = new Map<string, number>();
        for (const row of courseAgg) {
          const label = row?._id as string | undefined;
          if (!label) continue;
          courseMap.set(label, row.count);
        }
        return COURSE_LABELS.map((label, i) => ({ label, count: courseMap.get(label) || 0, color: COURSE_COLORS[i] }));
      })(),

      // --- Status Distribution ---
      buildStatusDistribution(),
    ]);

    return { stats, recentActivity, topPerformers, stageDistribution, stageTrend, sourceDistribution, conversionTrend, statusDistribution, coursePerformance };
  },
};
