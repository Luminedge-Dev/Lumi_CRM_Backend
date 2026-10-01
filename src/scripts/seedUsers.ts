
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_db';

const DEFAULT_SEED_PASSWORD = process.env.SEED_PASSWORD;
if (!DEFAULT_SEED_PASSWORD) {
    console.error('Error: SEED_PASSWORD environment variable is required.');
    process.exit(1);
}

const users = [
    {
        name: 'Admin User',
        email: process.env.SEED_ADMIN_EMAIL || 'admin@luminedge.com',
        password: DEFAULT_SEED_PASSWORD,
        role: 'admin',
        phone: '',
        isActive: true
    },
    {
        name: 'BDM User',
        email: process.env.SEED_BDM_EMAIL || 'bdm@luminedge.com',
        password: DEFAULT_SEED_PASSWORD,
        role: 'bdm',
        phone: '',
        isActive: true
    },
    {
        name: 'Senior BDM User',
        email: process.env.SEED_SENIOR_BDM_EMAIL || 'senior.bdm@luminedge.com',
        password: DEFAULT_SEED_PASSWORD,
        role: 'senior-bdm',
        phone: '',
        isActive: true
    },
    {
        name: 'Junior BDM User',
        email: process.env.SEED_JUNIOR_BDM_EMAIL || 'junior.bdm@luminedge.com',
        password: DEFAULT_SEED_PASSWORD,
        role: 'junior-bdm',
        phone: '',
        isActive: true
    }
];

const seedUsers = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing users? Maybe better to upsert or check existence.
        // For this task, checking existence by email is safer.

        for (const user of users) {
            const existingUser = await User.findOne({ email: user.email });
            if (existingUser) {
                console.log(`User ${user.email} already exists`);
                continue;
            }

            const hashedPassword = await bcrypt.hash(user.password, 10);
            await User.create({
                ...user,
                password: hashedPassword
            });
            console.log(`Created user: ${user.name} (${user.role})`);
        }

        console.log('User seeding completed');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding users:', error);
        process.exit(1);
    }
};

seedUsers();
