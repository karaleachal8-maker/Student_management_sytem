/**
 * Model Context Protocol (MCP) Server for Student Information Management System
 * 
 * Standards & Specifications:
 * - Official SDK: @modelcontextprotocol/sdk
 * - Transport: Streamable HTTP (Node.js compatible)
 * - Architecture: Reuses existing Mongoose Student model and Atlas connection
 * - RBAC & Security: JWT / MCP_API_KEY authorization for record mutations and contact info protection
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('crypto');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const Student = require('../models/Student');

// Context storage for incoming HTTP request headers in async tool callbacks
const requestContext = new AsyncLocalStorage();

// Secret configuration
const JWT_SECRET = process.env.JWT_SECRET || 'sims-mcp-default-dev-secret-do-not-use-in-production';
const MCP_API_KEY = process.env.MCP_API_KEY || null;

/**
 * Helper: Check database connection status
 */
const isDbConnected = () => mongoose.connection.readyState === 1;

/**
 * Authentication and Role-Based Access Control (RBAC) Helper
 * Extracts token from either:
 * 1. Tool argument `authToken`
 * 2. HTTP Authorization header (Bearer token)
 * 3. HTTP X-API-Key header
 */
const verifyAuthorization = (explicitToken = null, allowedRoles = ['admin', 'staff', 'faculty']) => {
  let token = explicitToken;

  if (!token) {
    const store = requestContext.getStore();
    if (store && store.req) {
      const authHeader = store.req.headers['authorization'] || store.req.headers['x-authorization'];
      const apiKeyHeader = store.req.headers['x-api-key'];

      if (apiKeyHeader && MCP_API_KEY && apiKeyHeader === MCP_API_KEY) {
        return { authorized: true, role: 'admin', user: 'api-key-client' };
      }

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (authHeader) {
        token = authHeader.trim();
      }
    }
  }

  // Check direct MCP_API_KEY match
  if (token && MCP_API_KEY && token === MCP_API_KEY) {
    return { authorized: true, role: 'admin', user: 'api-key-client' };
  }

  if (!token) {
    return {
      authorized: false,
      reason: 'Missing authentication credentials. Please provide a Bearer JWT token or MCP_API_KEY.',
    };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userRole = decoded.role || 'student';

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return {
        authorized: false,
        reason: `Insufficient permissions. Role "${userRole}" is not authorized. Required: [${allowedRoles.join(', ')}]`,
      };
    }

    return { authorized: true, role: userRole, user: decoded.sub || decoded.email || 'authenticated-user' };
  } catch (err) {
    return {
      authorized: false,
      reason: `Invalid or expired token: ${err.message}`,
    };
  }
};

/**
 * Sanitize student object:
 * Masks student phone/contact for unauthorized/public requests to protect PII.
 */
const sanitizeStudent = (student, isAuth = false) => {
  const doc = student.toObject ? student.toObject() : { ...student };
  if (!isAuth && doc.contact) {
    // Mask contact for privacy (leave last 4 digits if longer than 4)
    const cleaned = String(doc.contact).trim();
    if (cleaned.length > 4) {
      doc.contact = '***-***-' + cleaned.slice(-4);
    } else {
      doc.contact = '***(protected)***';
    }
  }
  return doc;
};

// Supported departments list matching Student model
const SUPPORTED_DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Mechanical Engineering',
  'Electrical Engineering',
  'Civil Engineering',
  'Business Administration',
  'Data Science',
  'Artificial Intelligence',
];

/**
 * Initialize and configure McpServer instance
 */
function createStudentMcpServer() {
  const server = new McpServer(
    {
      name: 'student-information-management-mcp',
      version: '1.0.0',
    },
    {
      instructions: 'MCP Server for managing college student records with MongoDB Atlas. Reuses existing Student schemas and RBAC validation.',
    }
  );

  // ==========================================
  // Tool 1: list_students
  // ==========================================
  server.tool(
    'list_students',
    'List all registered student records with optional department, semester filtering, and pagination.',
    {
      department: z.string().optional().describe('Filter by academic department (e.g. "Computer Science")'),
      semester: z.number().int().min(1).max(8).optional().describe('Filter by semester (1 to 8)'),
      limit: z.number().int().min(1).max(100).optional().default(50).describe('Maximum number of students to return (default: 50)'),
      skip: z.number().int().min(0).optional().default(0).describe('Number of records to skip for pagination (default: 0)'),
      authToken: z.string().optional().describe('Optional JWT or API key to unmask sensitive contact numbers'),
    },
    async (args) => {
      try {
        if (!isDbConnected()) {
          return {
            content: [{ type: 'text', text: 'Error: MongoDB database is not connected. Please verify MONGODB_URI in environment variables.' }],
            isError: true,
          };
        }

        const filter = {};
        if (args.department && args.department.trim()) {
          filter.department = args.department.trim();
        }
        if (args.semester !== undefined && args.semester !== null) {
          filter.semester = Number(args.semester);
        }

        const limit = args.limit || 50;
        const skip = args.skip || 0;

        const auth = verifyAuthorization(args.authToken, ['admin', 'staff', 'faculty', 'student']);
        const students = await Student.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit);

        const total = await Student.countDocuments(filter);
        const sanitized = students.map((s) => sanitizeStudent(s, auth.authorized));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  count: sanitized.length,
                  totalInFilter: total,
                  pagination: { limit, skip },
                  contactInfoProtected: !auth.authorized,
                  data: sanitized,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error fetching students: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Tool 2: get_student_by_id
  // ==========================================
  server.tool(
    'get_student_by_id',
    'Retrieve a single student by their unique studentId (e.g., "STU-1001") or MongoDB ObjectId.',
    {
      identifier: z.string().min(1).describe('Student ID (e.g. "STU-1001") or 24-character MongoDB ObjectId'),
      authToken: z.string().optional().describe('Optional JWT or API key to unmask sensitive contact number'),
    },
    async (args) => {
      try {
        if (!isDbConnected()) {
          return {
            content: [{ type: 'text', text: 'Error: Database is disconnected. Verify MONGODB_URI.' }],
            isError: true,
          };
        }

        const id = args.identifier.trim();
        let student = await Student.findOne({ studentId: { $regex: new RegExp(`^${id}$`, 'i') } });

        if (!student && mongoose.Types.ObjectId.isValid(id)) {
          student = await Student.findById(id);
        }

        if (!student) {
          return {
            content: [{ type: 'text', text: `Student with identifier "${id}" not found in database.` }],
            isError: true,
          };
        }

        const auth = verifyAuthorization(args.authToken, ['admin', 'staff', 'faculty', 'student']);
        const sanitized = sanitizeStudent(student, auth.authorized);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, contactInfoProtected: !auth.authorized, data: sanitized }, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error retrieving student record: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Tool 3: search_students
  // ==========================================
  server.tool(
    'search_students',
    'Search students across name, studentId, email, and department.',
    {
      query: z.string().min(1).describe('Keyword or search string'),
      limit: z.number().int().min(1).max(50).optional().default(20).describe('Max results to return'),
      authToken: z.string().optional().describe('Optional JWT or API key to unmask contact details'),
    },
    async (args) => {
      try {
        if (!isDbConnected()) {
          return {
            content: [{ type: 'text', text: 'Error: Database is disconnected.' }],
            isError: true,
          };
        }

        const searchRegex = new RegExp(args.query.trim(), 'i');
        const filter = {
          $or: [
            { studentId: searchRegex },
            { name: searchRegex },
            { email: searchRegex },
            { department: searchRegex },
          ],
        };

        const limit = args.limit || 20;
        const students = await Student.find(filter).sort({ createdAt: -1 }).limit(limit);

        const auth = verifyAuthorization(args.authToken, ['admin', 'staff', 'faculty', 'student']);
        const sanitized = students.map((s) => sanitizeStudent(s, auth.authorized));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  query: args.query,
                  count: sanitized.length,
                  contactInfoProtected: !auth.authorized,
                  data: sanitized,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error searching students: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Tool 4: add_student (RBAC Protected)
  // ==========================================
  server.tool(
    'add_student',
    'Register a new student record. Requires authorization with role "admin", "staff", or "faculty".',
    {
      studentId: z.string().min(2).describe('Unique Student ID (e.g. "STU-1008")'),
      name: z.string().min(2).describe('Full name of the student'),
      email: z.string().email().describe('Valid student email address'),
      department: z.enum([
        'Computer Science',
        'Information Technology',
        'Mechanical Engineering',
        'Electrical Engineering',
        'Civil Engineering',
        'Business Administration',
        'Data Science',
        'Artificial Intelligence',
      ]).describe('Academic department'),
      semester: z.number().int().min(1).max(8).describe('Numeric semester between 1 and 8'),
      contact: z.string().optional().default('').describe('Optional phone/contact number'),
      authToken: z.string().optional().describe('JWT Bearer token or MCP_API_KEY with admin/staff/faculty privileges'),
    },
    async (args) => {
      try {
        if (!isDbConnected()) {
          return {
            content: [{ type: 'text', text: 'Error: Database connection not established.' }],
            isError: true,
          };
        }

        // RBAC Verification
        const auth = verifyAuthorization(args.authToken, ['admin', 'staff', 'faculty']);
        if (!auth.authorized) {
          return {
            content: [{ type: 'text', text: `Authorization Failed: ${auth.reason}` }],
            isError: true,
          };
        }

        const formattedId = args.studentId.trim().toUpperCase();
        const formattedEmail = args.email.trim().toLowerCase();

        // Duplicate checks matching studentController.js
        const existingStudent = await Student.findOne({ studentId: formattedId });
        if (existingStudent) {
          return {
            content: [{ type: 'text', text: `Validation Error: Student with ID "${formattedId}" already exists.` }],
            isError: true,
          };
        }

        const existingEmail = await Student.findOne({ email: formattedEmail });
        if (existingEmail) {
          return {
            content: [{ type: 'text', text: `Validation Error: Email "${formattedEmail}" is already registered.` }],
            isError: true,
          };
        }

        const newStudent = await Student.create({
          studentId: formattedId,
          name: args.name.trim(),
          email: formattedEmail,
          department: args.department.trim(),
          semester: Number(args.semester),
          contact: args.contact ? args.contact.trim() : '',
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: 'Student record registered successfully via MCP',
                  registeredBy: auth.user,
                  role: auth.role,
                  data: newStudent,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error registering student: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ==========================================
  // Tool 5: update_student (RBAC Protected)
  // ==========================================
  server.tool(
    'update_student',
    'Update existing student details. Requires authorization with role "admin" or "staff".',
    {
      identifier: z.string().min(1).describe('Student ID (e.g. "STU-1001") or MongoDB ObjectId to update'),
      name: z.string().min(2).optional().describe('Updated student name'),
      email: z.string().email().optional().describe('Updated email address'),
      department: z.enum([
        'Computer Science',
        'Information Technology',
        'Mechanical Engineering',
        'Electrical Engineering',
        'Civil Engineering',
        'Business Administration',
        'Data Science',
        'Artificial Intelligence',
      ]).optional().describe('Updated department'),
      semester: z.number().int().min(1).max(8).optional().describe('Updated semester (1 to 8)'),
      contact: z.string().optional().describe('Updated phone/contact number'),
      authToken: z.string().optional().describe('JWT Bearer token or MCP_API_KEY with admin/staff privileges'),
    },
    async (args) => {
      try {
        if (!isDbConnected()) {
          return {
            content: [{ type: 'text', text: 'Error: Database connection not established.' }],
            isError: true,
          };
        }

        // RBAC Verification
        const auth = verifyAuthorization(args.authToken, ['admin', 'staff']);
        if (!auth.authorized) {
          return {
            content: [{ type: 'text', text: `Authorization Failed: ${auth.reason}` }],
            isError: true,
          };
        }

        const id = args.identifier.trim();
        let student = await Student.findOne({ studentId: { $regex: new RegExp(`^${id}$`, 'i') } });

        if (!student && mongoose.Types.ObjectId.isValid(id)) {
          student = await Student.findById(id);
        }

        if (!student) {
          return {
            content: [{ type: 'text', text: `Cannot update: Student record "${id}" not found in database.` }],
            isError: true,
          };
        }

        // Duplicate checks if changing studentId or email
        if (args.email && args.email.trim().toLowerCase() !== student.email) {
          const newEmail = args.email.trim().toLowerCase();
          const duplicate = await Student.findOne({ email: newEmail });
          if (duplicate && duplicate._id.toString() !== student._id.toString()) {
            return {
              content: [{ type: 'text', text: `Cannot update: Email "${newEmail}" is already used by another student.` }],
              isError: true,
            };
          }
          student.email = newEmail;
        }

        if (args.name) student.name = args.name.trim();
        if (args.department) student.department = args.department.trim();
        if (args.semester !== undefined && args.semester !== null) student.semester = Number(args.semester);
        if (args.contact !== undefined) student.contact = args.contact.trim();

        const updated = await student.save();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Student record "${updated.studentId}" updated successfully via MCP`,
                  updatedBy: auth.user,
                  role: auth.role,
                  data: updated,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error updating student record: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

/**
 * Configure Express Router for MCP
 */
function createMcpRouter() {
  const router = express.Router();
  const mcpServer = createStudentMcpServer();

  let activeSessionId = null;

  // Create Streamable HTTP Transport with session management
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => {
      activeSessionId = randomUUID();
      return activeSessionId;
    },
  });

  // Connect transport to MCP server
  const connectionPromise = mcpServer.connect(transport);
  connectionPromise.catch((err) => {
    console.error('❌ Failed to connect MCP Streamable HTTP transport:', err);
  });

  // Health check endpoint for MCP
  router.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({
      status: 'OK',
      service: 'Model Context Protocol (MCP) Server',
      protocol: 'Model Context Protocol (2024-11-05)',
      transport: 'Streamable HTTP (Stateless)',
      databaseStatus: dbStatus,
      tools: [
        'list_students',
        'get_student_by_id',
        'search_students',
        'add_student',
        'update_student',
      ],
      rbac: {
        readOperations: 'Public (sensitive contact masked unless authenticated)',
        mutationOperations: 'Protected (requires JWT or MCP_API_KEY with admin/staff/faculty role)',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Helper auth token generator endpoint for development / local testing
  router.post('/auth/generate-token', (req, res) => {
    const { role = 'admin', email = 'admin@college.edu', sub = 'admin-user' } = req.body || {};
    const token = jwt.sign({ sub, email, role }, JWT_SECRET, { expiresIn: '12h' });
    res.status(200).json({
      success: true,
      role,
      token,
      usage: 'Pass in Authorization: Bearer <token> header or in "authToken" tool argument',
    });
  });

  // Main Streamable HTTP MCP endpoint (handles GET SSE and POST JSON-RPC)
  router.all('/', async (req, res) => {
    try {
      await connectionPromise;

      // Intercept setHeader to track any newly generated Session IDs
      const originalSetHeader = res.setHeader.bind(res);
      res.setHeader = (name, value) => {
        if (name && name.toLowerCase() === 'mcp-session-id' && value) {
          activeSessionId = value;
        }
        return originalSetHeader(name, value);
      };

      // If client omitted Mcp-Session-Id header on non-initialize requests, auto-attach active session
      if (!req.headers['mcp-session-id'] && activeSessionId && req.body && req.body.method !== 'initialize') {
        req.headers['mcp-session-id'] = activeSessionId;
      }

      // Preserve request context for RBAC extraction in tool callbacks
      await requestContext.run({ req, res }, async () => {
        await transport.handleRequest(req, res, req.body);
      });
    } catch (err) {
      console.error('Error handling MCP request:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: `Internal MCP Transport Error: ${err.message}`,
          },
          id: null,
        });
      }
    }
  });

  return { router, mcpServer };
}

// Standalone execution support (e.g. for Render Docker container or "npm run mcp")
if (require.main === module || process.argv[1]?.includes('mcpServer.js')) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Connect database
  connectDB();

  const { router } = createMcpRouter();

  // Mount at both /mcp and / for maximum compatibility with remote clients
  app.use('/mcp', router);
  app.get('/health', (req, res) => {
    res.redirect('/mcp/health');
  });

  // Root welcome
  app.get('/', (req, res) => {
    res.status(200).json({
      service: 'Student Information Management System - Scalable MCP Container',
      documentation: 'Model Context Protocol server listening for Streamable HTTP requests.',
      healthCheck: '/mcp/health',
      mcpEndpoint: '/mcp',
    });
  });

  const PORT = process.env.PORT || process.env.MCB_PORT || 6000;
  app.listen(PORT, () => {
    console.log('====================================================');
    console.log('🚀 Model Context Protocol (MCP) Server Running');
    console.log(`📡 Listening on Port: ${PORT}`);
    console.log(`🩺 Health check: http://localhost:${PORT}/mcp/health`);
    console.log(`🌐 Streamable HTTP Endpoint: http://localhost:${PORT}/mcp`);
    console.log('====================================================');
  });
}

const { router: mcpRouter, mcpServer } = createMcpRouter();

module.exports = {
  mcpRouter,
  mcpServer,
  createStudentMcpServer,
  createMcpRouter,
  verifyAuthorization,
};
