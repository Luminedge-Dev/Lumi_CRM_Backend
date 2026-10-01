import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import Lead from '../models/Lead';
import { canonicalizePhoneValue } from '../utils/phone.util';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_db';
const LEADS_DIR = path.join(__dirname, '../../../leads');
const COMMIT = process.argv.includes('--commit');
const BATCH_SIZE = 1000;

interface CsvRow {
  'Team Member'?: string;
  'Mobile/WhatsApp'?: string;
}

function loadPhoneToBdmName(): Map<string, string> {
  const files = fs.readdirSync(LEADS_DIR).filter((f) => f.toLowerCase().endsWith('.csv'));
  const map = new Map<string, string>();

  for (const file of files) {
    const content = fs.readFileSync(path.join(LEADS_DIR, file), 'utf-8').replace(/^﻿/, '');
    const records: CsvRow[] = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    for (const r of records) {
      const teamMember = (r['Team Member'] ?? '').trim();
      if (!teamMember) continue;
      const canonicalPhone = canonicalizePhoneValue(r['Mobile/WhatsApp'] ?? '', '+880');
      if (!canonicalPhone) continue;
      map.set(canonicalPhone, teamMember);
    }
  }

  return map;
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB${COMMIT ? ' (COMMIT MODE)' : ' (dry run — no writes)'}`);

  const phoneToBdmName = loadPhoneToBdmName();
  console.log(`Loaded ${phoneToBdmName.size} phone -> Team Member mappings from CSVs`);

  const existing = await Lead.find({ phone: { $in: [...phoneToBdmName.keys()] } }, '_id phone bdmName assignedTo').lean();
  console.log(`Matched ${existing.length} existing leads by phone`);

  let toUpdate = 0;
  let alreadySet = 0;
  const ops: any[] = [];
  const byName = new Map<string, number>();

  for (const lead of existing) {
    const bdmName = phoneToBdmName.get(lead.phone);
    if (!bdmName) continue;
    if (lead.bdmName === bdmName) { alreadySet++; continue; }

    toUpdate++;
    byName.set(bdmName, (byName.get(bdmName) ?? 0) + 1);
    ops.push({ updateOne: { filter: { _id: lead._id }, update: { $set: { bdmName } } } });
  }

  console.log('\n=== Backfill summary ===');
  console.log(`Leads to update:   ${toUpdate}`);
  console.log(`Already up to date: ${alreadySet}`);
  console.log('\nPer-name breakdown:');
  for (const [name, count] of [...byName.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name.padEnd(20)} ${count}`);
  }

  if (!COMMIT) {
    console.log('\nDry run complete — no documents were written. Re-run with --commit to apply.');
    await mongoose.disconnect();
    return;
  }

  console.log(`\nCommitting ${ops.length} updates in batches of ${BATCH_SIZE}...`);
  let modified = 0;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = ops.slice(i, i + BATCH_SIZE);
    const result = await Lead.bulkWrite(batch, { ordered: false });
    modified += result.modifiedCount;
    console.log(`  ...${Math.min(i + BATCH_SIZE, ops.length)}/${ops.length}`);
  }

  console.log(`\nDone. Modified: ${modified}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
