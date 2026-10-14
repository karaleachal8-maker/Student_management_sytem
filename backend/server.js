const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const studentRoutes = require('./routes/studentRoutes');

// Load environment variables from .env file
dotenv.config();

// Initialize Express App
const app = express();

// Connect to MongoDB Atlas
connectDB();

// ==========================================
// Middleware Configuration
// ==========================================

// Parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS (Cross-Origin Resource Sharing) Configuration
const rawFrontendUrl = process.env.FRONTEND_URL || '*';
const allowedOrigins = rawFrontendUrl
  .split(',')
  .map((url) => {
    const trimmed = url.trim();
    if (trimmed === '*' || !trimmed) return trimmed;
    try {
      return new URL(trimmed).origin;
    } catch {
      return trimmed.replace(/\/+$/, '');
    }
  })
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman) or local file:/// origins ('null')
    if (!origin || origin === 'null') return callback(null, true);

    // If wildcard is allowed
    if (allowedOrigins.includes('*')) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/+$/, '');

    // Always allow localhost and 127.0.0.1 ports during development
    const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin);
    if (isLocal) return callback(null, true);

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from unauthorized Origin: ${origin}`);
      const msg = `The CORS policy for this site does not allow access from Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// Request logging middleware for debugging during development
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// ==========================================
// API Routes
// ==========================================

// Health Check Endpoint (Required by Render & College Demo)
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'OK',
    tier: 'Tier 2 - Application Layer (Express.js on Render)',
    databaseTier: 'Tier 3 - MongoDB Atlas',
    databaseStatus: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

// Root Welcome Route
app.get('/', (req, res) => {
  res.status(200).json({
    message: '🎓 Student Information Management System API (Three-Tier Architecture)',
    documentation: 'See README.md for endpoint specifications',
    healthCheck: '/health',
    apiBase: '/api/students',
  });
});

// Mount Student API Routes
app.use('/api/students', studentRoutes);

// ==========================================
// Error Handling Middleware
// ==========================================

// 404 Route Not Found Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint "${req.originalUrl}" not found on this server.`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ==========================================
// Start Server
// ==========================================
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('====================================================');
  console.log('🚀 Student Information Management System API (Tier 2)');
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API route: http://localhost:${PORT}/api/students`);
  console.log('====================================================');
});

// Handle unhandled promise rejections safely
process.on('unhandledRejection', (err) => {
  console.error('⚠️ Unhandled Rejection:', err.message);
});

module.exports = app;
