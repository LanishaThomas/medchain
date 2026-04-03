# MedChain Backend - Complete Setup Summary

## ✅ What Has Been Created

### Setup Files Created:
1. **models-setup.js** - Executable Node.js script that creates all models and utilities
2. **MODELS_README.md** - Comprehensive documentation for all models and utilities
3. **SETUP_GUIDE.js** - Quick start guide and setup instructions
4. **SETUP_SUMMARY.md** - This file

### Generated Files (after running models-setup.js):

#### Models (9 files):
```
models/
├── User.js                      - User authentication and profiles
├── Hospital.js                  - Hospital management
├── DoctorHospitalMapping.js     - Doctor-Hospital relationships
├── MedicalRecord.js             - Medical record storage
├── Permission.js                - Access control
├── Prescription.js              - Prescription management
├── Appointment.js               - Appointment scheduling
├── EmergencyAccessLog.js         - Emergency access audit
├── Notification.js              - Notification system
└── index.js                     - Model exports
```

#### Utilities (3 files):
```
utils/
├── jwt.js                       - JWT token management
├── validators.js                - Input validation
└── errorHandler.js              - Error handling
```

---

## 🚀 How to Setup

### Step 1: Create All Models and Utilities
```bash
cd c:\Users\Lanisha Thomas\Desktop\medchain\backend
node models-setup.js
```

This command will:
- Create `models/` directory
- Create `utils/` directory
- Generate 9 Mongoose models
- Generate 3 utility modules
- Output success messages

### Step 2: Verify Installation
```bash
# Check that directories and files were created
dir models\
dir utils\
```

### Step 3: Install Dependencies (if not already installed)
```bash
npm install mongoose bcryptjs jsonwebtoken validator
```

### Step 4: Configure Environment
Create/update `.env` file:
```env
MONGO_URI=mongodb://localhost:27017/medchain
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRE=7d
REFRESH_TOKEN_EXPIRE=30d
NODE_ENV=development
```

---

## 📊 Models Overview

### 1. User Model (models/User.js)
**Roles**: Patient, Doctor, Caregiver, Hospital Admin, Super Admin

**Key Features**:
- Bcrypt password hashing (10 salt rounds)
- Login attempt tracking (5 attempts → 2-hour lockout)
- Two-factor authentication support
- Email verification
- Password reset tokens
- Medical license verification (for doctors)
- Hospital mappings

**Key Methods**:
- `matchPassword(enteredPassword)` - Verify password
- `isLocked()` - Check if account is locked
- `incLoginAttempts()` - Increment failed login attempts
- `resetLoginAttempts()` - Reset login attempts

**Key Statics**:
- `findByEmail(email)` - Find user by email
- `findDoctors()` - Find all active doctors
- `findPatients()` - Find all active patients

---

### 2. Hospital Model (models/Hospital.js)
**Key Features**:
- Self-registration workflow
- Verification status tracking (pending, verified, rejected)
- Document upload and verification
- Multiple admin support
- Department management
- Facility tracking
- Operational hours
- IPFS/blockchain hash support
- Rating system

**Key Methods**:
- `approve()` - Approve hospital registration
- `reject(reason)` - Reject hospital registration
- `suspend(reason)` - Suspend hospital
- `reactivate()` - Reactivate suspended hospital

**Key Statics**:
- `findApproved()` - Find all approved hospitals
- `findPending()` - Find pending verification hospitals

---

### 3. DoctorHospitalMapping Model (models/DoctorHospitalMapping.js)
**Key Features**:
- Doctor-hospital associations
- Approval workflow
- Working schedule management
- Appointment settings
- Performance metrics
- Designation tracking
- Specialization records
- Suspension support

**Key Methods**:
- `approve(approvedBy)` - Approve mapping
- `reject(reason, approvedBy)` - Reject mapping
- `suspend(reason, suspendedBy)` - Suspend mapping
- `reactivate()` - Reactivate mapping

**Key Statics**:
- `findApprovedByHospital(hospitalId)` - Find approved doctors
- `findPendingApprovals(hospitalId)` - Find pending approvals

---

### 4. MedicalRecord Model (models/MedicalRecord.js)
**Key Features**:
- Comprehensive clinical data
- Multiple record types (consultation, prescription, lab report, etc.)
- Vitals tracking
- Diagnosis with ICD10 codes
- IPFS/blockchain integration
- Access control and sharing
- Emergency access logging
- Consent management
- Record archival
- Patient confidentiality controls

**Key Methods**:
- `shareWith(userId, accessType)` - Share record with user
- `revokeAccess(userId)` - Revoke access
- `archive()` - Archive record
- `lockFromEditing()` - Mark as confidential

**Key Statics**:
- `findByPatient(patientId)` - Find patient's records
- `findByDoctor(doctorId)` - Find doctor's records
- `findByType(type)` - Find records by type

---

### 5. Permission Model (models/Permission.js)
**Key Features**:
- Resource-based access control
- Role assignment (5 roles supported)
- Condition-based permissions
- Enable/disable permissions

**Key Methods**:
- `assignToRole(role)` - Assign permission to role
- `removeFromRole(role)` - Remove from role

**Key Statics**:
- `findByRole(role)` - Find permissions for role
- `findByResourceAndAction(resource, action)` - Find specific permission
- `checkPermission(role, resource, action)` - Verify permission

---

### 6. Prescription Model (models/Prescription.js)
**Key Features**:
- Multiple medications
- Dosage and frequency
- Route of administration
- Side effects and contraindications
- Investigation/test ordering
- Digital signature
- Refill tracking
- Expiration management
- IPFS/blockchain support

**Key Methods**:
- `renew()` - Renew prescription
- `cancel(reason, cancelledBy)` - Cancel prescription
- `isExpired()` - Check if expired

**Key Statics**:
- `findActiveByPatient(patientId)` - Find active prescriptions
- `findByDoctor(doctorId)` - Find doctor's prescriptions

---

### 7. Appointment Model (models/Appointment.js)
**Key Features**:
- Multi-type consultations (in-person, online, phone)
- Automated scheduling
- Payment tracking
- Cancellation and rescheduling
- Feedback and rating
- Meeting details for online consultations
- Reminder tracking
- Performance metrics

**Key Methods**:
- `confirm()` - Confirm appointment
- `complete(notes)` - Mark as completed
- `cancel(reason, cancelledBy)` - Cancel appointment
- `reschedule(newDate, newTime)` - Reschedule appointment
- `rateAppointment(rating, feedback, ratedBy)` - Add rating

**Key Statics**:
- `findUpcoming(doctorId, limit)` - Find upcoming appointments
- `findByPatientUpcoming(patientId)` - Find patient's upcoming appointments

---

### 8. EmergencyAccessLog Model (models/EmergencyAccessLog.js)
**Key Features**:
- Emergency access tracking
- Approval workflow
- Patient notification
- Audit trail
- Access type categorization
- Emergency severity levels
- Data access tracking
- IP and device information

**Key Methods**:
- `approve(approvedBy, reason)` - Approve emergency access
- `deny(reason)` - Deny emergency access
- `notifyPatient(method)` - Notify patient of access
- `addAuditTrail(action, details)` - Add to audit trail

**Key Statics**:
- `findByPatient(patientId, days)` - Find patient's access logs
- `findPendingApproval()` - Find pending approvals

---

### 9. Notification Model (models/Notification.js)
**Key Features**:
- Multi-channel delivery (email, SMS, in-app, push)
- Scheduling support
- Priority levels (low, normal, high, critical)
- Retry mechanism
- Expiration support
- Action links
- Delivery status tracking

**Key Methods**:
- `markAsRead()` - Mark notification as read
- `markAsDelivered()` - Mark as delivered

**Key Statics**:
- `findUnreadByRecipient(recipientId)` - Find unread notifications
- `findByRecipientAndType(recipientId, type)` - Find by type
- `findPendingToSend()` - Find pending notifications

---

## 🛠️ Utilities Overview

### 1. JWT Utilities (utils/jwt.js)

**Functions**:
```javascript
// Generate single token
generateToken(payload, expiresIn = '7d')

// Generate access + refresh tokens
generateTokens(payload)

// Verify token
verifyToken(token)

// Decode token (no verification)
decodeToken(token)

// Extract from Authorization header
extractTokenFromHeader(authHeader)

// Specialized tokens
generatePasswordResetToken(userId)
generateEmailVerificationToken(userId, email)
generate2FAToken(userId)
```

---

### 2. Validators (utils/validators.js)

**Functions**:
```javascript
// Email validation
validateEmail(email) → Boolean

// Phone validation
validatePhone(phone) → Boolean

// Password strength check
validatePasswordStrength(password) → { isValid, errors }

// User input validation
validateUserInput(data) → { isValid, errors }

// Hospital input validation
validateHospitalInput(data) → { isValid, errors }

// Appointment validation
validateAppointmentInput(data) → { isValid, errors }

// Prescription validation
validatePrescriptionInput(data) → { isValid, errors }

// Input sanitization
sanitizeInput(input) → sanitized string

// URL validation
validateURL(url) → Boolean

// Date validation
validateDate(date) → Boolean
```

---

### 3. Error Handler (utils/errorHandler.js)

**Error Classes**:
```javascript
AppError                    // Base error class
ValidationError             // 400 - Validation failed
AuthenticationError          // 401 - Auth failed
AuthorizationError           // 403 - No permission
NotFoundError               // 404 - Not found
ConflictError               // 409 - Resource exists
BadRequestError             // 400 - Bad request
InternalServerError         // 500 - Server error
UnprocessableEntityError    // 422 - Cannot process
RateLimitError              // 429 - Too many requests
```

**Functions**:
```javascript
// Format error response
formatErrorResponse(error) → formatted object

// Handle Mongoose errors
handleMongooseValidationError(error)
handleMongooseDuplicateKeyError(error)
handleMongooseCastError(error)

// Handle JWT errors
handleJWTError(error)

// Express middleware
errorHandlerMiddleware(error, req, res, next)
```

---

## 💾 Database Indexes

All models include optimized indexes:

**User**:
- email (unique)
- role
- hospital
- isActive
- createdAt

**Hospital**:
- name & description (text search)
- address.city
- registrationNumber (unique)
- verificationStatus
- isActive

**MedicalRecord**:
- patient
- doctor
- hospital
- visitDate
- recordType
- diagnosis.icd10Code
- ipfsHash
- blockchainHash

**Appointment**:
- patient
- doctor
- hospital
- appointmentDate
- status
- appointmentNumber (unique)

**Prescription**:
- patient
- doctor
- prescriptionDate
- status
- prescriptionNumber (unique)

**Notification**:
- recipient + createdAt
- recipient + isRead
- type
- sendAt
- status

---

## 🔐 Security Features

✅ **Password Security**:
- Bcrypt hashing with 10 salt rounds
- Password not returned by default
- Password reset tokens with expiration
- Password strength validation

✅ **Authentication**:
- JWT token generation and verification
- Access and refresh token support
- Email verification tokens
- Two-factor authentication support
- Password reset workflow

✅ **Authorization**:
- Role-based access control (5 roles)
- Permission model for fine-grained access
- Hospital and doctor approval workflows
- Emergency access approval system

✅ **Audit & Compliance**:
- Emergency access logging
- Login attempt tracking with lockout
- Audit trails for critical actions
- Consent management
- Data processing consent tracking
- Privacy policy acceptance tracking

✅ **Input Validation**:
- Email validation
- Phone validation
- Password strength requirements
- User input sanitization
- XSS protection

✅ **Data Protection**:
- IPFS/blockchain hash support
- Encrypted medical records support
- Access control and sharing
- Confidentiality flags
- Record archival

---

## 📝 Usage Examples

### Create a Doctor User
```javascript
const { User } = require('./models');

const doctor = new User({
  email: 'dr.smith@hospital.com',
  password: 'SecurePass123!@',
  firstName: 'John',
  lastName: 'Smith',
  role: 'doctor',
  phone: '+1234567890',
  medicalLicense: {
    licenseNumber: 'MD12345',
    issuingBody: 'Medical Board',
    issuingDate: new Date('2015-01-01'),
    expiryDate: new Date('2025-01-01')
  },
  specializations: [
    {
      specialty: 'Cardiology',
      yearsOfExperience: 8
    }
  ]
});

await doctor.save();
const token = generateToken({ userId: doctor._id, role: doctor.role });
```

### Create Hospital and Register
```javascript
const { Hospital } = require('./models');

const hospital = new Hospital({
  name: 'City Medical Center',
  registrationNumber: 'HOS12345',
  email: 'admin@citymedical.com',
  phone: '+1234567890',
  address: {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    country: 'USA'
  },
  totalBeds: 500,
  primaryAdmin: adminUserId,
  facilities: ['Emergency', 'ICU', 'Surgery'],
  emergencyServices: true
});

await hospital.save();
```

### Book Appointment
```javascript
const { Appointment } = require('./models');

const appointment = new Appointment({
  patient: patientId,
  doctor: doctorId,
  hospital: hospitalId,
  appointmentNumber: 'APT-2024-001',
  appointmentDate: new Date('2024-12-25'),
  appointmentTime: {
    startTime: '09:00',
    endTime: '09:30',
    durationMinutes: 30
  },
  consultationType: 'in_person',
  reason: 'Regular Check-up',
  symptoms: ['Fever'],
  consultationFee: 50,
  paymentStatus: 'pending'
});

await appointment.save();
await appointment.confirm();
```

### Create Medical Record
```javascript
const { MedicalRecord } = require('./models');

const record = new MedicalRecord({
  patient: patientId,
  doctor: doctorId,
  hospital: hospitalId,
  recordType: 'consultation',
  visitDate: new Date(),
  diagnosis: {
    description: 'Common Cold',
    icd10Code: 'J00',
    severity: 'mild'
  },
  symptoms: ['Cough', 'Sore Throat'],
  vitals: {
    temperature: 37.5,
    heartRate: 72,
    bloodPressure: '120/80'
  },
  clinicalNotes: 'Patient presents with common cold symptoms...'
});

await record.save();

// Share with caregiver
await record.shareWith(caregiverId, 'view');
```

### Issue Prescription
```javascript
const { Prescription } = require('./models');

const prescription = new Prescription({
  patient: patientId,
  doctor: doctorId,
  hospital: hospitalId,
  prescriptionNumber: 'RX-2024-001',
  prescriptionDate: new Date(),
  diagnosis: 'Common Cold',
  medications: [
    {
      medicineName: 'Paracetamol',
      dosage: { amount: 500, unit: 'mg' },
      frequency: 'thrice_daily',
      duration: { value: 7, unit: 'days' },
      route: 'oral',
      instructions: 'Take with food'
    }
  ],
  refillAllowed: true,
  refillsRemaining: 2
});

await prescription.save();

// Later: Renew prescription
await prescription.renew();
```

### Emergency Access
```javascript
const { EmergencyAccessLog, MedicalRecord } = require('./models');

const log = new EmergencyAccessLog({
  medicalRecord: recordId,
  patient: patientId,
  accessedBy: emergencyDoctorId,
  hospital: hospitalId,
  accessType: 'emergency',
  reason: 'Patient unconscious in ER',
  emergencyDetails: {
    emergencyType: 'trauma',
    severity: 'critical',
    location: 'Emergency Room'
  }
});

await log.save();

// Approve emergency access
await log.approve(adminId, 'Critical condition authorization');

// Notify patient
await log.notifyPatient('email');
```

---

## 📦 File Structure After Setup

```
backend/
├── models/
│   ├── User.js
│   ├── Hospital.js
│   ├── DoctorHospitalMapping.js
│   ├── MedicalRecord.js
│   ├── Permission.js
│   ├── Prescription.js
│   ├── Appointment.js
│   ├── EmergencyAccessLog.js
│   ├── Notification.js
│   └── index.js
├── utils/
│   ├── jwt.js
│   ├── validators.js
│   └── errorHandler.js
├── controllers/
│   └── authController.js (existing)
├── middleware/
│   └── (existing middleware)
├── routes/
│   └── (existing routes)
├── .env
├── package.json
├── server.js
├── models-setup.js
├── MODELS_README.md
├── SETUP_GUIDE.js
└── SETUP_SUMMARY.md (this file)
```

---

## ✨ Next Steps

1. ✅ Run `node models-setup.js` to create all models and utilities
2. ✅ Verify files are created in models/ and utils/
3. ✅ Install dependencies: `npm install mongoose bcryptjs jsonwebtoken validator`
4. ✅ Create API controllers for each model
5. ✅ Create API routes for CRUD operations
6. ✅ Implement authentication middleware
7. ✅ Add input validation to routes
8. ✅ Test all endpoints

---

## 📖 Documentation

- **MODELS_README.md** - Full model documentation and examples
- **SETUP_GUIDE.js** - Quick start guide
- **Model files** - Each model file contains comments and method documentation

---

## 🎉 You're All Set!

Run: `node models-setup.js`

Then start building your API controllers and routes using these comprehensive models and utilities!
