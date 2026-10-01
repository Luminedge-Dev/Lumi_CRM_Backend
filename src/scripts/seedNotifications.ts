import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Notification from '../models/Notification';

dotenv.config();

const seedNotifications = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log('Connected to MongoDB');

        const users = await User.find({ isActive: true });

        if (users.length === 0) {
            console.log('No users found to seed notifications for.');
            process.exit(0);
        }

        console.log(`Found ${users.length} users. Creating notifications...`);

        const notificationTemplates = [
            {
                title: 'Welcome to CRM',
                message: 'Welcome to your new dashboard! Explore the features.',
                type: 'info'
            },
            {
                title: 'New Lead Assigned',
                message: 'A new lead has been assigned to you. Check the Lead Center.',
                type: 'success'
            },
            {
                title: 'System Update',
                message: 'Scheduled maintenance will occur on Saturday at 10 PM.',
                type: 'warning'
            },
            {
                title: 'Profile Incomplete',
                message: 'Please complete your profile information.',
                type: 'error'
            }
        ];

        let count = 0;
        for (const user of users) {
            // Clear existing notifications for cleanliness if desired, or just append
            // await Notification.deleteMany({ recipient: user._id });

            for (const t of notificationTemplates) {
                await Notification.create({
                    recipient: user._id,
                    title: t.title,
                    message: t.message,
                    type: t.type as any,
                    isRead: false,
                    createdAt: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 3)) // Random time in last 3 days
                });
                count++;
            }
        }

        console.log(`Successfully created ${count} notifications`);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding notifications:', error);
        process.exit(1);
    }
};

seedNotifications();
