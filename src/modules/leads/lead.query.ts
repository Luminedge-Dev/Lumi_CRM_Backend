import { escapeRegex, extractPhoneDigits, phoneSearchDigits } from '../../shared/utils/phone';

// Pure query-building helpers for the leads list. No database access here.

const normalizePhoneDigits = extractPhoneDigits;

type Query = Record<string, unknown>;

/**
 * Builds the shared Lead query filter from the query-string params used by both the paginated
 * list and the per-stage counts, so the two stay in sync: a search/BDM/course filter narrows
 * both the table and the stat-card counts. Every value is coerced with String() so a client can
 * never smuggle an operator object into the filter.
 */
export const buildLeadFilter = (query: Query): Record<string, any> => {
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
  // User account — a plain string, not a User reference.
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

/** Typeahead filter: matches a digit prefix of the number or of any comma-separated entry. */
export const phoneSuggestionFilter = (normalizedQuery: string, excludeId?: string): Record<string, any> => {
  const safeQuery = escapeRegex(normalizedQuery);
  const filter: Record<string, any> = {
    phone: { $regex: `^\\+?${safeQuery}|,\\s*\\+?${safeQuery}`, $options: 'i' },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return filter;
};

/** Newest follow-up first, as the lead detail screen expects. */
export const sortFollowUpsDesc = (leadObj: any) => {
  if (Array.isArray(leadObj?.followUps)) {
    leadObj.followUps = [...leadObj.followUps].sort((a: any, b: any) => {
      const bTime = new Date(b.createdAt || b.date || 0).getTime();
      const aTime = new Date(a.createdAt || a.date || 0).getTime();
      return bTime - aTime;
    });
  }
  return leadObj;
};

/** Converts client follow-up entries to stored form, dropping entries with no content. */
export const processFollowUps = (followUps: any): any[] =>
  followUps
    ?.map((fu: any) => ({
      date: fu.date ? new Date(fu.date) : undefined,
      note: fu.note,
      nextFollowUpDate: fu.nextFollowUpDate ? new Date(fu.nextFollowUpDate) : undefined,
    }))
    .filter((fu: any) => fu.date || fu.note || fu.nextFollowUpDate) || [];
