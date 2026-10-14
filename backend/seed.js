const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Student = require('./models/Student');
const connectDB = require('./config/db');

dotenv.config();

const sampleStudents = [
  {
    studentId: 'STU-1001',
    name: 'Eleanor Vance',
    email: 'eleanor.vance@university.edu',
    department: 'Computer Science',
    semester: 4,
    contact: '+1 (555) 234-5678',
  },
  {
    studentId: 'STU-1002',
    name: 'Marcus Chen',
    email: 'marcus.chen@university.edu',
    department: 'Information Technology',
    semester: 6,
    contact: '+1 (555) 345-6789',
  },
  {
    studentId: 'STU-1003',
    name: 'Sophia Rodriguez',
    email: 'sophia.rodriguez@university.edu',
    department: 'Data Science',
    semester: 2,
    contact: '+1 (555) 456-7890',
  },
  {
    studentId: 'STU-1004',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@university.edu',
    department: 'Artificial Intelligence',
    semester: 5,
    contact: '+1 (555) 567-8901',
  },
  {
    studentId: 'STU-1005',
    name: 'Emma Watson',
    email: 'emma.watson@university.edu',
    department: 'Business Administration',
    semester: 3,
    contact: '+1 (555) 678-9012',
  },
];

const seedDatabase = async () => {
  try {
    await connectDB();

    const existingCount = await Student.countDocuments();
    if (existingCount > 0) {
      console.log(`ℹ️ Database already has ${existingCount} student record(s). Skipping seed to preserve data.`);
      process.exit(0);
    }

    await Student.insertMany(sampleStudents);
    console.log(`🌱 Successfully seeded ${sampleStudents.length} sample students into MongoDB Atlas!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  }
};

seedDatabase();
