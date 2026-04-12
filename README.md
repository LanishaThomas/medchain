# MedChain

MedChain is a full-stack healthcare platform with:
- Backend API (Express + MongoDB)
- Frontend app (Next.js)
- Blockchain workspace (Hardhat)

## Prerequisites

- Git
- Node.js 18+ and npm
- MongoDB (local or Atlas)

## 1. Clone

```bash
git clone <YOUR_REPO_URL>
cd medchain
```

## 2. Install Dependencies

Install each workspace separately:

```bash
cd backend
npm install

cd ..\frontend
npm install

cd ..\blockchain
npm install

cd ..
```

## 3. Environment Setup

### Backend

Create `backend/.env` from template:

PowerShell:
```powershell
Copy-Item backend/.env.example backend/.env
```

Then update at least these values in `backend/.env`:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/medchain
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
FRONTEND_URL=http://localhost:3000
```

### Frontend

Create `frontend/.env.local` from template:

PowerShell:
```powershell
Copy-Item frontend/.env.example frontend/.env.local
```

Default value:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## 4. Run the App

Use two terminals.

### Terminal 1: Start Backend

```bash
cd backend
npm run dev
```

Windows shortcut from project root:

```bat
start-backend.bat
```

### Terminal 2: Start Frontend

```bash
cd frontend
npm run dev
```

Windows shortcut from project root:

```bat
start-frontend.bat
```

## 5. Verify

- Frontend: `http://localhost:3000`
- Backend API health: `http://localhost:5000/api/health`

## Optional: Blockchain Workspace

```bash
cd blockchain
npm install
```

The blockchain package is available for smart contract development with Hardhat.

## Troubleshooting

- If backend fails on missing env values, re-check `backend/.env`.
- If frontend cannot call API, verify `NEXT_PUBLIC_API_URL` in `frontend/.env.local`.
- If MongoDB errors occur, confirm your `MONGO_URI` and that MongoDB is running.

