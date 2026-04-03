#!/usr/bin/env node

/**
 * MedChain Initialization Script
 * Creates all necessary directories and model files
 * Run with: node init.js
 */

const fs = require('fs');
const path = require('path');

const baseDir = __dirname;

// Helper function to ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Created directory: ${path.relative(baseDir, dirPath)}`);
  }
}

// Create directories
const dirs = [
  path.join(baseDir, 'config'),
  path.join(baseDir, 'models'),
  path.join(baseDir, 'utils'),
  path.join(baseDir, 'controllers'),
  path.join(baseDir, 'routes'),
  path.join(baseDir, 'middleware')
];

console.log('\n📁 Creating directories...\n');
dirs.forEach(ensureDir);

// Create User model
const userModel = require('./models-template/user-template');
fs.writeFileSync(path.join(baseDir, 'models', 'User.js'), userModel);
console.log('✓ Created models/User.js');

// Create Hospital model
const hospitalModel = require('./models-template/hospital-template');
fs.writeFileSync(path.join(baseDir, 'models', 'Hospital.js'), hospitalModel);
console.log('✓ Created models/Hospital.js');

// Create DoctorHospitalMapping model
const dhModel = require('./models-template/doctor-hospital-template');
fs.writeFileSync(path.join(baseDir, 'models', 'DoctorHospitalMapping.js'), dhModel);
console.log('✓ Created models/DoctorHospitalMapping.js');

// Create MedicalRecord model
const mrModel = require('./models-template/medical-record-template');
fs.writeFileSync(path.join(baseDir, 'models', 'MedicalRecord.js'), mrModel);
console.log('✓ Created models/MedicalRecord.js');

// Create Permission model
const permModel = require('./models-template/permission-template');
fs.writeFileSync(path.join(baseDir, 'models', 'Permission.js'), permModel);
console.log('✓ Created models/Permission.js');

// Create Prescription model
const prescModel = require('./models-template/prescription-template');
fs.writeFileSync(path.join(baseDir, 'models', 'Prescription.js'), prescModel);
console.log('✓ Created models/Prescription.js');

// Create Appointment model
const aptModel = require('./models-template/appointment-template');
fs.writeFileSync(path.join(baseDir, 'models', 'Appointment.js'), aptModel);
console.log('✓ Created models/Appointment.js');

// Create EmergencyAccessLog model
const ealModel = require('./models-template/emergency-access-log-template');
fs.writeFileSync(path.join(baseDir, 'models', 'EmergencyAccessLog.js'), ealModel);
console.log('✓ Created models/EmergencyAccessLog.js');

// Create Notification model
const notifModel = require('./models-template/notification-template');
fs.writeFileSync(path.join(baseDir, 'models', 'Notification.js'), notifModel);
console.log('✓ Created models/Notification.js');

// Create index
const indexContent = `const User = require('./User');
const Hospital = require('./Hospital');
const DoctorHospitalMapping = require('./DoctorHospitalMapping');
const MedicalRecord = require('./MedicalRecord');
const Permission = require('./Permission');
const Prescription = require('./Prescription');
const Appointment = require('./Appointment');
const EmergencyAccessLog = require('./EmergencyAccessLog');
const Notification = require('./Notification');

module.exports = {
  User,
  Hospital,
  DoctorHospitalMapping,
  MedicalRecord,
  Permission,
  Prescription,
  Appointment,
  EmergencyAccessLog,
  Notification
};
`;
fs.writeFileSync(path.join(baseDir, 'models', 'index.js'), indexContent);
console.log('✓ Created models/index.js');

// Create utils
const jwtUtils = require('./models-template/jwt-template');
fs.writeFileSync(path.join(baseDir, 'utils', 'jwt.js'), jwtUtils);
console.log('✓ Created utils/jwt.js');

const validators = require('./models-template/validators-template');
fs.writeFileSync(path.join(baseDir, 'utils', 'validators.js'), validators);
console.log('✓ Created utils/validators.js');

const errorHandler = require('./models-template/error-handler-template');
fs.writeFileSync(path.join(baseDir, 'utils', 'errorHandler.js'), errorHandler);
console.log('✓ Created utils/errorHandler.js');

console.log('\n✅ Initialization complete!\n');
console.log('📋 Next steps:');
console.log('   1. npm install');
console.log('   2. Update .env with MongoDB URI');
console.log('   3. npm run dev\n');
