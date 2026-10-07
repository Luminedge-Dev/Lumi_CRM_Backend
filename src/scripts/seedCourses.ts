import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Course from '../models/Course';
import { assertScriptSafe } from './scriptGuard';

dotenv.config();

const courses = [
    {
        name: 'IELTS Preparation',
        testType: 'IELTS',
        description: 'Comprehensive IELTS preparation covering all four modules: Listening, Reading, Writing, and Speaking.',
        durationMonths: 3,
        enrolledCount: 45,
        capacity: 50,
        startDate: new Date('2025-11-15'),
        price: 15000,
        currency: 'BDT',
        isActive: true
    },
    {
        name: 'PTE Academic',
        testType: 'PTE',
        description: 'Complete PTE Academic training with AI-powered practice tests and personalized feedback.',
        durationMonths: 2,
        enrolledCount: 32,
        capacity: 40,
        startDate: new Date('2025-11-20'),
        price: 18000,
        currency: 'BDT',
        isActive: true
    },
    {
        name: 'GRE Test Prep',
        testType: 'GRE',
        description: 'Advanced GRE preparation focusing on Verbal Reasoning, Quantitative Reasoning, and Analytical Writing.',
        durationMonths: 4,
        enrolledCount: 28,
        capacity: 35,
        startDate: new Date('2025-11-25'),
        price: 22000,
        currency: 'BDT',
        isActive: true
    },
    {
        name: 'TOEFL iBT Course',
        testType: 'TOEFL',
        description: 'Intensive TOEFL iBT course with mock tests and expert guidance for all test sections.',
        durationMonths: 3,
        enrolledCount: 38,
        capacity: 45,
        startDate: new Date('2025-12-01'),
        price: 20000,
        currency: 'BDT',
        isActive: true
    },
];

const RESET_FLAG = '--reset';
const RESET_CONFIRM_FLAG = '--yes-delete-all-courses';

const seedCourses = async () => {
    try {
        const reset = process.argv.includes(RESET_FLAG);
        if (reset && !process.argv.includes(RESET_CONFIRM_FLAG)) {
            console.error(
                `[seedCourses] REFUSED: ${RESET_FLAG} deletes every course. ` +
                `Pass ${RESET_CONFIRM_FLAG} as well to confirm. Nothing was connected or changed.`,
            );
            process.exit(1);
        }

        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_luminedge';
        assertScriptSafe('seedCourses', { uri: mongoURI, writes: true });
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB');

        if (reset) {
            // Destructive path: only reachable with both flags, and still behind scriptGuard.
            const deleted = await Course.deleteMany({});
            console.log(`Reset mode: deleted ${deleted.deletedCount} existing courses`);
            const inserted = await Course.insertMany(courses);
            console.log(`Inserted: ${inserted.length}`);
        } else {
            // Default: idempotent, non-destructive. Courses are matched by name and only created when
            // missing ($setOnInsert), so existing courses and admin edits are never overwritten.
            // timestamps:false keeps mongoose from touching updatedAt on courses that already exist.
            const result = await Course.bulkWrite(
                courses.map((course) => ({
                    updateOne: {
                        filter: { name: course.name },
                        update: { $setOnInsert: course },
                        upsert: true,
                        timestamps: false,
                    },
                })),
            );
            console.log(`Inserted: ${result.upsertedCount}`);
            console.log(`Existing (left untouched): ${result.matchedCount}`);
            console.log(`Modified: ${result.modifiedCount}`);
            console.log(`Total processed: ${courses.length}`);
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error seeding courses:', error);
        process.exit(1);
    }
};

seedCourses();
