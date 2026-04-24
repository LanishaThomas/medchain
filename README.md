# 🏥 MedChain

**MedChain** is a state-of-the-art, integrated healthcare platform designed to revolutionize medical data management. By combining **Blockchain technology** for immutable auditing, **AI-driven insights**, and a modern **Next.js frontend**, MedChain ensures patient records are secure, transparent, and easily accessible to authorized personnel.

---

## 📺 Project Resources

- 📄 **Documentation Files**: [Google Drive Folder](https://drive.google.com/drive/folders/1NiUufUybf0qiNgtmEXVYAEVRTBDDl_1F?usp=sharing)
- 🎥 **Demo Video**: [Watch the MedChain Demo](https://drive.google.com/file/d/16flrshin_eF8HABYOiWTNAnw8S0MlGu7/view?usp=drive_link)

---

## ✨ Key Features

### 🛡️ Blockchain Integrity & Auditing
- **Immutable Audit Trail**: Every access or modification to a medical record is hashed and anchored on the blockchain (Polygon Amoy).
- **Tamper Detection**: Built-in consistency checks compare local database state against blockchain records to flag any unauthorized data changes.

### 🧠 Mental Health & Wellness
- **Mood Tracking**: Log and visualize daily emotional states.
- **Gratitude Journal**: A persistent, digital journal for daily reflections.
- **Wellness Tools**: Integrated breathing exercises and calming ambient sounds.

### 🆘 Emergency Access System
- **Quick Access**: Secure protocol for emergency responders to access vital patient information.
- **Time-Limited Sessions**: Access is automatically logged and expires after a set period.

### 🩺 Clinical Management
- **Medical Records**: Comprehensive storage for history, allergies, and chronic conditions.
- **E-Prescriptions**: Doctors can issue and manage prescriptions digitally.
- **Appointment Scheduling**: Integrated booking system for in-person and online consultations.

### 🤖 AI-Powered Insights
- **Symptom Analysis**: Leverages Groq SDK for intelligent medical data processing.
- **Automated Summaries**: High-level overviews of patient history for quick clinical review.

### 💳 Financials & Communication
- **Telemedicine**: Integrated video consultations via **Agora RTC**.
- **Payments**: Secure transaction handling via **Razorpay**.
- **Notifications**: Real-time alerts and email updates (Supabase/Brevo).

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | ![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=next.js&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4?style=flat-square&logo=tailwind-css&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) |
| **Backend** | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white) ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white) |
| **Blockchain** | ![Solidity](https://img.shields.io/badge/Solidity-363636?style=flat-square&logo=solidity&logoColor=white) ![Hardhat](https://img.shields.io/badge/Hardhat-FFDB1C?style=flat-square&logo=hardhat&logoColor=black) ![Ethers.js](https://img.shields.io/badge/Ethers.js-24334A?style=flat-square&logo=ethereum&logoColor=white) |
| **Services** | ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white) ![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=flat-square&logo=cloudinary&logoColor=white) ![Razorpay](https://img.shields.io/badge/Razorpay-02042B?style=flat-square&logo=razorpay&logoColor=white) |

---

## 📁 Project Structure

```text
medchain/
├── backend/          # Express API, MongoDB models, & Business logic
├── frontend/         # Next.js Application (App Router)
├── blockchain/       # Hardhat environment & Solidity Smart Contracts
└── README.md         # This file
```

---

## 🚀 Quick Start (Windows)

1. **Clone the repository**:
   ```powershell
   git clone https://github.com/LanishaThomas/medchain.git
   cd medchain
   ```

2. **Install Dependencies**:
   ```powershell
   # Root level scripts to install everything
   cd backend && npm install
   cd ..\frontend && npm install
   cd ..\blockchain && npm install
   ```

3. **Environment Setup**:
   Ensure you have `.env` files configured in both `backend/` and `frontend/` directories (refer to `.env.example` if available).

4. **Launch the Application**:
   ```powershell
   # Use the provided batch files for easy startup
   .\start-backend.bat
   .\start-frontend.bat
   ```

---

## ⚖️ License
Distributed under the ISC License. See `LICENSE` for more information.
