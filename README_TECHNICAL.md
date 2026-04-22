# MedChain — Technical Setup

This document provides developer-oriented setup, run, and debug steps for the MedChain repository.

Prerequisites
- Node.js (16+ recommended)
- npm or yarn
- MongoDB (local or Atlas)
- (Optional) Hardhat for blockchain development

Install dependencies

```powershell
cd backend && npm install
cd ..\frontend && npm install
cd ..\blockchain && npm install
```

Backend (development)
- Copy the env template and edit required values:

```powershell
Copy-Item backend/.env.example backend/.env
# then edit backend/.env to set MONGO_URI, JWT_SECRET, etc.
```

- Start the backend (from project root):

```powershell
.\start-backend.bat
# or: cd backend && npm run dev
```

Frontend (development)
- Copy frontend env template if present and update API URL:

```powershell
Copy-Item frontend/.env.example frontend/.env.local
# set NEXT_PUBLIC_API_URL to backend API base
```

- Start the frontend (from project root):

```powershell
.\start-frontend.bat
# or: cd frontend && npm run dev
```

Blockchain workspace
- See [blockchain/README.md](blockchain/README.md) for smart contract workflows.

Scripts and helpers
- Root contains helper scripts such as `setup-frontend.js`, `setup-styles.js`, and start scripts. Use these for environment scaffolding on Windows.

Testing and verification
- Verify frontend: http://localhost:3000
- Verify backend health endpoints (example): `http://localhost:5000/api/health`

Debugging
- Backend: run under a debugger (VS Code launch.json with `node --inspect`) or use `npm run dev` style script.
- Frontend: Next.js dev mode gives fast refresh; use the browser devtools.

Notes
- If you need exact env keys or example payloads for API endpoints, tell me which part (auth, medical records, appointments) and I will add endpoint examples and Postman collection.
