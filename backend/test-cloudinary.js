require('dotenv').config();
const cloudinary = require('cloudinary').v2;

console.log('\n🔍 Testing Cloudinary Configuration...\n');

console.log('Environment Variables:');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || '❌ MISSING');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY || '❌ MISSING');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ SET (hidden)' : '❌ MISSING');

console.log('\n🔧 Configuring Cloudinary...');
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('\n✅ Cloudinary configuration:', {
  cloud_name: cloudinary.config().cloud_name,
  api_key: cloudinary.config().api_key ? '✓' : '✗',
  api_secret: cloudinary.config().api_secret ? '✓' : '✗'
});

console.log('\n📡 Testing Cloudinary Connection...');
cloudinary.api.ping()
  .then(result => {
    console.log('✅ Cloudinary connection successful!');
    console.log('Response:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Cloudinary connection failed:');
    console.error(error);
    process.exit(1);
  });
