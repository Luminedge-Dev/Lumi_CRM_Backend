import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

const createUser = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_luminedge';
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB');

        // User details — set via environment variables
        const email = process.env.SEED_EMAIL;
        const password = process.env.SEED_PASSWORD;
        const name = process.env.SEED_NAME || 'Admin';
        const role = process.env.SEED_ROLE || 'admin';

        if (!email || !password) {
            console.error('Error: SEED_EMAIL and SEED_PASSWORD environment variables are required.');
            process.exit(1);
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            console.log(`User ${email} already exists. Updating password...`);
            const passwordHash = await bcrypt.hash(password, 10);
            existingUser.passwordHash = passwordHash;
            await existingUser.save();
            console.log(`Password updated successfully for ${email}`);
        } else {
            console.log(`Creating new user ${email}...`);
            const passwordHash = await bcrypt.hash(password, 10);
            const user = new User({
                email,
                passwordHash,
                name,
                role,
                isActive: true
            });
            await user.save();
            console.log(`User created successfully: ${email}`);
        }

        console.log(`Role: ${role}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

createUser();
