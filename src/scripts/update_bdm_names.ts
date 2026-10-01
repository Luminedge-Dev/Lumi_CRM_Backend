import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const UserSchema = new mongoose.Schema({
  name: String,
  email: String
}, { strict: false });

const User = mongoose.model('User', UserSchema);

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

async function updateBdmNames() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    for (const [oldName, newName] of Object.entries(updates)) {
      const result = await User.updateMany(
        { name: oldName, role: 'bdm' },
        { $set: { name: newName } }
      );
      console.log(`Updated ${oldName} to ${newName}: ${result.modifiedCount} modified`);
    }

    console.log('Finished updating BDM names');
    process.exit(0);
  } catch (error) {
    console.error('Error updating BDM names:', error);
    process.exit(1);
  }
}

updateBdmNames();
