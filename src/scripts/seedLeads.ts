
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Lead from '../models/Lead';
import User from '../models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_db';

const leadsData = [
    {
        fullName: 'John Smith',
        email: 'john.smith@email.com',
        phone: '+1 234 567 8900',
        source: 'Website',
        serviceInterest: 'IELTS Premium',
        lifecycleStage: 'New Inquiry',
        notes: 'Interested in evening batch',
        assignToEmail: 'john.bdm@luminedge.com'
    },
    {
        fullName: 'Sarah Johnson',
        email: 'sarah.j@email.com',
        phone: '+1 234 567 8901',
        source: 'Reference',
        serviceInterest: 'GRE Portal',
        lifecycleStage: 'Contacted',
        notes: 'Looking for UK universities',
        assignToEmail: 'jane.bdm@luminedge.com'
    },
    {
        fullName: 'Michael Brown',
        email: 'michael.b@email.com',
        phone: '+1 234 567 8902',
        source: 'Others',
        serviceInterest: 'PTE Reg',
        lifecycleStage: 'Trial Class',
        notes: 'Urgent - exam in 2 months',
        assignToEmail: 'robert.bdm@luminedge.com'
    },
    {
        fullName: 'Emily Davis',
        email: 'emily.davis@email.com',
        phone: '+1 234 567 8903',
        source: 'Walk-in',
        serviceInterest: 'TOEFL Premium',
        lifecycleStage: 'Enrolled',
        notes: 'Student visa for Canada',
        assignToEmail: 'jane.bdm@luminedge.com'
    },
    {
        fullName: 'David Wilson',
        email: 'david.w@email.com',
        phone: '+1 234 567 8904',
        source: 'Others',
        serviceInterest: 'GRE Reg',
        lifecycleStage: 'New Inquiry',
        notes: 'Prefers weekend classes',
        assignToEmail: 'john.bdm@luminedge.com'
    },
    {
        fullName: 'Jessica Martinez',
        email: 'jessica.m@email.com',
        phone: '+1 234 567 8905',
        source: 'Phone Call',
        serviceInterest: 'TOEFL Reg',
        lifecycleStage: 'Lost',
        notes: 'Not interested anymore',
        assignToEmail: 'robert.bdm@luminedge.com'
    },
    {
        fullName: 'Robert Taylor',
        email: 'robert.t@email.com',
        phone: '+1 234 567 8906',
        source: 'Website',
        serviceInterest: 'Duolingo Reg',
        lifecycleStage: 'Contacted',
        notes: 'Interested in USA universities',
        assignToEmail: 'john.bdm@luminedge.com'
    },
    {
        fullName: 'Amanda White',
        email: 'amanda.w@email.com',
        phone: '+1 234 567 8907',
        source: 'Reference',
        serviceInterest: 'IELTS Reg',
        lifecycleStage: 'Trial Class',
        notes: 'Ready to enroll',
        assignToEmail: 'jane.bdm@luminedge.com'
    }
];

const seedLeads = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        for (const data of leadsData) {
            const existingLead = await Lead.findOne({ email: data.email });
            if (existingLead) {
                console.log(`Lead ${data.email} already exists`);
                continue;
            }

            // Find assigned user
            const assignedUser = await User.findOne({ email: data.assignToEmail });

            await Lead.create({
                fullName: data.fullName,
                email: data.email,
                phone: data.phone,
                source: data.source,
                serviceInterest: data.serviceInterest,
                lifecycleStage: data.lifecycleStage,
                notes: data.notes,
                assignedTo: assignedUser ? assignedUser._id : undefined,
                followUps: []
            });
            console.log(`Created lead: ${data.fullName}`);
        }

        console.log('Lead seeding completed');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding leads:', error);
        process.exit(1);
    }
};

seedLeads();
