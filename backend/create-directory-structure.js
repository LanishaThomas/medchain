const fs = require('fs');
const path = require('path');

// Create directories
const backendPath = path.join(__dirname, '.');
const modelsDir = path.join(backendPath, 'models');
const utilsDir = path.join(backendPath, 'utils');

// Create models directory
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
  console.log('Created models directory');
}

// Create utils directory
if (!fs.existsSync(utilsDir)) {
  fs.mkdirSync(utilsDir, { recursive: true });
  console.log('Created utils directory');
}

console.log('Directories created successfully!');
