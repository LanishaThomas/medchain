require('dotenv').config();
const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    // Find hospitals with isActive = false
    const inactiveHospitals = await Hospital.find({ isActive: { $ne: true } });
    
    if (inactiveHospitals.length === 0) {
      console.log('\n✅ All hospitals are already active!');
      
      // Show active hospitals
      const activeHospitals = await Hospital.find({ isActive: true });
      console.log(`\n📊 Active hospitals (${activeHospitals.length}):`);
      activeHospitals.forEach(h => console.log('  -', h.name));
    } else {
      console.log(`\n⚠️  Found ${inactiveHospitals.length} inactive hospital(s):`);
      inactiveHospitals.forEach(h => {
        console.log(`  - ${h.name} (isActive: ${h.isActive})`);
      });
      
      console.log('\n🔧 Setting all hospitals to isActive: true...');
      const result = await Hospital.updateMany({}, { isActive: true });
      
      console.log(`✅ Updated ${result.modifiedCount} hospital(s)`);
      console.log('\n✨ All hospitals are now active and will appear in booking!');
    }
    
    process.exit();
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
