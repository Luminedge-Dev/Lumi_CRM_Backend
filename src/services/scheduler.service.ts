const cron = require('node-cron') as {
  schedule: (expression: string, callback: () => void, options?: { timezone?: string }) => void;
};

import { createAndEmitNotification, createAndEmitToAdmins } from './notification.service';
import { findFollowUpLeads } from './followUp.service';

export function initScheduler(): void {
  cron.schedule(
    '0 9,13,17 * * *',
    async () => {
      console.log('[Scheduler] Running follow-up due date check...');
      try {
        await checkFollowUpsDueToday();
      } catch (err) {
        console.error('[Scheduler] Error in follow-up job:', err);
      }
    },
    { timezone: 'Asia/Dhaka' }
  );

  console.log('[Scheduler] Follow-up cron registered (09:00, 13:00, 17:00 Asia/Dhaka).');
}

async function checkFollowUpsDueToday(): Promise<void> {
  const leads = (await findFollowUpLeads({})).filter((lead) => lead.dueStatus === 'today' && lead.assignedTo);

  console.log(`[Scheduler] Found ${leads.length} lead(s) with follow-up due today.`);

  for (const lead of leads) {
    const bdmId: string = lead.assignedTo.toString();
    const bdmName: string = lead.assignedUser?.name ?? 'Your BDM';
    const leadName: string = lead.fullName ?? 'a lead';

    try {
      await createAndEmitNotification(
        bdmId,
        'Follow-up Due Today',
        `You have a follow-up due today for ${leadName}`,
        'warning'
      );
    } catch (err) {
      console.error(`[Scheduler] BDM notification failed for lead ${lead._id}:`, err);
    }

    try {
      await createAndEmitToAdmins(
        'Follow-up Due Today',
        `${bdmName} has a follow-up due today for lead: ${leadName}`,
        'info'
      );
    } catch (err) {
      console.error(`[Scheduler] Admin notification failed for lead ${lead._id}:`, err);
    }
  }
}
