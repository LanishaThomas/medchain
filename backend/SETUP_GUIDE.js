#!/usr/bin/env node

/**
 * MEDCHAIN BACKEND - QUICK START GUIDE
 * 
 * This file provides instructions for setting up and using the MedChain backend
 * models and utilities.
 */

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║          MEDCHAIN BACKEND - MODELS & UTILITIES SETUP             ║
╚══════════════════════════════════════════════════════════════════╝

📋 WHAT'S BEEN CREATED:

✅ Models Directory (./models)
   • User.js - User authentication and profile management
   • Hospital.js - Hospital registration and verification
   • DoctorHospitalMapping.js - Doctor-hospital associations
   • MedicalRecord.js - Medical record storage with blockchain support
   • Permission.js - Access control and permissions
   • Prescription.js - Prescription management
   • Appointment.js - Appointment scheduling
   • EmergencyAccessLog.js - Emergency access audit trail
   • Notification.js - Multi-channel notification system
   • index.js - Export all models

✅ Utils Directory (./utils)
   • jwt.js - JWT token generation and verification
   • validators.js - Input validation functions
   • errorHandler.js - Custom error classes

📦 SETUP INSTRUCTIONS:

1. RUN THE SETUP SCRIPT:
   node models-setup.js

   This will create:
   - models/ directory with 9 Mongoose models
   - utils/ directory with 3 utility modules
   - Automatically indexed database collections
   - Virtual fields and computed properties

2. VERIFY INSTALLATION:
   ls -la models/
   ls -la utils/

3. INSTALL REQUIRED DEPENDENCIES (if not already installed):
   npm install mongoose bcryptjs jsonwebtoken validator

🔑 KEY FEATURES:

User Management:
  ✓ Bcrypt password hashing (10 salt rounds)
  ✓ Login attempt tracking (5 attempts = 2-hour lockout)
  ✓ Password reset tokens
  ✓ Email verification
  ✓ Two-factor authentication support
  ✓ Role-based access control (5 roles)

Hospital Management:
  ✓ Self-registration workflow
  ✓ Verification status tracking
  ✓ Document upload and verification
  ✓ Admin management
  ✓ Operational hours configuration
  ✓ Department management

Doctor Management:
  ✓ Medical license verification
  ✓ Specialization tracking
  ✓ Doctor-hospital approval workflow
  ✓ Working schedule management
  ✓ Appointment settings
  ✓ Performance metrics

Medical Records:
  ✓ Comprehensive clinical data
  ✓ IPFS/blockchain integration
  ✓ Access control and sharing
  ✓ Emergency access audit trails
  ✓ Consent management
  ✓ Record archival

Appointments:
  ✓ Multi-type consultations (in-person, online, phone)
  ✓ Automated scheduling
  ✓ Payment tracking
  ✓ Cancellation and rescheduling
  ✓ Feedback and rating system
  ✓ Reminder notifications

Prescriptions:
  ✓ Medication management
  ✓ Digital signatures
  ✓ Refill tracking
  ✓ Expiration management
  ✓ Investigation/tests ordering

Notifications:
  ✓ Multi-channel delivery (email, SMS, in-app, push)
  ✓ Scheduling support
  ✓ Priority levels
  ✓ Retry mechanism
  ✓ Delivery tracking

🚀 QUICK USAGE EXAMPLES:

// Import models
const { User, Hospital, Appointment, MedicalRecord } = require('./models');
const { generateToken, verifyToken } = require('./utils/jwt');
const { validateUserInput } = require('./utils/validators');
const { ValidationError, AppError } = require('./utils/errorHandler');

// Create a user
const user = new User({
  email: 'doctor@hospital.com',
  password: 'SecurePass123!@',
  firstName: 'John',
  lastName: 'Smith',
  role: 'doctor'
});
await user.save();

// Generate JWT token
const token = generateToken({ userId: user._id, role: user.role });

// Validate input
const { isValid, errors } = validateUserInput({
  email: 'user@example.com',
  firstName: 'Jane'
});

// Book an appointment
const appointment = new Appointment({
  patient: patientId,
  doctor: doctorId,
  hospital: hospitalId,
  appointmentDate: new Date('2024-12-25'),
  appointmentTime: { startTime: '09:00' },
  reason: 'General Check-up'
});
await appointment.save();

// Share medical record
await medicalRecord.shareWith(caregiverId, 'view');

// Log emergency access
const log = new EmergencyAccessLog({
  medicalRecord: recordId,
  patient: patientId,
  accessedBy: doctorId,
  accessType: 'emergency',
  reason: 'ER admission'
});
await log.save();

📚 DOCUMENTATION:

Full documentation available in: MODELS_README.md
  - Detailed model descriptions
  - All available methods and statics
  - Complete usage examples
  - Error handling patterns
  - Database indexing info

🔐 SECURITY FEATURES:

✓ Bcrypt password hashing with salt
✓ Login attempt tracking with lockout
✓ Passwords not returned by default
✓ JWT token management
✓ Role-based access control
✓ Input validation and sanitization
✓ Emergency access audit trails
✓ Blockchain/IPFS integration
✓ Consent and privacy management
✓ 2FA token support

📊 DATABASE SCHEMA:

All models include:
  • Automatic timestamps (createdAt, updatedAt)
  • Proper indexing for performance
  • Virtual computed fields
  • Pre-save middleware (password hashing)
  • Relationship references
  • Mixed metadata fields
  • Status tracking
  • Audit trails

🔧 ENVIRONMENT VARIABLES:

Create or update .env file:

MONGO_URI=mongodb://localhost:27017/medchain
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRE=7d
REFRESH_TOKEN_EXPIRE=30d
NODE_ENV=development

⚙️ INTEGRATION CHECKLIST:

□ Run: node models-setup.js
□ Verify models and utils directories created
□ Update package.json if needed
□ Install: npm install mongoose bcryptjs jsonwebtoken validator
□ Set up .env file with MongoDB URI
□ Test MongoDB connection
□ Create API routes using models
□ Implement authentication middleware
□ Add input validation to routes
□ Implement error handling
□ Create API controllers
□ Test all endpoints

💡 NEXT STEPS:

1. Create API Controllers (./controllers):
   - userController.js
   - hospitalController.js
   - appointmentController.js
   - medicalRecordController.js
   - etc.

2. Create API Routes (./routes):
   - userRoutes.js
   - hospitalRoutes.js
   - appointmentRoutes.js
   - medicalRecordRoutes.js
   - etc.

3. Create Middleware (./middleware):
   - authMiddleware.js
   - validationMiddleware.js
   - roleCheckMiddleware.js
   - errorHandlingMiddleware.js

4. Update server.js:
   - Import all routes
   - Add middleware
   - Connect to MongoDB
   - Start server

5. Create Tests:
   - Unit tests for models
   - Integration tests for API
   - Authentication tests

📞 SUPPORT:

For issues or questions:
1. Check MODELS_README.md for detailed documentation
2. Review model files for available methods
3. Check utils/ for helper functions
4. Verify .env configuration
5. Check MongoDB connection

═══════════════════════════════════════════════════════════════════

Ready to use! Run: node models-setup.js

═══════════════════════════════════════════════════════════════════
`);

// Also provide as module export
module.exports = {
  message: 'MedChain Backend Models and Utilities Setup Guide'
};
