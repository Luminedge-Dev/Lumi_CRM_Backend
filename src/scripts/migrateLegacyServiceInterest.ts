import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Maps legacy serviceInterest values (from before the enum was tightened) to their
// closest current equivalent in Lead.ts's serviceInterest enum.
const LEGACY_MAP: Record<string, string> = {
  'IELTS': 'IELTS Reg',
  'PTE': 'PTE Reg',
  'GRE': 'GRE Reg',
  'TOEFL': 'TOEFL Reg',
  'IELTS Mock Test': 'IELTS Mock Tests',
  'Visa Processing': 'Study Abroad',
};

const VALID = new Set([
  'IELTS Reg', 'PTE Reg', 'TOEFL Reg', 'GRE Reg', 'Duolingo Reg',
  'IELTS Premium', 'IELTS Crash', 'IELTS Intense', 'IELTS 1 Module', 'IELTS 1-on-1', 'IELTS Mock Tests',
  'PTE Premium', 'PTE Crash', 'PTE Intense', 'PTE 1 Module', 'PTE 1-on-1', 'PTE Mock Tests',
  'TOEFL Premium', 'TOEFL Crash', 'TOEFL 1 Module', 'TOEFL 1-on-1', 'TOEFL Mock Tests',
  'GRE Premium', 'GRE Quant', 'GRE Verbal', 'GRE 1-on-1', 'GRE Mock Tests', 'GRE Portal',
  'Basic English', 'Spoken', 'Service Charge', 'SSC English', 'Study Abroad', 'Others',
]);

const isDryRun = process.argv.includes('--dry-run');
const backupDir = path.join(__dirname, '../../migration-backups');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const db = mongoose.connection.db!;
  const collection = db.collection('leads');

  const leads = await collection
    .find({}, { projection: { fullName: 1, serviceInterest: 1 } })
    .toArray();

  const backup: { _id: string; before: string[] }[] = [];
  const ops: any[] = [];
  const unmappedCounts: Record<string, number> = {};

  for (const lead of leads) {
    const before: string[] = Array.isArray(lead.serviceInterest)
      ? lead.serviceInterest
      : lead.serviceInterest
      ? [lead.serviceInterest]
      : [];

    if (before.length === 0) continue;

    let changed = false;
    const mapped = before.map((v) => {
      if (VALID.has(v)) return v;
      if (LEGACY_MAP[v]) {
        changed = true;
        return LEGACY_MAP[v];
      }
      unmappedCounts[v] = (unmappedCounts[v] || 0) + 1;
      changed = true;
      return v; // leave unmapped values untouched, flagged below
    });

    if (!changed) continue;

    // dedupe while preserving order
    const after = Array.from(new Set(mapped));

    backup.push({ _id: lead._id.toString(), before });
    ops.push({
      updateOne: {
        filter: { _id: lead._id },
        update: { $set: { serviceInterest: after } },
      },
    });
  }

  console.log(`Leads needing migration: ${ops.length}`);
  console.log('Unmapped (left as-is) values encountered:', unmappedCounts);
  console.log('Sample changes:', JSON.stringify(
    backup.slice(0, 5).map((b, i) => ({ ...b, after: ops[i].updateOne.update.$set.serviceInterest })),
    null, 2
  ));

  if (isDryRun) {
    console.log('\nDry run only — no changes written.');
    await mongoose.disconnect();
    return;
  }

  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `serviceInterest-backup-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`Backup of ${backup.length} pre-migration values written to ${backupFile}`);

  const BATCH = 1000;
  let done = 0;
  for (let i = 0; i < ops.length; i += BATCH) {
    const batch = ops.slice(i, i + BATCH);
    const result = await collection.bulkWrite(batch);
    done += result.modifiedCount;
    console.log(`Progress: ${Math.min(i + BATCH, ops.length)}/${ops.length}`);
  }

  console.log(`Done. Modified ${done} leads.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
