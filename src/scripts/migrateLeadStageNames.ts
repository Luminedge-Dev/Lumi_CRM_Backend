// Usage:
//   npx ts-node src/scripts/migrateLeadStageNames.ts --dry-run
//   npx ts-node src/scripts/migrateLeadStageNames.ts

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_db';

const STAGE_MIGRATION_MAP: Record<string, string> = {
    'Intake': 'New Inquiry',
    'Processing': 'Contacted',
    'Hot': 'Trial Class',
    'Converted': 'Enrolled',
    'Dead': 'Lost'
};

const migrateLeadStageNames = async () => {
    try {
        const isDryRun = process.argv.includes('--dry-run');

        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const collection = mongoose.connection.db!.collection('leads');

        for (const [oldValue, newValue] of Object.entries(STAGE_MIGRATION_MAP)) {
            if (isDryRun) {
                const count = await collection.countDocuments({ lifecycleStage: oldValue });
                console.log(`[DRY RUN] ${count} lead(s) would be migrated from "${oldValue}" to "${newValue}"`);
            } else {
                const result = await collection.updateMany(
                    { lifecycleStage: oldValue },
                    { $set: { lifecycleStage: newValue } }
                );
                console.log(`Migrated ${result.modifiedCount} lead(s) from "${oldValue}" to "${newValue}"`);
            }
        }

        const strayCount = await collection.countDocuments({
            lifecycleStage: { $nin: Object.values(STAGE_MIGRATION_MAP) }
        });

        if (isDryRun) {
            console.log(`[DRY RUN] ${strayCount} lead(s) currently have a lifecycleStage not already matching a new value (includes leads pending migration above).`);
        } else if (strayCount > 0) {
            const strayDocs = await collection.find({
                lifecycleStage: { $nin: Object.values(STAGE_MIGRATION_MAP) }
            }).limit(5).toArray();
            console.warn(`Warning: ${strayCount} lead(s) have an unexpected lifecycleStage after migration. Sample:`);
            strayDocs.forEach((doc: any) => {
                console.warn(`  _id: ${doc._id}, fullName: ${doc.fullName}, lifecycleStage: ${doc.lifecycleStage}`);
            });
        }

        console.log('Lead stage migration completed');
        process.exit(0);
    } catch (error) {
        console.error('Error migrating lead stage names:', error);
        process.exit(1);
    }
};

migrateLeadStageNames();
