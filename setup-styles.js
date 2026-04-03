#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const stylesDir = path.resolve(__dirname, '..', 'frontend', 'styles');
const globalsFile = path.join(stylesDir, 'globals.css');

try {
  if (!fs.existsSync(stylesDir)) {
    fs.mkdirSync(stylesDir, { recursive: true });
    console.log(`✓ Created ${stylesDir}`);
  }

  const cssContent = `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  color: #1f2937;
  background-color: #ffffff;
}

h1 {
  font-size: 2.25rem;
  font-weight: 700;
}

h2 {
  font-size: 1.875rem;
  font-weight: 700;
}

h3 {
  font-size: 1.25rem;
  font-weight: 600;
}

input, textarea, select {
  transition: all 0.3s ease;
}

input:disabled, textarea:disabled, select:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

a {
  color: #4f46e5;
  text-decoration: none;
  transition: color 0.3s ease;
}

a:hover {
  color: #4338ca;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-in;
}

.animate-slide-down {
  animation: slideDown 0.3s ease-out;
}

.container-max {
  max-width: 80rem;
  margin: 0 auto;
  padding: 0 1rem;
}

.btn-primary {
  padding: 0.5rem 1.5rem;
  background-color: #4f46e5;
  color: white;
  font-weight: 600;
  border-radius: 0.5rem;
  transition: background-color 0.3s ease;
}

.btn-primary:hover {
  background-color: #4338ca;
}

.btn-secondary {
  padding: 0.5rem 1.5rem;
  background-color: #e5e7eb;
  color: #111827;
  font-weight: 600;
  border-radius: 0.5rem;
  transition: background-color 0.3s ease;
}

.btn-secondary:hover {
  background-color: #d1d5db;
}

.btn-danger {
  padding: 0.5rem 1.5rem;
  background-color: #dc2626;
  color: white;
  font-weight: 600;
  border-radius: 0.5rem;
  transition: background-color 0.3s ease;
}

.btn-danger:hover {
  background-color: #b91c1c;
}

.card {
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
}

.card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
}

.input-field {
  width: 100%;
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.input-field:focus {
  outline: none;
  border-color: transparent;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1), 0 0 0 2px #4f46e5;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background-color: #e0e7ff;
  color: #3730a3;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.badge-success {
  background-color: #dcfce7;
  color: #166534;
}

.badge-warning {
  background-color: #fef3c7;
  color: #92400e;
}

.badge-danger {
  background-color: #fee2e2;
  color: #991b1b;
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
  border: 3px solid rgba(79, 70, 229, 0.1);
  border-top-color: #4f46e5;
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}`;

  fs.writeFileSync(globalsFile, cssContent);
  console.log(`✓ Created ${globalsFile}`);
  console.log('✓ Frontend styles setup complete!');
} catch (error) {
  console.error(`✗ Error:`, error.message);
  process.exit(1);
}
