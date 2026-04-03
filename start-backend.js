#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

console.log('Starting MedChain Backend Server...\n');

const backendPath = path.join(__dirname, 'backend');
const serverPath = path.join(backendPath, 'server.js');

process.chdir(backendPath);

const backend = spawn('node', [serverPath], {
  stdio: 'inherit',
  shell: true
});

backend.on('exit', (code) => {
  console.log(`\nBackend server exited with code ${code}`);
  process.exit(code);
});

process.on('SIGINT', () => {
  console.log('\n\nShutting down backend server...');
  backend.kill();
  process.exit(0);
});
