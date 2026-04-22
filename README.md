# MedChain

MedChain is an integrated healthcare platform combining a backend API, a Next.js frontend, and a blockchain workspace for smart-contract-related features.

This repository contains three main workspaces:

- Backend: [backend](backend)
- Frontend: [frontend](frontend)
- Blockchain: [blockchain](blockchain)

Quick links:

- Setup summary for backend: [backend/SETUP_SUMMARY.md](backend/SETUP_SUMMARY.md)
- Blockchain workspace docs: [blockchain/README.md](blockchain/README.md)

Start here:

- For developer-focused setup see: [README_TECHNICAL.md](README_TECHNICAL.md)
- For a non-technical project overview see: [README_NON_TECHNICAL.md](README_NON_TECHNICAL.md)

Quick start (Windows):

1. Clone the repo and open Powershell in the project root:

```powershell
git clone <YOUR_REPO_URL>
cd medchain
```

2. Use the provided root scripts to start each workspace (these handle common dev defaults):

```powershell
.\start-backend.bat    # starts the backend
.\start-frontend.bat   # starts the frontend
```

Notes and useful commands:

- Install dependencies per workspace if you prefer manual control:

```powershell
cd backend && npm install
cd ..\frontend && npm install
cd ..\blockchain && npm install
```

- If you need guided setup or summaries, see [backend/SETUP_SUMMARY.md](backend/SETUP_SUMMARY.md) and the `backend/SETUP_GUIDE.js` helper files.

Where to go next:

- Developers: open [README_TECHNICAL.md](README_TECHNICAL.md) for detailed environment, build, and debug instructions.
- Product / non-technical audience: open [README_NON_TECHNICAL.md](README_NON_TECHNICAL.md) for project goals, features, and how to try the app.

If anything in this top-level guide is unclear or you hit problems, I can update the technical README with exact commands for your environment and verify them locally if you want.

