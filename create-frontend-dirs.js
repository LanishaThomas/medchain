const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'frontend', 'app');

const dirs = [
  'auth/login',
  'auth/register',
  'auth/patient-login',
  'auth/caregiver-accept',
  'dashboard/hospital',
  'dashboard/doctor',
  'dashboard/patient',
  'dashboard/caregiver'
];

dirs.forEach(dir => {
  const fullPath = path.join(baseDir, dir);
  try {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log('✓ Created:', dir);
  } catch (err) {
    console.error('Error creating', dir, ':', err.message);
  }
});

console.log('\n✓ All directories created successfully!');
