const fs = require('fs');
const path = require('path');

// Define the base path
const basePath = path.join('c:', 'Users', 'Lanisha Thomas', 'Desktop', 'medchain', 'frontend', 'app');

// Define directories to create
const directories = [
  'auth/login',
  'auth/register',
  'auth/patient-login',
  'auth/caregiver-accept',
  'dashboard/hospital',
  'dashboard/doctor',
  'dashboard/patient',
  'dashboard/caregiver'
];

// Create all directories
try {
  directories.forEach(dir => {
    const fullPath = path.join(basePath, dir);
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✓ Created: ${dir}`);
  });
  console.log(`\n✓ All directories created successfully at: ${basePath}`);
} catch (error) {
  console.error('✗ Error creating directories:', error.message);
  process.exit(1);
}
