import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import Lead from '../models/Lead';
import User from '../models/User';
import { canonicalizePhoneValue } from '../utils/phone.util';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_db';
const LEADS_DIR = path.join(__dirname, '../../../leads');
const COMMIT = process.argv.includes('--commit');
const BATCH_SIZE = 2000;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseCsvDate(value: string): Date | undefined {
  const match = String(value ?? '').trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return undefined;
  const day = parseInt(match[1], 10);
  const month = MONTHS[match[2].toLowerCase()];
  const year = parseInt(match[3], 10);
  if (month === undefined || Number.isNaN(day) || Number.isNaN(year)) return undefined;
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const SOURCE_MAP: Record<string, string> = {
  facebook: 'Facebook',
  'facebook ad': 'Facebook',
  'direct call': 'Phone Call',
  whatsapp: 'WhatsApp',
  walkin: 'Walk-in',
  reference: 'Reference',
  website: 'Website',
  google: 'Google',
  event: 'Event',
  'education team': 'Education Team',
  previous: 'Previous',
};

function mapSource(raw: string): { source: string; fellBackToOther: boolean } {
  const key = String(raw ?? '').trim().toLowerCase();
  const mapped = SOURCE_MAP[key];
  return mapped ? { source: mapped, fellBackToOther: false } : { source: 'Others', fellBackToOther: true };
}

const SERVICE_MAP: Record<string, string> = {
  ielts: 'IELTS Reg',
  'exams reg-ielts': 'IELTS Reg',
  'ielts mock test': 'IELTS Mock Tests',
  pte: 'PTE Reg',
  'exams reg-pte': 'PTE Reg',
  gre: 'GRE Reg',
  'exams reg-gre': 'GRE Reg',
  toefl: 'TOEFL Reg',
  'exams reg-toefl': 'TOEFL Reg',
  duolingo: 'Duolingo Reg',
  ge: 'Basic English',
  // no equivalent service in the current list — left unmapped so these rows are flagged
};

function mapService(raw: string): { serviceInterest: string[]; unmapped?: string } {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return { serviceInterest: [] };
  const mapped = SERVICE_MAP[trimmed.toLowerCase()];
  if (mapped) return { serviceInterest: [mapped] };
  return { serviceInterest: [], unmapped: trimmed };
}

interface CsvRow {
  Date?: string;
  'Team Member'?: string;
  'Lead Source'?: string;
  Services?: string;
  'Lead Note'?: string;
  'Full Name'?: string;
  'Mobile/WhatsApp'?: string;
  'Engagement Note'?: string;
}

interface ParsedRow {
  file: string;
  date?: Date;
  teamMember: string;
  leadSource: string;
  services: string;
  leadNote: string;
  fullName: string;
  phoneRaw: string;
  engagementNote: string;
}

function loadCsvFiles(): ParsedRow[] {
  const files = fs.readdirSync(LEADS_DIR).filter((f) => f.toLowerCase().endsWith('.csv'));
  const rows: ParsedRow[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(LEADS_DIR, file), 'utf-8').replace(/^﻿/, '');
    const records: CsvRow[] = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    for (const r of records) {
      rows.push({
        file,
        date: parseCsvDate(r.Date ?? ''),
        teamMember: (r['Team Member'] ?? '').trim(),
        leadSource: (r['Lead Source'] ?? '').trim(),
        services: (r.Services ?? '').trim(),
        leadNote: (r['Lead Note'] ?? '').trim(),
        fullName: (r['Full Name'] ?? '').trim(),
        phoneRaw: (r['Mobile/WhatsApp'] ?? '').trim(),
        engagementNote: (r['Engagement Note'] ?? '').trim(),
      });
    }
  }

  return rows;
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB${COMMIT ? ' (COMMIT MODE)' : ' (dry run — no writes)'}`);

  const rows = loadCsvFiles();
  console.log(`Loaded ${rows.length} rows from ${LEADS_DIR}`);

  // Team Member name -> User._id lookup (case-insensitive exact match).
  const users = await User.find({}, 'name email _id').lean();
  const userByName = new Map<string, mongoose.Types.ObjectId>();
  for (const u of users) {
    if (u.name) userByName.set(u.name.trim().toLowerCase(), u._id as mongoose.Types.ObjectId);
  }

  // Manual override: confirmed by the user that only "Raka" (CSV) corresponds to an existing
  // User account, stored under a differently-formatted name (" SHAMSUN NAHAR  RAKA"). The other
  // 6 CSV team-member names (Ann Milli, Tanha, Rokan, Bristi, Najia, Aroni) have no matching
  // account yet, so they stay unassigned below — their name is preserved in `notes` instead of
  // being silently discarded.
  const rakaUser = users.find((u) => u.email === 'raka.luminedge@gmail.com');
  if (rakaUser) userByName.set('raka', rakaUser._id as unknown as mongoose.Types.ObjectId);

  // Existing phones already in the DB — "earliest wins" means an existing DB lead always
  // wins over any CSV row with the same canonical phone.
  const existingLeads = await Lead.find({}, 'phone').lean();
  const existingPhones = new Set(existingLeads.map((l) => l.phone).filter(Boolean));

  // Earliest wins: sort ascending by parsed Date (rows with no parseable date sort last).
  rows.sort((a, b) => {
    const at = a.date ? a.date.getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.date ? b.date.getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  const seenPhones = new Set<string>();
  const docs: Record<string, any>[] = [];

  let skippedNoPhone = 0;
  let skippedDupInRun = 0;
  let skippedDupInDb = 0;
  let unmatchedTeamMember = 0;
  let sourceFellBackToOther = 0;
  let serviceUnmapped = 0;
  let missingFullName = 0;
  const perBdmCount = new Map<string, number>();

  for (const row of rows) {
    // All 8 source files are Luminedge Bangladesh lead exports — canonicalize explicitly as
    // Bangladesh rather than auto-detecting, since bare 10-digit numbers with the leading 0
    // stripped (a common Excel/CSV export artifact) would otherwise spuriously match other
    // countries' shorter country codes (e.g. misread as US/+1).
    const canonicalPhone = canonicalizePhoneValue(row.phoneRaw, '+880');
    if (!canonicalPhone) { skippedNoPhone++; continue; }

    if (existingPhones.has(canonicalPhone)) { skippedDupInDb++; continue; }
    if (seenPhones.has(canonicalPhone)) { skippedDupInRun++; continue; }
    seenPhones.add(canonicalPhone);

    if (!row.fullName) missingFullName++;

    const assignedTo = row.teamMember ? userByName.get(row.teamMember.toLowerCase()) : undefined;
    if (row.teamMember && !assignedTo) unmatchedTeamMember++;
    const bdmKey = assignedTo ? row.teamMember : 'Unassigned';
    perBdmCount.set(bdmKey, (perBdmCount.get(bdmKey) ?? 0) + 1);

    const { source, fellBackToOther } = mapSource(row.leadSource);
    if (fellBackToOther) sourceFellBackToOther++;

    const { serviceInterest, unmapped } = mapService(row.services);
    if (unmapped) serviceUnmapped++;

    // Unmatched Team Member names are intentionally NOT stuffed into notes — assignedTo is
    // left genuinely blank, and the admin assigns a BDM directly via the Lead Center's
    // existing BDM column/dropdown.
    const noteParts = [row.leadNote, row.engagementNote];
    if (unmapped) noteParts.push(`[Original service: ${unmapped}]`);
    const notes = noteParts.filter(Boolean).join(' | ');

    const doc: Record<string, any> = {
      phone: canonicalPhone,
      whom: 'Personal',
      source,
    };
    if (row.fullName) doc.fullName = row.fullName;
    if (assignedTo) doc.assignedTo = assignedTo;
    if (serviceInterest.length > 0) doc.serviceInterest = serviceInterest;
    if (notes) doc.notes = notes;
    if (row.date) doc.createdAt = row.date;

    docs.push(doc);
  }

  console.log('\n=== Import summary ===');
  console.log(`Total rows read:          ${rows.length}`);
  console.log(`Skipped (no phone):       ${skippedNoPhone}`);
  console.log(`Skipped (dup in DB):      ${skippedDupInDb}`);
  console.log(`Skipped (dup in CSVs):    ${skippedDupInRun}`);
  console.log(`Rows to import:           ${docs.length}`);
  console.log(`  - missing full name:    ${missingFullName}`);
  console.log(`  - unmatched team member:${unmatchedTeamMember}`);
  console.log(`  - source -> "Other":    ${sourceFellBackToOther}`);
  console.log(`  - service unmapped:     ${serviceUnmapped}`);
  console.log('\nPer-BDM breakdown:');
  for (const [name, count] of [...perBdmCount.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name.padEnd(20)} ${count}`);
  }

  if (!COMMIT) {
    console.log('\nDry run complete — no documents were written. Re-run with --commit to import.');
    await mongoose.disconnect();
    return;
  }

  console.log(`\nCommitting ${docs.length} documents in batches of ${BATCH_SIZE}...`);
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    try {
      const result = await Lead.insertMany(batch, { ordered: false });
      inserted += result.length;
    } catch (err: any) {
      const batchInserted = err?.insertedDocs?.length ?? 0;
      inserted += batchInserted;
      failed += batch.length - batchInserted;
      console.error(`Batch starting at row ${i}: ${err?.message ?? err}`);
    }
    console.log(`  ...${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}`);
  }

  console.log(`\nDone. Inserted: ${inserted}, failed: ${failed}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
