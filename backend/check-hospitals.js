require('dotenv').config();
const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Get all hospitals
    const allHospitals = await Hospital.find({});
    console.log('\n📊 TOTAL HOSPITALS:', allHospitals.length);
    
    allHospitals.forEach((h, idx) => {
      console.log(`\n🏥 Hospital ${idx + 1}:`);
      console.log('  Name:', h.name);
      console.log('  ID:', h._id);
      console.log('  isActive:', h.isActive);
      console.log('  type:', h.type);
      console.log('  email:', h.email);
      console.log('  phone:', h.phone);
    });
    
    // Check what the API would return (only isActive filter, no verification)
    const apiHospitals = await Hospital.find({ isActive: true });
    
    console.log('\n🔍 HOSPITALS MATCHING API FILTER (isActive=true):');
    console.log('  Count:', apiHospitals.length);
    
    if (apiHospitals.length === 0) {
      console.log('\n⚠️  NO ACTIVE HOSPITALS FOUND!');
      console.log('   This is why the frontend shows "no hospitals"');
      
      if (allHospitals.length > 0) {
        console.log('\n💡 SOLUTION: Update the hospital(s) to set isActive: true');
        console.log('\nRun this command to fix:');
        console.log('  node -e "const mongoose=require(\'mongoose\');require(\'dotenv\').config();const Hospital=require(\'./models/Hospital\');mongoose.connect(process.env.MONGO_URI).then(async()=>{await Hospital.updateMany({},{isActive:true});console.log(\'Fixed!\');process.exit();});"');
      }
    } else {
      console.log('\n✅ These hospitals should appear in the booking interface:');
      apiHospitals.forEach(h => console.log('  -', h.name));
    }
    
    process.exit();
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
