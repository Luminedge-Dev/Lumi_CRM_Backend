import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Lead from '../models/Lead';
import User from '../models/User';
import { createAndEmitNotification, createAndEmitToAdmins, createAndEmitToRoles } from '../services/notification.service';
import { canonicalizePhoneValue, extractPhoneDigits, escapeRegex, buildPhoneEntryFilter, phoneSearchDigits } from '../utils/phone.util';
import { findFollowUpLeads } from '../services/followUp.service';

const PHONE_LOOKUP_MESSAGE = 'This number already exists. Already used, try with another number.';

const normalizePhoneDigits = extractPhoneDigits;

// Typeahead/suggestions only — matches on a digit prefix so it can still use the phone index
// as a prefix scan. Not used for the strict duplicate check (see assertPhoneIsUnique below),
// since a lead's `phone` field may contain multiple comma-separated numbers (LeadDetail.tsx's
// "add another phone" feature) and a full substring scan is the only way to surface those in
// suggestions.
const getPhoneCandidates = async (query: string, limit = 8, excludeId?: string) => {
  const normalizedQuery = phoneSearchDigits(query);
  if (!normalizedQuery) return { suggestions: [], exactMatch: false };

  const safeQuery = escapeRegex(normalizedQuery);
  const filter: Record<string, any> = {
    phone: { $regex: `^\\+?${safeQuery}|,\\s*\\+?${safeQuery}`, $options: 'i' }
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const leads = await Lead.find(filter)
    .select('fullName phone whom createdAt')
    .sort({ createdAt: -1 })
    .limit(Math.max(limit, 1) * 4)
    .lean();

  const seen = new Set<string>();
  const suggestions: Array<{ _id: string; fullName: string; phone: string; whom?: string }> = [];
  let exactMatch = false;

  for (const lead of leads) {
    const normalizedPhone = normalizePhoneDigits((lead as any).phone);
    if (!normalizedPhone || seen.has(normalizedPhone)) continue;

    seen.add(normalizedPhone);

    if (normalizedPhone === normalizedQuery) {
      exactMatch = true;
    }

    suggestions.push({
      _id: String((lead as any)._id),
      fullName: (lead as any).fullName,
      phone: (lead as any).phone,
      whom: (lead as any).whom,
    });

    if (suggestions.length >= limit) break;
  }

  return { suggestions, exactMatch };
};

// Strict duplicate check for create/update: matches any lead whose `phone` field contains
// the canonical number as one of its (possibly multiple, comma-separated) entries — not just
// leads whose entire `phone` field is byte-for-byte identical.
const assertPhoneIsUnique = async (phone: string, excludeId?: string) => {
  const canonical = canonicalizePhoneValue(phone);
  if (!canonical) return false;

  const entryFilter = buildPhoneEntryFilter(canonical);
  if (!entryFilter) return false;

  const filter: Record<string, any> = { ...entryFilter };
  if (excludeId) filter._id = { $ne: excludeId };

  const existing = await Lead.exists(filter);
  return Boolean(existing);
};
// Builds the shared Lead query filter from the same set of query params used by both
// getLeads (paginated list) and getLeadStageCounts (per-stage totals), so the two stay in
// sync — e.g. a search/BDM/course filter narrows both the table and the stat-card counts.
const buildLeadFilter = (query: Request['query']): Record<string, any> => {
  const { stage, source, serviceInterest, assignedTo, bdmName, search, unassigned } = query;
  const filter: Record<string, any> = {};

  if (unassigned === 'true') {
    // Genuinely unassigned: no real BDM AND no imported BDM name either (distinct from a
    // lead that has a bdmName like "Tanha" but no matching User account yet).
    filter.$and = [
      { $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }] },
      { $or: [{ bdmName: { $exists: false } }, { bdmName: null }, { bdmName: '' }] },
    ];
  }

  if (stage && stage !== 'All') {
    filter.lifecycleStage = String(stage);
  }

  if (source && source !== 'All') {
    filter.source = String(source);
  }

  if (serviceInterest && serviceInterest !== 'All Courses') {
    // serviceInterest is stored as an array on Lead; equality against a scalar matches
    // documents where the array contains that value.
    filter.serviceInterest = String(serviceInterest);
  }

  if (assignedTo && unassigned !== 'true') {
    filter.assignedTo = String(assignedTo);
  }

  // Filters leads by the original CSV-imported BDM name, for leads with no matching
  // User account (see backfillBdmName.ts) — a separate filter from assignedTo since it's
  // a plain string, not a User reference.
  if (bdmName) {
    filter.bdmName = String(bdmName);
  }

  if (search) {
    const rawSearch = String(search).slice(0, 200);
    const isPhoneLike = /^[\d+\-\s()]+$/.test(rawSearch) && normalizePhoneDigits(rawSearch).length >= 1;

    if (isPhoneLike) {
      // Digit-only queries are almost always a phone number — matched as a substring so any
      // typed digits narrow the list regardless of where they fall in the number: the start
      // ("8" -> +880... leads), the middle, or the last few digits (how people often recall a
      // number they don't have written down, e.g. "499434").
      //
      // Two candidate digit strings are matched, since neither alone covers every case: the
      // raw typed digits (so a short/partial query like "8" matches stored "+880..." numbers
      // literally, without being reinterpreted), and the canonicalized digits (so a bare
      // national number like "01736461877" still matches leads stored in international form,
      // "+8801736461877" — phoneSearchDigits assumes an in-progress national number and
      // prepends the default country code, which corrupts genuinely short queries if used
      // alone, e.g. "8" -> "8808").
      const rawDigits = normalizePhoneDigits(rawSearch);
      const canonicalDigits = phoneSearchDigits(rawSearch);
      const digitVariants = Array.from(new Set([rawDigits, canonicalDigits].filter(Boolean)));
      const alternation = digitVariants.map((d) => escapeRegex(d)).join('|');
      filter.phone = { $regex: alternation };
    } else {
      // Substring match on name/email so any typed letter progressively narrows results —
      // $text (the previous approach) only matches whole, stemmed word tokens and can't do
      // prefix/partial matching, so a single letter or partial name returned nothing.
      const safeText = escapeRegex(rawSearch);
      filter.$or = [
        { fullName: { $regex: safeText, $options: 'i' } },
        { email: { $regex: safeText, $options: 'i' } },
      ];
    }
  }

  return filter;
};

// Get all leads
export const getLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page: pageParam, limit: limitParam } = req.query;

    const page = Math.max(1, parseInt(String(pageParam || '1'), 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(String(limitParam || '50'), 10) || 50));
    const skip = (page - 1) * limit;

    const filter = buildLeadFilter(req.query);

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Lead.countDocuments(filter),
    ]);

    res.json({
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

// Leads with a pending next-follow-up date, tagged with dueStatus ('overdue' | 'today' |
// 'upcoming') computed in Asia/Dhaka. Single shared source for the Follow-up Reminders page,
// the dashboard's "Today's Follow-ups" widget, and the sidebar badge count.
export const getFollowUpLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const assignedTo = req.query.assignedTo ? String(req.query.assignedTo) : undefined;
    const leads = await findFollowUpLeads({ assignedTo });
    res.json({ leads });
  } catch (error) {
    console.error('Error fetching follow-up leads:', error);
    res.status(500).json({ error: 'Failed to fetch follow-up leads' });
  }
};

// Phone lookup for suggestions and duplicate checking
export const lookupLeadPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = String(req.query.query ?? req.query.phone ?? '').trim();
    const limit = Number.parseInt(String(req.query.limit ?? '8'), 10);
    const excludeId = req.query.excludeId ? String(req.query.excludeId) : undefined;

    if (!query) {
      res.json({ suggestions: [], exactMatch: false });
      return;
    }

    const { suggestions, exactMatch } = await getPhoneCandidates(query, Number.isNaN(limit) ? 8 : Math.min(Math.max(limit, 1), 20), excludeId);
    res.json({ suggestions, exactMatch });
  } catch (error) {
    console.error('Error looking up phone suggestions:', error);
    res.status(500).json({ error: 'Failed to lookup phone suggestions' });
  }
};
const sortFollowUpsDesc = (leadObj: any) => {
  if (Array.isArray(leadObj?.followUps)) {
    leadObj.followUps = [...leadObj.followUps].sort((a: any, b: any) => {
      const bTime = new Date(b.createdAt || b.date || 0).getTime();
      const aTime = new Date(a.createdAt || a.date || 0).getTime();
      return bTime - aTime;
    });
  }
  return leadObj;
};

// Get single lead
export const getLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await Lead.findById(req.params.id).populate('assignedTo', 'name email');

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json(sortFollowUpsDesc(lead.toObject()));
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
};

// Create lead
export const createLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, phone, whom, source, serviceInterest, assignedTo, notes, followUps, lifecycleStage } = req.body;

    // Process follow-ups to convert date strings to Date objects
    const processedFollowUps = followUps?.map((fu: any) => ({
      date: fu.date ? new Date(fu.date) : undefined,
      note: fu.note,
      nextFollowUpDate: fu.nextFollowUpDate ? new Date(fu.nextFollowUpDate) : undefined
    })).filter((fu: any) => fu.date || fu.note || fu.nextFollowUpDate) || [];

    if (await assertPhoneIsUnique(phone)) {
      res.status(409).json({ error: PHONE_LOOKUP_MESSAGE });
      return;
    }

    const lead = new Lead({
      fullName,
      ...(email && email.trim() ? { email: email.trim() } : {}),
      phone,
      whom,
      source: source || 'Website',
      serviceInterest,
      assignedTo: assignedTo || undefined,
      notes,
      followUps: processedFollowUps,
      lifecycleStage: lifecycleStage || 'New Inquiry'
    });

    await lead.save();

    // Populate assignedTo before sending response
    await lead.populate('assignedTo', 'name email');

    // Notify admins in background (don't block response)
    const reqUser = (req as any).user;
    try {
      const creator = await User.findById(reqUser?.userId).select('name role');
      const creatorName = creator?.name || 'A BDM';
      const leadName = fullName || 'Unnamed lead';
      await createAndEmitToAdmins(
        'New Lead Added',
        `${creatorName} added a new lead: ${leadName}`,
        'info'
      );
      // If assigned to someone other than creator, notify them too
      if (assignedTo && assignedTo !== reqUser?.userId) {
        await createAndEmitNotification(
          assignedTo,
          'Lead Assigned to You',
          `New lead assigned: ${leadName}`,
          'info'
        );
      }
    } catch (notifErr) {
      console.error('Notification error on createLead:', notifErr);
    }

    res.status(201).json(lead);
  } catch (error: any) {
    console.error('Error creating lead:', error);
    if (error.name === 'ValidationError') {
      res.status(400).json({ error: error.message });
    } else if (error.code === 11000) {
      res.status(409).json({ error: PHONE_LOOKUP_MESSAGE });
    } else {
      res.status(500).json({ error: 'Failed to create lead' });
    }
  }
};

// Update lead
export const updateLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { followUps, fullName, email, phone, whom, source, serviceInterest, assignedTo, notes, lifecycleStage } = req.body;

    const updateData: Record<string, any> = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) {
      if (await assertPhoneIsUnique(phone, req.params.id)) {
        res.status(409).json({ error: PHONE_LOOKUP_MESSAGE });
        return;
      }
      updateData.phone = phone;
    }
    if (whom !== undefined) updateData.whom = whom;
    if (source !== undefined) updateData.source = source;
    if (serviceInterest !== undefined) updateData.serviceInterest = serviceInterest;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (notes !== undefined) updateData.notes = notes;
    if (lifecycleStage !== undefined) updateData.lifecycleStage = lifecycleStage;

    if (followUps) {
      updateData.followUps = followUps.map((fu: any) => ({
        date: fu.date ? new Date(fu.date) : undefined,
        note: fu.note,
        nextFollowUpDate: fu.nextFollowUpDate ? new Date(fu.nextFollowUpDate) : undefined
      })).filter((fu: any) => fu.date || fu.note || fu.nextFollowUpDate);
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email');

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json(lead);
  } catch (error: any) {
    console.error('Error updating lead:', error);
    if (error.name === 'ValidationError') {
      res.status(400).json({ error: error.message });
    } else if (error.code === 11000) {
      res.status(409).json({ error: PHONE_LOOKUP_MESSAGE });
    } else {
      res.status(500).json({ error: 'Failed to update lead' });
    }
  }
};

// Delete lead
export const deleteLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
};

// Add follow-up to lead
export const addFollowUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, note, nextFollowUpDate } = req.body;

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          followUps: {
            date: date ? new Date(date) : undefined,
            note,
            nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : undefined,
            createdAt: new Date()
          }
        }
      },
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email');

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    res.json(sortFollowUpsDesc(lead.toObject()));
  } catch (error) {
    console.error('Error adding follow-up:', error);
    res.status(500).json({ error: 'Failed to add follow-up' });
  }
};

// Update lead stage
export const updateLeadStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lifecycleStage } = req.body;
    const reqUser = (req as any).user;

    if (!['New Inquiry', 'Contacted', 'Trial Class', 'Enrolled', 'Lost'].includes(lifecycleStage)) {
      res.status(400).json({ error: 'Invalid lifecycle stage' });
      return;
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { lifecycleStage },
      { new: true }
    ).populate('assignedTo', 'name email');

    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Notify Admins and Other BDMs about the change
    try {
      const user = await User.findById(reqUser?.userId).select('name role');
      const actorName = user?.name || 'A BDM';
      const leadName = lead.fullName || 'Unnamed lead';

      // 1. Notify Admins
      await createAndEmitToAdmins(
        'Lead Stage Updated',
        `${actorName} updated lead "${leadName}" to ${lifecycleStage}`,
        lifecycleStage === 'Enrolled' ? 'success' : 'info'
      );

      // 2. Notify other BDMs
      await createAndEmitToRoles(
        ['bdm'],
        'Lead Stage Updated',
        `${actorName} updated lead "${leadName}" to ${lifecycleStage}`,
        'info',
        reqUser?.userId
      );
    } catch (notifErr) {
      console.error('Notification error on updateLeadStage:', notifErr);
    }

    res.json(lead);
  } catch (error) {
    console.error('Error updating lead stage:', error);
    res.status(500).json({ error: 'Failed to update lead stage' });
  }
};

// Get all BDMs (users with bdm role)
export const getBDMs = async (req: Request, res: Response): Promise<void> => {
  try {
    const bdms = await User.find({
      role: { $in: ['bdm', 'senior-bdm', 'junior-bdm', 'admin'] },
      isActive: true
    }).select('_id name email role');

    res.json(bdms);
  } catch (error) {
    console.error('Error fetching BDMs:', error);
    res.status(500).json({ error: 'Failed to fetch BDMs' });
  }
};

// Distinct original BDM names from bulk-imported leads (see backfillBdmName.ts), each with
// its lead count; the count of leads with no BDM info at all; and real registered BDM users
// with their CURRENT assignedTo-based count (which can differ from the bdmName counts once
// leads get reassigned, e.g. bulk-assigning the unassigned batch to a real user). Powers the
// Lead Center's "filter by BDM" dropdown.
export const getLeadBdmNames = async (req: Request, res: Response): Promise<void> => {
  try {
    const [nameCounts, unassignedCount, bdmUsers] = await Promise.all([
      Lead.aggregate([
        { $match: { bdmName: { $exists: true, $nin: [null, ''] } } },
        { $group: { _id: '$bdmName', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Lead.countDocuments({
        $and: [
          { $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }] },
          { $or: [{ bdmName: { $exists: false } }, { bdmName: null }, { bdmName: '' }] },
        ],
      }),
      User.find({ role: 'bdm', isActive: true }).select('_id name').lean(),
    ]);

    const bdmCountRows = await Lead.aggregate([
      { $match: { assignedTo: { $in: bdmUsers.map((u) => u._id) } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
    ]);
    const bdmCountById = new Map(bdmCountRows.map((row) => [String(row._id), row.count as number]));

    res.json({
      names: nameCounts.map((row) => ({ name: row._id as string, count: row.count as number })),
      unassignedCount,
      bdmUsers: bdmUsers
        .map((u) => ({ _id: String(u._id), name: u.name, count: bdmCountById.get(String(u._id)) || 0 }))
        .filter((u) => u.count > 0)
        .sort((a, b) => b.count - a.count),
    });
  } catch (error) {
    console.error('Error fetching lead BDM names:', error);
    res.status(500).json({ error: 'Failed to fetch lead BDM names' });
  }
};

// Import leads from CSV
export const importLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const { leads } = req.body;

    if (!leads || !Array.isArray(leads)) {
      res.status(400).json({ error: 'Invalid leads data. Expected array of leads.' });
      return;
    }

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const leadData of leads) {
      try {
        const email = leadData.email?.toLowerCase().trim();
        if (!email) { failed++; errors.push(`Row skipped: missing email`); continue; }

        const toDate = (v: any): Date | undefined => {
          if (!v) return undefined;
          const d = new Date(v);
          return isNaN(d.getTime()) ? undefined : d;
        };
        const processedFollowUps = Array.isArray(leadData.followUps)
          ? leadData.followUps
              .map((fu: any) => ({
                date: toDate(fu.date),
                note: fu.note || '',
                nextFollowUpDate: toDate(fu.nextFollowUpDate),
              }))
              .filter((fu: any) => fu.date || fu.nextFollowUpDate)
          : [];

        const existing = await Lead.findOne({ email });

        if (existing) {
          // Build $set for scalar fields
          const setFields: any = {
            fullName:        leadData.fullName        || existing.fullName,
            phone:           leadData.phone           || existing.phone,
            source:          leadData.source          || existing.source,
            serviceInterest: leadData.serviceInterest || existing.serviceInterest,
            lifecycleStage:  leadData.lifecycleStage  || existing.lifecycleStage,
          };
          if (leadData.notes !== undefined && leadData.notes !== null) {
            setFields.notes = leadData.notes;
          }

          const updateOp: any = { $set: setFields };

          if (processedFollowUps.length > 0) {
            if (!existing.followUps || existing.followUps.length === 0) {
              // No existing follow-ups — replace entirely
              setFields.followUps = processedFollowUps;
            } else {
              // Append only entries with a new date
              const existingDates = new Set(
                existing.followUps.map((f: any) => f.date?.toISOString?.() ?? '')
              );
              const newOnes = processedFollowUps.filter(
                (f: any) => !existingDates.has(f.date?.toISOString?.() ?? '')
              );
              if (newOnes.length > 0) {
                updateOp.$push = { followUps: { $each: newOnes } };
              }
            }
          }

          await Lead.updateOne({ email }, updateOp);
          imported++;
        } else {
          if (await assertPhoneIsUnique(leadData.phone)) {
            failed++;
            errors.push(`Row skipped: phone already exists (${leadData.phone})`);
            continue;
          }

          const lead = new Lead({
            fullName: leadData.fullName,
            email,
            phone: leadData.phone,
            source: leadData.source || 'Others',
            serviceInterest: leadData.serviceInterest,
            notes: leadData.notes,
            lifecycleStage: leadData.lifecycleStage || 'New Inquiry',
            followUps: processedFollowUps
          });
          await lead.save();
          imported++;
        }
      } catch (error: any) {
        failed++;
        errors.push(`Row ${imported + failed}: ${error.message}`);
      }
    }

    res.json({
      imported,
      failed,
      errors: errors.slice(0, 10) // Return first 10 errors
    });
  } catch (error) {
    console.error('Error importing leads:', error);
    res.status(500).json({ error: 'Failed to import leads' });
  }
};

// Get lead statistics
export const getLeadStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await Lead.aggregate([
      {
        $group: {
          _id: '$lifecycleStage',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalLeads = await Lead.countDocuments();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const newLeadsToday = await Lead.countDocuments({ createdAt: { $gte: todayStart } });

    res.json({
      total: totalLeads,
      newToday: newLeadsToday,
      byStage: stats.reduce((acc: any, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ error: 'Failed to fetch lead statistics' });
  }
};

// Per-stage lead counts, computed with a single aggregation instead of one countDocuments
// call per stage — powers BDMPipeline's column headers and Lead Center's stat cards, which
// both need the true total per stage even beyond the card/table-rendering cap. Accepts the
// same filters as getLeads (minus `stage` itself) so the counts stay in sync with whatever
// search/BDM/course filter is currently narrowing the list.
export const getLeadStageCounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stage, ...rest } = req.query;
    const match = buildLeadFilter(rest);
    // $match bypasses Mongoose's automatic query casting (unlike Model.find()), so an ObjectId-typed
    // field must be cast explicitly here or a string value will never match any document.
    if (match.assignedTo) match.assignedTo = new mongoose.Types.ObjectId(String(match.assignedTo));

    const stages = ['New Inquiry', 'Contacted', 'Trial Class', 'Enrolled', 'Lost'];
    const rows = await Lead.aggregate([
      { $match: match },
      { $group: { _id: '$lifecycleStage', count: { $sum: 1 } } },
    ]);
    const countByStage = new Map(rows.map((row) => [row._id as string, row.count as number]));

    res.json(Object.fromEntries(stages.map((stage) => [stage, countByStage.get(stage) || 0])));
  } catch (error) {
    console.error('Error fetching lead stage counts:', error);
    res.status(500).json({ error: 'Failed to fetch lead stage counts' });
  }
};

// Assign leads to BDM
export const assignLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const { leadIds, bdmId } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({ error: 'Lead IDs are required' });
      return;
    }

    // Unassign case
    if (!bdmId) {
      const result = await Lead.updateMany(
        { _id: { $in: leadIds } },
        { $unset: { assignedTo: '' }, $set: { assignedAt: new Date() } }
      );
      res.json({ message: `Unassigned ${result.modifiedCount} lead(s)`, modifiedCount: result.modifiedCount });
      return;
    }

    // Verify BDM exists
    const bdm = await User.findById(bdmId);
    if (!bdm) {
      res.status(404).json({ error: 'BDM not found' });
      return;
    }

    // Update all leads. Clearing bdmName here too — it's the original CSV-imported team-member
    // name (see backfillBdmName.ts), and once a lead has a real assignedTo it should no longer
    // also count toward that historical name in getLeadBdmNames' "by original CSV name" bucket.
    const result = await Lead.updateMany(
      { _id: { $in: leadIds } },
      {
        $set: {
          assignedTo: bdmId,
          assignedAt: new Date()
        },
        $unset: { bdmName: '' }
      }
    );

    // Notify the BDM
    try {
      await createAndEmitNotification(
        bdmId,
        'Leads Assigned to You',
        `${result.modifiedCount} lead(s) have been assigned to you`,
        'info'
      );
    } catch (notifErr) {
      console.error('Notification error on assignLeads:', notifErr);
    }

    res.json({
      message: `Successfully assigned ${result.modifiedCount} lead(s) to ${bdm.name}`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error assigning leads:', error);
    res.status(500).json({ error: 'Failed to assign leads' });
  }
};
