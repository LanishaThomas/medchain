const fs = require('fs');
const path = require('path');

const stylesDir = path.join(__dirname, 'frontend', 'styles');

try {
  fs.mkdirSync(stylesDir, { recursive: true });
  console.log('✓ Created frontend/styles directory');
} catch (err) {
  if (err.code !== 'EEXIST') {
    console.error('Error:', err.message);
  } else {
    console.log('✓ frontend/styles directory already exists');
  }
}
