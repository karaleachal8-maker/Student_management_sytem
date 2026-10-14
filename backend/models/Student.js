const mongoose = require('mongoose');

/**
 * Student Schema definition matching Three-Tier Architecture specifications:
 * - studentId: unique identifier (e.g. STU-1001)
 * - name: full student name
 * - email: valid student email
 * - department: student's academic department
 * - semester: numeric semester (1 - 8)
 * - contact: optional phone number
 */
const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: [true, 'Student ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please enter a valid email address',
      ],
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      enum: {
        values: [
          'Computer Science',
          'Information Technology',
          'Mechanical Engineering',
          'Electrical Engineering',
          'Civil Engineering',
          'Business Administration',
          'Data Science',
          'Artificial Intelligence',
        ],
        message: '{VALUE} is not a supported department',
      },
    },
    semester: {
      type: Number,
      required: [true, 'Semester is required'],
      min: [1, 'Semester must be between 1 and 8'],
      max: [8, 'Semester must be between 1 and 8'],
    },
    contact: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
    collection: 'students', // Explicit collection name
  }
);

// Clean index automatically managed by unique: true
const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
