import { AppError, found } from '../../core/errors';
import { LEAD_STAGES } from '../../shared/constants/leadStages';
import { getDhakaDayBounds } from '../../shared/utils/date';
import {
  buildPhoneEntryFilter,
  canonicalizePhoneValue,
  extractPhoneDigits,
  phoneSearchDigits,
} from '../../shared/utils/phone';
import { publicErrorMessage } from '../../shared/utils/httpError';
import { createAndEmitNotification, createAndEmitToAdmins, createAndEmitToRoles } from '../notifications/notification.service';
import { userRepository } from '../users/user.repository';
import { leadRepository, toObjectId } from './lead.repository';
import { buildLeadFilter, phoneSuggestionFilter, processFollowUps, sortFollowUpsDesc } from './lead.query';
import { FollowUpDueStatus, ImportSummary, LeadActor, LeadWriteInput } from './lead.types';

export const PHONE_LOOKUP_MESSAGE = 'This number already exists. Already used, try with another number.';

const normalizePhoneDigits = extractPhoneDigits;

/** A duplicate-key error on write means the phone number is already taken. */
const rethrowDuplicateAsConflict = (err: unknown): never => {
  if ((err as { code?: number })?.code === 11000) throw AppError.conflict(PHONE_LOOKUP_MESSAGE);
  throw err;
};

// Strict duplicate check for create/update: matches any lead whose `phone` field contains the
// canonical number as one of its (possibly multiple, comma-separated) entries, not just leads
// whose entire `phone` field is byte-for-byte identical.
const isPhoneTaken = async (phone: string, excludeId?: string): Promise<boolean> => {
  const canonical = canonicalizePhoneValue(phone);
  if (!canonical) return false;

  const entryFilter = buildPhoneEntryFilter(canonical);
  if (!entryFilter) return false;

  const filter: Record<string, any> = { ...entryFilter };
  if (excludeId) filter._id = { $ne: excludeId };

  return leadRepository.existsByFilter(filter);
};

export const leadService = {
  isPhoneTaken,

  async getLeads(query: Record<string, unknown>, page: number, limit: number, skip: number) {
    const filter = buildLeadFilter(query);
    const [leads, total] = await Promise.all([leadRepository.findPage(filter, skip, limit), leadRepository.count(filter)]);
    return { leads, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /**
   * Leads with a pending next-follow-up date, tagged with dueStatus ('overdue' | 'today' |
   * 'upcoming') computed in Asia/Dhaka. Single source for the Follow-up Reminders page, the
   * dashboard widget, the sidebar badge and the reminder cron job.
   */
  async getFollowUpLeads(opts: { assignedTo?: string }): Promise<any[]> {
    const { todayStart, todayEnd } = getDhakaDayBounds();
    const leads = await leadRepository.aggregateFollowUps(opts.assignedTo);

    return leads.map((lead) => {
      const due: Date = lead.lastFollowUp.nextFollowUpDate;
      const dueStatus: FollowUpDueStatus = due < todayStart ? 'overdue' : due <= todayEnd ? 'today' : 'upcoming';
      return { ...lead, dueStatus };
    });
  },

  /** Phone typeahead and duplicate hint. */
  async lookupPhone(query: string, limit: number, excludeId?: string) {
    if (!query) return { suggestions: [], exactMatch: false };

    const normalizedQuery = phoneSearchDigits(query);
    if (!normalizedQuery) return { suggestions: [], exactMatch: false };

    const leads = await leadRepository.findPhoneCandidates(
      phoneSuggestionFilter(normalizedQuery, excludeId),
      Math.max(limit, 1) * 4,
    );

    const seen = new Set<string>();
    const suggestions: Array<{ _id: string; fullName: string; phone: string; whom?: string }> = [];
    let exactMatch = false;

    for (const lead of leads as any[]) {
      const normalizedPhone = normalizePhoneDigits(lead.phone);
      if (!normalizedPhone || seen.has(normalizedPhone)) continue;

      seen.add(normalizedPhone);
      if (normalizedPhone === normalizedQuery) exactMatch = true;

      suggestions.push({ _id: String(lead._id), fullName: lead.fullName, phone: lead.phone, whom: lead.whom });
      if (suggestions.length >= limit) break;
    }

    return { suggestions, exactMatch };
  },

  async getLead(id: string) {
    const lead = found(await leadRepository.findByIdWithAssignee(id), 'Lead not found');
    return sortFollowUpsDesc(lead.toObject());
  },

  async createLead(actor: LeadActor, input: LeadWriteInput) {
    const { fullName, email, phone, whom, source, serviceInterest, assignedTo, notes, followUps, lifecycleStage } = input;

    const processedFollowUps = processFollowUps(followUps);

    if (await isPhoneTaken(phone)) throw AppError.conflict(PHONE_LOOKUP_MESSAGE);

    let lead;
    try {
      lead = await leadRepository.create({
        fullName,
        ...(email && email.trim() ? { email: email.trim() } : {}),
        phone,
        whom,
        source: source || 'Website',
        serviceInterest,
        assignedTo: assignedTo || undefined,
        notes,
        followUps: processedFollowUps,
        lifecycleStage: lifecycleStage || 'New Inquiry',
      });
    } catch (err) {
      return rethrowDuplicateAsConflict(err);
    }

    await leadRepository.populateAssignee(lead);

    // Notifications must never fail the request.
    try {
      const creator = await userRepository.findNameAndRoleById(actor.userId);
      const creatorName = creator?.name || 'A BDM';
      const leadName = fullName || 'Unnamed lead';
      await createAndEmitToAdmins('New Lead Added', `${creatorName} added a new lead: ${leadName}`, 'info');
      // If assigned to someone other than the creator, notify them too.
      if (assignedTo && assignedTo !== actor.userId) {
        await createAndEmitNotification(assignedTo, 'Lead Assigned to You', `New lead assigned: ${leadName}`, 'info');
      }
    } catch (notifErr) {
      console.error('Notification error on createLead:', notifErr);
    }

    return lead;
  },

  async updateLead(id: string, input: LeadWriteInput) {
    const { followUps, fullName, email, phone, whom, source, serviceInterest, assignedTo, notes, lifecycleStage } = input;

    const updateData: Record<string, any> = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) {
      if (await isPhoneTaken(phone, id)) throw AppError.conflict(PHONE_LOOKUP_MESSAGE);
      updateData.phone = phone;
    }
    if (whom !== undefined) updateData.whom = whom;
    if (source !== undefined) updateData.source = source;
    if (serviceInterest !== undefined) updateData.serviceInterest = serviceInterest;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (notes !== undefined) updateData.notes = notes;
    if (lifecycleStage !== undefined) updateData.lifecycleStage = lifecycleStage;
    if (followUps) updateData.followUps = processFollowUps(followUps);

    let lead;
    try {
      lead = await leadRepository.updateById(id, updateData);
    } catch (err) {
      return rethrowDuplicateAsConflict(err);
    }
    return found(lead, 'Lead not found');
  },

  async deleteLead(id: string): Promise<void> {
    found(await leadRepository.deleteById(id), 'Lead not found');
  },

  async addFollowUp(id: string, input: { date?: any; note?: any; nextFollowUpDate?: any }) {
    const { date, note, nextFollowUpDate } = input;
    const lead = found(
      await leadRepository.pushFollowUp(id, {
        date: date ? new Date(date) : undefined,
        note,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
        createdAt: new Date(),
      }),
      'Lead not found',
    );
    return sortFollowUpsDesc(lead.toObject());
  },

  async updateStage(id: string, lifecycleStage: string, actor: LeadActor) {
    const lead = found(await leadRepository.setStage(id, lifecycleStage), 'Lead not found');

    // Notify admins and the other BDMs; failures never fail the request.
    try {
      const user = await userRepository.findNameAndRoleById(actor.userId);
      const actorName = user?.name || 'A BDM';
      const leadName = lead.fullName || 'Unnamed lead';
      const message = `${actorName} updated lead "${leadName}" to ${lifecycleStage}`;

      await createAndEmitToAdmins('Lead Stage Updated', message, lifecycleStage === 'Enrolled' ? 'success' : 'info');
      await createAndEmitToRoles(['bdm'], 'Lead Stage Updated', message, 'info', actor.userId);
    } catch (notifErr) {
      console.error('Notification error on updateLeadStage:', notifErr);
    }

    return lead;
  },

  listAssignableUsers: () => userRepository.listAssignable(),

  /**
   * Distinct original BDM names from bulk-imported leads with their lead counts, the count of
   * leads with no BDM info at all, and real BDM users with their CURRENT assignedTo-based count.
   * Powers the Lead Center "filter by BDM" dropdown.
   */
  async getBdmNames() {
    const [nameCounts, unassignedCount, bdmUsers] = await Promise.all([
      leadRepository.aggregateBdmNameCounts(),
      leadRepository.countUnassigned(),
      userRepository.listActiveBdmNames(),
    ]);

    const bdmCountRows = await leadRepository.aggregateCountsByAssignee(bdmUsers.map((u) => u._id));
    const bdmCountById = new Map(bdmCountRows.map((row) => [String(row._id), row.count as number]));

    return {
      names: nameCounts.map((row) => ({ name: row._id as string, count: row.count as number })),
      unassignedCount,
      bdmUsers: bdmUsers
        .map((u) => ({ _id: String(u._id), name: u.name, count: bdmCountById.get(String(u._id)) || 0 }))
        .filter((u) => u.count > 0)
        .sort((a, b) => b.count - a.count),
    };
  },

  async importLeads(leads: any[]): Promise<ImportSummary> {
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    const toDate = (v: any): Date | undefined => {
      if (!v) return undefined;
      const d = new Date(v);
      return isNaN(d.getTime()) ? undefined : d;
    };

    for (const leadData of leads) {
      try {
        const email = leadData.email?.toLowerCase().trim();
        if (!email) {
          failed++;
          errors.push('Row skipped: missing email');
          continue;
        }

        const processedFollowUps = Array.isArray(leadData.followUps)
          ? leadData.followUps
              .map((fu: any) => ({
                date: toDate(fu.date),
                note: fu.note || '',
                nextFollowUpDate: toDate(fu.nextFollowUpDate),
              }))
              .filter((fu: any) => fu.date || fu.nextFollowUpDate)
          : [];

        const existing = await leadRepository.findByEmail(email);

        if (existing) {
          const setFields: any = {
            fullName: leadData.fullName || existing.fullName,
            phone: leadData.phone || existing.phone,
            source: leadData.source || existing.source,
            serviceInterest: leadData.serviceInterest || existing.serviceInterest,
            lifecycleStage: leadData.lifecycleStage || existing.lifecycleStage,
          };
          if (leadData.notes !== undefined && leadData.notes !== null) {
            setFields.notes = leadData.notes;
          }

          const updateOp: any = { $set: setFields };

          if (processedFollowUps.length > 0) {
            if (!existing.followUps || existing.followUps.length === 0) {
              // No existing follow-ups: replace entirely.
              setFields.followUps = processedFollowUps;
            } else {
              // Append only entries with a new date.
              const existingDates = new Set(existing.followUps.map((f: any) => f.date?.toISOString?.() ?? ''));
              const newOnes = processedFollowUps.filter((f: any) => !existingDates.has(f.date?.toISOString?.() ?? ''));
              if (newOnes.length > 0) {
                updateOp.$push = { followUps: { $each: newOnes } };
              }
            }
          }

          await leadRepository.updateOneByEmail(email, updateOp);
          imported++;
        } else {
          if (await isPhoneTaken(leadData.phone)) {
            failed++;
            errors.push(`Row skipped: phone already exists (${leadData.phone})`);
            continue;
          }

          await leadRepository.create({
            fullName: leadData.fullName,
            email,
            phone: leadData.phone,
            source: leadData.source || 'Others',
            serviceInterest: leadData.serviceInterest,
            notes: leadData.notes,
            lifecycleStage: leadData.lifecycleStage || 'New Inquiry',
            followUps: processedFollowUps,
          });
          imported++;
        }
      } catch (error: any) {
        failed++;
        console.error(`Lead import row ${imported + failed} failed:`, error);
        errors.push(`Row ${imported + failed}: ${publicErrorMessage(error, 'could not be imported')}`);
      }
    }

    return { imported, failed, errors: errors.slice(0, 10) }; // return the first 10 errors
  },

  async getStats() {
    const stats = await leadRepository.aggregateStageTotals();
    const totalLeads = await leadRepository.count();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const newLeadsToday = await leadRepository.count({ createdAt: { $gte: todayStart } });

    return {
      total: totalLeads,
      newToday: newLeadsToday,
      byStage: stats.reduce((acc: any, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
    };
  },

  /**
   * Per-stage counts in one aggregation (instead of one count per stage). Accepts the same
   * filters as the list (minus `stage`) so the counts follow the current search/BDM/course filter.
   */
  async getStageCounts(query: Record<string, unknown>) {
    const { stage: _stage, ...rest } = query;
    const match = buildLeadFilter(rest);
    // $match bypasses Mongoose's automatic query casting, so an ObjectId-typed field must be
    // cast explicitly or a string value will never match any document.
    if (match.assignedTo) match.assignedTo = toObjectId(match.assignedTo);

    const rows = await leadRepository.aggregateStageCounts(match);
    const countByStage = new Map(rows.map((row) => [row._id as string, row.count as number]));
    return Object.fromEntries(LEAD_STAGES.map((stage) => [stage, countByStage.get(stage) || 0]));
  },

  /** Assigns (or, with no bdmId, unassigns) leads. Admin-only at the route. */
  async assignLeads(leadIds: unknown[], bdmId: unknown) {
    if (!bdmId) {
      const result = await leadRepository.unassignMany(leadIds);
      return { message: `Unassigned ${result.modifiedCount} lead(s)`, modifiedCount: result.modifiedCount };
    }

    const bdm = found(await userRepository.findById(bdmId), 'BDM not found');

    const result = await leadRepository.assignMany(leadIds, bdmId);

    try {
      await createAndEmitNotification(
        bdmId as string,
        'Leads Assigned to You',
        `${result.modifiedCount} lead(s) have been assigned to you`,
        'info',
      );
    } catch (notifErr) {
      console.error('Notification error on assignLeads:', notifErr);
    }

    return {
      message: `Successfully assigned ${result.modifiedCount} lead(s) to ${bdm.name}`,
      modifiedCount: result.modifiedCount,
    };
  },
};
