import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Course from '../models/Course';

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

const seedCourses = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_luminedge';
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB');

        // Clear existing courses
        await Course.deleteMany({});
        console.log('Cleared existing courses');

        // Insert new courses
        await Course.insertMany(courses);
        console.log('Seeded 4 courses successfully');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error seeding courses:', error);
        process.exit(1);
    }
};

seedCourses();
