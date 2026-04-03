const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'backend', 'services');

fs.mkdirSync(servicesDir, { recursive: true });
console.log(`Directory created: ${servicesDir}`);
