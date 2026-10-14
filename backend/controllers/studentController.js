const mongoose = require('mongoose');
const Student = require('../models/Student');

/**
 * Helper: Check if MongoDB connection is ready
 */
const isDbConnected = () => {
  return mongoose.connection.readyState === 1; // 1 = connected
};

/**
 * @desc    Get all students (with optional search query)
 * @route   GET /api/students
 * @access  Public
 */
const getStudents = async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database is not connected. Please verify MONGODB_URI in backend/.env or Render environment variables.',
      });
    }

    const { search } = req.query;
    let query = {};

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query = {
        $or: [
          { studentId: searchRegex },
          { name: searchRegex },
          { email: searchRegex },
          { department: searchRegex },
        ],
      };
    }

    const students = await Student.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve students from database',
      error: error.message,
    });
  }
};

/**
 * @desc    Get a single student by studentId or _id
 * @route   GET /api/students/:id
 * @access  Public
 */
const getStudentById = async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database is not connected. Please verify MONGODB_URI configuration.',
      });
    }

    const identifier = req.params.id.trim();

    // Try finding by studentId (case-insensitive) or by MongoDB ObjectId
    let student = await Student.findOne({
      studentId: { $regex: new RegExp(`^${identifier}$`, 'i') },
    });

    if (!student && mongoose.Types.ObjectId.isValid(identifier)) {
      student = await Student.findById(identifier);
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student with ID "${identifier}" not found in database`,
      });
    }

    return res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error('Error fetching student by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving student record',
      error: error.message,
    });
  }
};

/**
 * @desc    Add a new student
 * @route   POST /api/students
 * @access  Public
 */
const createStudent = async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database is not connected. Please configure MONGODB_URI in backend/.env.',
      });
    }

    const { studentId, name, email, department, semester, contact } = req.body;

    // Validate required fields
    if (!studentId || !name || !email || !department || semester === undefined || semester === null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: studentId, name, email, department, and semester.',
      });
    }

    const formattedStudentId = studentId.trim().toUpperCase();

    // Check for duplicate studentId
    const existingStudent = await Student.findOne({ studentId: formattedStudentId });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: `Student with ID "${formattedStudentId}" already exists. Student IDs must be unique.`,
      });
    }

    // Check for duplicate email
    const existingEmail = await Student.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: `Email address "${email.trim()}" is already registered to another student.`,
      });
    }

    // Create student
    const student = await Student.create({
      studentId: formattedStudentId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: department.trim(),
      semester: Number(semester),
      contact: contact ? contact.trim() : '',
    });

    return res.status(201).json({
      success: true,
      message: 'Student record registered successfully in MongoDB Atlas',
      data: student,
    });
  } catch (error) {
    console.error('Error creating student:', error);

    // Mongoose validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. '),
      });
    }

    // Mongo duplicate key error (code 11000)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        message: `A student with this ${field} already exists in the database.`,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create student record in database',
      error: error.message,
    });
  }
};

/**
 * @desc    Update a student record
 * @route   PUT /api/students/:id
 * @access  Public
 */
const updateStudent = async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database is not connected. Please verify MONGODB_URI.',
      });
    }

    const identifier = req.params.id.trim();
    const { studentId, name, email, department, semester, contact } = req.body;

    // Locate target student
    let student = await Student.findOne({
      studentId: { $regex: new RegExp(`^${identifier}$`, 'i') },
    });

    if (!student && mongoose.Types.ObjectId.isValid(identifier)) {
      student = await Student.findById(identifier);
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Cannot update: Student record "${identifier}" was not found`,
      });
    }

    // If changing studentId, check duplicate
    if (studentId && studentId.trim().toUpperCase() !== student.studentId) {
      const newId = studentId.trim().toUpperCase();
      const duplicateId = await Student.findOne({ studentId: newId });
      if (duplicateId && duplicateId._id.toString() !== student._id.toString()) {
        return res.status(400).json({
          success: false,
          message: `Cannot update: Student ID "${newId}" is already taken by another student.`,
        });
      }
      student.studentId = newId;
    }

    // If changing email, check duplicate
    if (email && email.trim().toLowerCase() !== student.email) {
      const newEmail = email.trim().toLowerCase();
      const duplicateEmail = await Student.findOne({ email: newEmail });
      if (duplicateEmail && duplicateEmail._id.toString() !== student._id.toString()) {
        return res.status(400).json({
          success: false,
          message: `Cannot update: Email "${newEmail}" is already used by another student.`,
        });
      }
      student.email = newEmail;
    }

    if (name) student.name = name.trim();
    if (department) student.department = department.trim();
    if (semester !== undefined && semester !== null) student.semester = Number(semester);
    if (contact !== undefined) student.contact = contact.trim();

    const updatedStudent = await student.save();

    return res.status(200).json({
      success: true,
      message: `Student record "${updatedStudent.studentId}" updated successfully`,
      data: updatedStudent,
    });
  } catch (error) {
    console.error('Error updating student:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. '),
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update student record in database',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete a student record
 * @route   DELETE /api/students/:id
 * @access  Public
 */
const deleteStudent = async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database is not connected. Please verify MONGODB_URI.',
      });
    }

    const identifier = req.params.id.trim();

    let student = await Student.findOne({
      studentId: { $regex: new RegExp(`^${identifier}$`, 'i') },
    });

    if (!student && mongoose.Types.ObjectId.isValid(identifier)) {
      student = await Student.findById(identifier);
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Cannot delete: Student "${identifier}" not found in database`,
      });
    }

    await Student.findByIdAndDelete(student._id);

    return res.status(200).json({
      success: true,
      message: `Student "${student.name}" (ID: ${student.studentId}) successfully deleted from MongoDB Atlas`,
      data: {
        id: student._id,
        studentId: student.studentId,
        name: student.name,
      },
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete student from database',
      error: error.message,
    });
  }
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
};
