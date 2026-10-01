import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const LeadSchema = new mongoose.Schema({
  bdmName: String,
}, { strict: false });

const Lead = mongoose.model('Lead', LeadSchema);

const updates: Record<string, string> = {
  'Md Rahul Islam': 'Rahul',
  'Ann Milli': 'Ann Milli',
  'Aroni Khan': 'Aroni',
  'Jannatul Ferdous Bristy': 'Bristi',
  'Najia Sultana': 'Najia',
  'SHAMSUN NAHAR RAKA': 'Raka',
  'Sheikh Rokan': 'Rokan',
  'Tanjyda Tanha': 'Tanha'
};

async function updateLeadBdmNames() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    for (const [oldName, newName] of Object.entries(updates)) {
      const result = await Lead.updateMany(
        { bdmName: oldName },
        { $set: { bdmName: newName } }
      );
      console.log(`Updated Lead bdmName ${oldName} to ${newName}: ${result.modifiedCount} modified`);
    }

    console.log('Finished updating Lead BDM names');
    process.exit(0);
  } catch (error) {
    console.error('Error updating Lead BDM names:', error);
    process.exit(1);
  }
}

updateLeadBdmNames();
