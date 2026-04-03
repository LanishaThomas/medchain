# MedChain Backend

Production-grade healthcare system backend with self-registering hospitals, doctor approval workflows, and comprehensive medical record management.

## Architecture Overview

### Key Design Decisions
- **No Super Admin**: Hospitals are autonomous entities that self-register
- **Doctor Approval Flow**: Doctors must join hospitals and be approved by hospital admins
- **Role-Based Access**: Patient, Doctor, Caregiver, Hospital Admin
- **Audit Trail**: All sensitive operations logged
- **Blockchain Ready**: Built for Polygon integration

## Folder Structure

```
backend/
├── config/
│   └── database.js          # MongoDB connection with pooling
├── models/
│   ├── index.js              # Model exports
│   ├── User.js               # All user types (patient, doctor, caregiver, hospital_admin)
│   ├── Hospital.js           # Hospital registration & management
│   ├── DoctorHospitalMapping.js  # Doctor-Hospital relationships with approval
│   ├── MedicalRecord.js      # Patient medical records with IPFS/blockchain
│   ├── Permission.js         # Granular access control
│   ├── Prescription.js       # Prescriptions with medications
│   ├── Appointment.js        # Appointments with scheduling
│   ├── EmergencyAccessLog.js # Emergency access audit trail
│   └── Notification.js       # System notifications
├── controllers/
│   └── authController.js     # Authentication controller
├── middleware/
│   ├── authMiddleware.js     # JWT verification & role checks
│   └── errorMiddleware.js    # Global error handling
├── routes/
│   └── authRoutes.js         # Authentication routes
├── utils/
│   ├── jwt.js                # Token utilities
│   ├── validators.js         # Input validation
│   └── errorHandler.js       # Error classes
├── server.js                 # Express server setup
├── setup.js                  # One-time setup script
├── .env                      # Environment variables (DO NOT COMMIT)
└── .env.example              # Environment template
```

## Quick Start

### 1. Setup

```bash
# Install dependencies
npm install

# Run setup script to create directories and files
node setup.js

# Copy environment file and configure
cp .env.example .env
# Edit .env with your MongoDB URI and other configs
```

### 2. Configure MongoDB

Update `.env` with your MongoDB connection string:

```env
# Local MongoDB
MONGO_URI=mongodb://localhost:27017/medchain

# MongoDB Atlas (Production)
MONGO_URI=mongodb+srv://<username>:<password>@cluster.xxxxx.mongodb.net/medchain?retryWrites=true&w=majority
```

### 3. Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

## Database Collections

### 1. Users
All user types in a single collection with role-based fields.

| Field | Type | Description |
|-------|------|-------------|
| email | String | Unique, required |
| password | String | Hashed with bcrypt |
| role | Enum | patient, doctor, caregiver, hospital_admin |
| firstName, lastName | String | Required |
| phone | String | Validated format |
| walletAddress | String | Ethereum address for blockchain |
| patientInfo | Object | Blood type, allergies, emergency contacts |
| doctorInfo | Object | License, specializations, qualifications |
| caregiverInfo | Object | Patients under care, permissions |
| hospitalId | ObjectId | Reference for hospital admins |

### 2. Hospitals
Self-registered healthcare facilities.

| Field | Type | Description |
|-------|------|-------------|
| name | String | Hospital name |
| registrationNumber | String | Unique, required |
| licenseNumber | String | Medical license |
| verificationStatus | Enum | pending, under_review, verified, rejected, suspended |
| primaryAdmin | ObjectId | Required - who registered |
| departments | Array | Hospital departments |
| specialties | Array | Medical specialties offered |
| address | Object | Full address with coordinates |

### 3. DoctorHospitalMapping
Tracks doctor affiliations with approval workflow.

| Field | Type | Description |
|-------|------|-------------|
| doctor | ObjectId | Reference to User (doctor) |
| hospital | ObjectId | Reference to Hospital |
| status | Enum | pending, approved, rejected, suspended, resigned |
| employmentType | Enum | full_time, part_time, visiting, consultant |
| department | String | Department at hospital |
| schedule | Array | Working hours at this hospital |
| permissions | Object | What the doctor can do at this hospital |

### 4. MedicalRecords
Patient health records with blockchain integration.

| Field | Type | Description |
|-------|------|-------------|
| patient | ObjectId | Patient reference |
| createdBy | ObjectId | Doctor/admin who created |
| hospital | ObjectId | Where record was created |
| recordType | Enum | consultation, lab_result, imaging, etc. |
| clinicalData | Object | Diagnosis, vitals, lab results |
| attachments | Array | Files with IPFS/Cloudinary URLs |
| blockchain | Object | Transaction hash, IPFS hash |
| encryption | Object | Encryption metadata |

### 5. Permissions
Granular access control for record sharing.

| Field | Type | Description |
|-------|------|-------------|
| owner | ObjectId | Patient who owns records |
| grantedTo | ObjectId | Who has access |
| permissionType | Enum | full_access, read_only, specific_records, time_limited |
| specificRecords | Array | Specific record IDs if limited |
| validFrom, validUntil | Date | Time-limited access |
| actions | Object | canView, canDownload, canShare |

### 6. Prescriptions
Medical prescriptions with medication details.

| Field | Type | Description |
|-------|------|-------------|
| prescriptionNumber | String | Auto-generated unique ID |
| patient | ObjectId | Patient reference |
| prescribedBy | ObjectId | Doctor reference |
| medications | Array | Detailed medication list |
| diagnosis | Array | Related diagnoses |
| status | Enum | active, completed, cancelled, expired |

### 7. Appointments
Patient-doctor appointments.

| Field | Type | Description |
|-------|------|-------------|
| appointmentNumber | String | Auto-generated unique ID |
| patient | ObjectId | Patient reference |
| doctor | ObjectId | Doctor reference |
| hospital | ObjectId | Where appointment is |
| appointmentType | Enum | consultation, follow_up, telemedicine, etc. |
| scheduledDate, scheduledTime | Date/String | When |
| status | Enum | scheduled, confirmed, completed, cancelled |
| isTelemedicine | Boolean | Video consultation flag |
| telemedicine | Object | Meeting link, platform info |

### 8. EmergencyAccessLogs
Audit trail for emergency record access.

| Field | Type | Description |
|-------|------|-------------|
| accessedBy | ObjectId | Who accessed |
| patient | ObjectId | Whose records |
| recordsAccessed | Array | Which records |
| accessReason | Enum | Reason for emergency access |
| ipAddress | String | Client IP |
| reviewStatus | Enum | pending, reviewed, flagged, cleared |

### 9. Notifications
System notifications across channels.

| Field | Type | Description |
|-------|------|-------------|
| recipient | ObjectId | Who receives |
| type | Enum | appointment_reminder, prescription_refill, etc. |
| title, message | String | Notification content |
| channels | Array | in_app, email, sms, push |
| isRead | Boolean | Read status |

## Entity Relationships

```
User (Patient) ─────────┬──────── MedicalRecord
                        │              │
                        │              ├── Prescription
                        │              │
                        │              └── Attachment (IPFS)
                        │
                        ├──────── Permission ──────── User (Doctor/Caregiver)
                        │
                        ├──────── Appointment ─────── User (Doctor)
                        │              │
                        │              └── Hospital
                        │
                        └──────── EmergencyAccessLog

User (Doctor) ──────── DoctorHospitalMapping ──────── Hospital
                              │
                              ├── status (pending/approved/rejected)
                              ├── schedule
                              └── permissions

User (Hospital Admin) ──────── Hospital
                                  │
                                  ├── primaryAdmin
                                  ├── additionalAdmins
                                  └── departments
```

## Security Features

### Authentication
- JWT-based authentication with access and refresh tokens
- Password hashing with bcrypt (12 rounds)
- Account lockout after 5 failed attempts (2 hours)
- Email verification support
- Two-factor authentication ready

### Authorization
- Role-based access control (RBAC)
- Resource ownership verification
- Hospital-specific permissions for doctors
- Time-limited and record-specific permissions

### Audit
- All emergency accesses logged
- Status change history tracked
- IP and device logging
- Blockchain-ready for immutable audit trail

## API Endpoints (To Be Implemented)

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/forgot-password` - Password reset
- `GET /api/auth/verify-email/:token` - Email verification

### Hospitals
- `POST /api/hospitals/register` - Register hospital
- `GET /api/hospitals` - List verified hospitals
- `GET /api/hospitals/:id` - Hospital details
- `PUT /api/hospitals/:id` - Update hospital

### Doctors
- `POST /api/doctors/apply/:hospitalId` - Apply to hospital
- `GET /api/doctors/applications` - View applications
- `PUT /api/doctors/applications/:id/approve` - Approve doctor
- `PUT /api/doctors/applications/:id/reject` - Reject doctor

### Records
- `POST /api/records` - Create medical record
- `GET /api/records/patient/:patientId` - Get patient records
- `GET /api/records/:id` - Get specific record
- `POST /api/records/:id/share` - Share record

### Appointments
- `POST /api/appointments` - Book appointment
- `GET /api/appointments/upcoming` - Get upcoming
- `PUT /api/appointments/:id/cancel` - Cancel
- `PUT /api/appointments/:id/reschedule` - Reschedule

## Environment Variables

See `.env.example` for all required environment variables.

## License

MIT
