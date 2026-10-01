import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const UserSchema = new mongoose.Schema({
  name: String,
  firstName: String,
  lastName: String,
}, { strict: false });

const User = mongoose.model('User', UserSchema);

// Aroni's profile-edit set lastName to "." and firstName had a trailing space, so
// updateProfile's `${firstName} ${lastName}`.trim() produced "Aroni  ." everywhere the
// name is displayed (Lead Center badges, filters, sidebars, etc).
const ARONI_USER_ID = '6a4a477e9e7f52534dfa43b2';

async function fixAroniName() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    const result = await User.updateOne(
      { _id: ARONI_USER_ID, email: 'aroni.luminedge@gmail.com' },
      { $set: { name: 'Aroni', firstName: 'Aroni', lastName: '' } }
    );
    console.log(`Fixed Aroni name: ${result.modifiedCount} modified`);

    console.log('Finished fixing Aroni name');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing Aroni name:', error);
    process.exit(1);
  }
}

fixAroniName();
