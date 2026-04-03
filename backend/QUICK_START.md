# 🚀 MedChain Backend - Quick Start

## Problem
You ran `npm run dev` but got "Missing script: dev" error because the models and utilities weren't created yet.

## Solution: 3-Step Setup

### Step 1: Bootstrap the Backend (Creates all models & utils)
```bash
cd backend
node bootstrap.js
```

This creates:
- ✅ `models/` directory with 9 models
- ✅ `utils/` directory with helpers  
- ✅ All necessary files and indexes

### Step 2: Install Dependencies
```bash
npm install
```

Dependencies installed:
- mongoose - Database
- express - Web server
- bcryptjs - Password hashing
- jsonwebtoken - JWT tokens
- dotenv - Environment variables
- cors - Cross-origin requests
- nodemon - Auto-reload development

### Step 3: Start the Server
```bash
npm run dev
```

Should see:
```
╔═══════════════════════════════════════════════════╗
║           MedChain Backend Server                 ║
╠═══════════════════════════════════════════════════╣
║  Environment: development                         ║
║  Port: 5000                                       ║
║  Frontend URL: http://localhost:3000              ║
╚═══════════════════════════════════════════════════╝
```

## Test the Server

### Health Check
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-04-03T08:20:00.000Z",
  "environment": "development"
}
```

## Architecture Created

### Models (9 Collections)
1. **User** - All users (patient, doctor, caregiver, hospital_admin)
2. **Hospital** - Healthcare facilities
3. **DoctorHospitalMapping** - Doctor-hospital affiliations
4. **MedicalRecord** - Patient health records
5. **Permission** - Access control
6. **Prescription** - Medications
7. **Appointment** - Scheduling
8. **EmergencyAccessLog** - Audit trail
9. **Notification** - System alerts

### Features Included
✅ Password hashing with bcryptjs  
✅ JWT authentication  
✅ Role-based access control  
✅ Account lockout after 5 failed attempts  
✅ MongoDB connection with pooling  
✅ CORS enabled  
✅ Error handling middleware  
✅ Request logging  
✅ 404 handler  

## Environment Variables

Check `.env.example` for all required variables.

### Minimal Setup
```env
MONGO_URI=mongodb://localhost:27017/medchain
JWT_SECRET=your-super-secret-key-min-32-chars
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## Database Setup

### Option 1: Local MongoDB
```bash
# Start MongoDB locally
mongod

# Connection string
mongodb://localhost:27017/medchain
```

### Option 2: MongoDB Atlas (Production)
```
mongodb+srv://username:password@cluster.xxxxx.mongodb.net/medchain?retryWrites=true&w=majority
```

## API Endpoints

### Health Check
- `GET /api/health` - Server status

### Authentication Routes (template)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/protected` - Protected route (needs JWT)

## Project Structure
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
├── middleware/
│   ├── authMiddleware.js
│   └── errorMiddleware.js
├── controllers/
│   └── authController.js
├── routes/
│   └── authRoutes.js
├── database.js
├── server.js
├── .env
└── package.json
```

## Troubleshooting

### Error: Cannot find module 'mongoose'
→ Run: `npm install`

### Error: MONGO_URI not defined
→ Create .env file and add: `MONGO_URI=mongodb://localhost:27017/medchain`

### Error: Cannot find module './models/User'
→ Run: `node bootstrap.js` first

### MongoDB Connection Failed
→ Make sure MongoDB is running:
   - Local: `mongod`
   - Atlas: Check connection string in .env

## Next Steps

1. ✅ Setup backend (this guide)
2. Implement auth routes (register, login)
3. Implement hospital registration
4. Implement doctor approval workflow
5. Implement medical record APIs
6. Build frontend (Next.js)
7. Deploy to production

## Need Help?

Check the documentation files:
- `README.md` - Complete API reference
- `.env.example` - All environment variables
- `MODELS_README.md` - Model details
- `database.js` - MongoDB connection

---

**Ready to start?**
```bash
node bootstrap.js
npm install
npm run dev
```

🎉 Server will be running at `http://localhost:5000`
