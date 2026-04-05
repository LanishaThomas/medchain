# MedChain - Healthcare Records on Blockchain

A production-grade healthcare records management platform built with the MERN stack and Next.js, designed to securely store and manage medical records using blockchain technology.

## 🏗️ Architecture

```
medchain/
├── frontend/          # Next.js 16 with App Router
│   ├── app/
│   │   ├── login/
│   │   ├── signup/
│   │   ├── dashboard/
│   │   │   ├── admin/
│   │   │   ├── hospital/
│   │   │   ├── doctor/
│   │   │   └── patient/
│   │   ├── AuthContext.tsx
│   │   ├── api.ts
│   │   └── types.ts
│   └── ...
│
├── backend/           # Node.js + Express
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── server.js
│
└── blockchain/        # Polygon (placeholder)
```

## 🚀 Features

- **JWT Authentication** with secure password hashing (bcrypt)
- **Role-Based Access Control (RBAC)**: Super Admin, Hospital Admin, Doctor, Patient
- **2FA Mock** for Super Admin (OTP via console)
- **MongoDB** database with Mongoose schemas
- **Next.js 16** with App Router and TypeScript
- **Tailwind CSS** for styling
- **ESLint + Prettier** for code quality

## 📋 Prerequisites

- Node.js 18+
- MongoDB Atlas or local MongoDB
- npm or yarn

## 🛠️ Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env  # Edit with your MongoDB URI and JWT secret
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### Create Super Admin

```bash
cd backend
npm run create-admin
```

This creates a super admin with:
- Email: admin@medchain.com
- Password: Admin@123456
- 2FA enabled (check console for OTP)

## 🔐 User Roles

| Role | Access |
|------|--------|
| **Super Admin** | Full system access, user management, hospital verification |
| **Hospital Admin** | Manage hospital, add/verify doctors |
| **Doctor** | View/update patient records, manage appointments |
| **Patient** | View own records, book appointments, share records |

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/verify-2fa` - Verify 2FA OTP
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users` - Get all users (Super Admin)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user (Super Admin)
- `PUT /api/users/:id/verify-license` - Verify doctor license

### Hospitals
- `GET /api/hospitals` - Get all hospitals
- `GET /api/hospitals/:id` - Get hospital by ID
- `POST /api/hospitals` - Create hospital
- `PUT /api/hospitals/:id` - Update hospital
- `PUT /api/hospitals/:id/verify` - Verify hospital (Super Admin)
- `GET /api/hospitals/:id/doctors` - Get hospital doctors
- `POST /api/hospitals/:id/doctors` - Add doctor to hospital

## 🗄️ Database Models

### User
```javascript
{
  email, password, firstName, lastName,
  role: ['super_admin', 'hospital_admin', 'doctor', 'patient'],
  isVerified, isActive, twoFactorEnabled,
  // Doctor fields
  hospitalId, licenseNumber, specialization, isLicenseVerified,
  // Patient fields
  dateOfBirth, phoneNumber, address,
  // Blockchain
  walletAddress
}
```

### Hospital
```javascript
{
  name, registrationNumber, adminId,
  email, phoneNumber, address,
  type: ['general', 'specialized', 'clinic', 'research', 'teaching'],
  departments, isVerified, isActive,
  licenseDocument, contractAddress
}
```

## 🔮 Future Enhancements

- [ ] Polygon blockchain integration
- [ ] IPFS for document storage
- [ ] Email notifications
- [ ] Real OTP with email/SMS
- [ ] Medical records CRUD
- [ ] Appointment scheduling
- [ ] Patient consent management

## 📝 License

ISC
