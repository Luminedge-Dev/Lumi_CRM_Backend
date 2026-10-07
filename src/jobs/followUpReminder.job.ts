const cron = require('node-cron') as {
  schedule: (expression: string, callback: () => void, options?: { timezone?: string }) => { stop: () => void };
};

import { leadService } from '../modules/leads/lead.service';
import { createAndEmitNotification, createAndEmitToAdmins } from '../modules/notifications/notification.service';
import { jobLockRepository } from './jobLock.repository';

// Reminds BDMs (and the admins) about leads whose next follow-up is due today. The job only
// orchestrates: which leads are due is decided by leadService, delivery by the notification service.
// Runs at 09:00, 13:00 and 17:00 Asia/Dhaka. It is started by server.ts only, never by tests.

const JOB_NAME = 'followUpReminder';
const TIMEZONE = 'Asia/Dhaka';

/** The scheduled run a moment belongs to: its Asia/Dhaka date and hour, e.g. "2026-10-06T09". */
export const runSlot = (now: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}`;
};

let running = false;

/**
 * One scheduled firing. Skips when a previous run in this process is still going, and when
 * another instance sharing the database already ran this slot, so reminders are never duplicated.
 * Returns whether this call did the work.
 */
export async function runFollowUpReminder(now: Date = new Date()): Promise<boolean> {
  if (running) {
    console.warn('[Scheduler] Previous follow-up run still in progress; skipping this one.');
    return false;
  }
  running = true;
  try {
    const slot = runSlot(now);
    if (!(await jobLockRepository.claimSlot(JOB_NAME, slot))) {
      console.log(`[Scheduler] Follow-up run ${slot} already handled by another instance; skipping.`);
      return false;
    }
    await checkFollowUpsDueToday();
    return true;
  } finally {
    running = false;
  }
}

export async function checkFollowUpsDueToday(): Promise<void> {
  const leads = (await leadService.getFollowUpLeads({})).filter((lead) => lead.dueStatus === 'today' && lead.assignedTo);

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
        'warning',
      );
    } catch (err) {
      console.error(`[Scheduler] BDM notification failed for lead ${lead._id}:`, err);
    }

    try {
      await createAndEmitToAdmins(
        'Follow-up Due Today',
        `${bdmName} has a follow-up due today for lead: ${leadName}`,
        'info',
      );
    } catch (err) {
      console.error(`[Scheduler] Admin notification failed for lead ${lead._id}:`, err);
    }
  }
}

/** Registers the cron. Returns a handle whose stop() unschedules it (used on shutdown). */
export function startFollowUpReminderJob(): { stop: () => void } {
  const task = cron.schedule(
    '0 9,13,17 * * *',
    async () => {
      console.log('[Scheduler] Running follow-up due date check...');
      try {
        await runFollowUpReminder();
      } catch (err) {
        console.error('[Scheduler] Error in follow-up job:', err);
      }
    },
    { timezone: TIMEZONE },
  );

  console.log('[Scheduler] Follow-up cron registered (09:00, 13:00, 17:00 Asia/Dhaka).');
  return task;
}
