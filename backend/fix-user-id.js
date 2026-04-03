const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'appointmentController.js');
let content = fs.readFileSync(file, 'utf8');

// Replace all req.user._id with req.user.id
const original = content;
content = content.replace(/req\.user\._id/g, 'req.user.id');

if (original !== content) {
  fs.writeFileSync(file, content);
  const count = (original.match(/req\.user\._id/g) || []).length;
  console.log(`✅ Fixed ${count} occurrences of req.user._id → req.user.id`);
} else {
  console.log('No changes needed');
}
