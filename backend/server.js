require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./database');
const errorMiddleware = require('./middleware/errorMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const patientRoutes = require('./routes/patientRoutes');
const aiRoutes = require('./routes/aiRoutes');
const medicalRecordRoutes = require('./routes/medicalRecordRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const profileRoutes = require('./routes/profileRoutes');
const prescriptionRoutes = require('./routes/prescriptionRoutes');
const blockchainRoutes = require('./routes/blockchainRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

function isValidAgoraAppId(appId) {
  return /^[A-Za-z0-9]{32}$/.test(appId);
}

function getConsultationStartupMode() {
  const appId = String(process.env.AGORA_APP_ID || '').trim();
  const appCertificate = String(process.env.AGORA_APP_CERTIFICATE || '').trim();
  const forceDemoMode = String(process.env.CONSULTATION_FORCE_DEMO_MODE || '').toLowerCase() === 'true';

  if (forceDemoMode) {
    return 'demo (forced by CONSULTATION_FORCE_DEMO_MODE)';
  }

  if (isValidAgoraAppId(appId) && appCertificate) {
    return 'live Agora';
  }

  return 'demo (invalid or missing Agora credentials)';
}

// Connect to MongoDB
connectDB();

// Security Middleware
app.use(helmet());

// CORS - Must be before rate limiting
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for development - 1000 requests per 15 min
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

// Apply rate limiting to auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Increased for development
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  }
});

app.use('/api/', limiter);
app.use('/api/auth', authLimiter);

// Body parsing
// Capture raw body for Razorpay webhook signature verification BEFORE json parsing
app.use((req, res, next) => {
  if (req.path === '/api/payment/webhook') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      req.rawBody = data;
      try { req.body = JSON.parse(data); } catch { req.body = {}; }
      next();
    });
  } else {
    next();
  }
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Get IP address from request
app.use((req, res, next) => {
  req.ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  next();
});

// Serve audio files as static assets
app.use('/audio', express.static(require('path').join(__dirname, 'uploads/audio'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payment', paymentRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorMiddleware);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║           MedChain Backend Server                 ║
╠═══════════════════════════════════════════════════╣
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(34)}║
║  Port: ${PORT.toString().padEnd(41)}║
║  Frontend URL: ${(process.env.FRONTEND_URL || 'http://localhost:3000').padEnd(33)}║
║  Consultation: ${getConsultationStartupMode().padEnd(32)}║
╚═══════════════════════════════════════════════════╝

Available Routes:
  POST /api/auth/hospital/register   - Register hospital + admin
  POST /api/auth/doctor/register     - Register doctor (pending approval)
  POST /api/auth/patient/request-otp - Request OTP for patient
  POST /api/auth/patient/verify-otp  - Verify OTP & login/register
  POST /api/auth/login               - Email/password login
  POST /api/auth/refresh             - Refresh access token
  GET  /api/auth/me                  - Get current user
  
  GET  /api/hospital/applications/pending - Pending doctor applications
  POST /api/hospital/applications/:id/approve - Approve doctor
  POST /api/hospital/applications/:id/reject  - Reject doctor
  GET  /api/hospital/doctors         - List hospital doctors
  GET  /api/hospital/profile         - Hospital profile
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

module.exports = app;