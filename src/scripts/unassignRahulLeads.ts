import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Lead from '../models/Lead';
import User from '../models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_db';
const COMMIT = process.argv.includes('--commit');

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected to MongoDB${COMMIT ? ' (COMMIT MODE)' : ' (dry run — no writes)'}`);

  const rahul = await User.findOne({ name: 'Rahul', role: 'bdm' }, '_id name email').lean();
  if (!rahul) {
    console.error('Could not find a User with name "Rahul" and role "bdm" — aborting.');
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Found Rahul: ${rahul._id} (${rahul.email})`);

  const matched = await Lead.countDocuments({ assignedTo: rahul._id });
  console.log(`Leads currently assigned to Rahul: ${matched}`);

  if (!COMMIT) {
    console.log('\nDry run complete — no documents were written. Re-run with --commit to unassign.');
    await mongoose.disconnect();
    return;
  }

  const result = await Lead.updateMany(
    { assignedTo: rahul._id },
    { $unset: { assignedTo: '', bdmName: '' } }
  );
  console.log(`\nDone. Modified: ${result.modifiedCount}`);

  const remaining = await Lead.countDocuments({ assignedTo: rahul._id });
  console.log(`Leads still assigned to Rahul: ${remaining}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Unassign failed:', err);
  process.exit(1);
});
