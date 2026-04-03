require('dotenv').config();
const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');

async function testHospitals() {
  try {
    // Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Count all hospitals
    const total = await Hospital.countDocuments({});
    console.log(`\n📊 Total hospitals in DB: ${total}`);

    // Count active hospitals
    const active = await Hospital.countDocuments({ isActive: true });
    console.log(`✅ Active hospitals: ${active}`);

    // Count inactive hospitals
    const inactive = await Hospital.countDocuments({ isActive: false });
    console.log(`❌ Inactive hospitals: ${inactive}`);

    // List all hospitals with details
    const allHospitals = await Hospital.find({})
      .select('name isActive verificationStatus email createdAt')
      .lean();

    if (allHospitals.length > 0) {
      console.log(`\n🏥 Hospital List:`);
      allHospitals.forEach((h, i) => {
        console.log(`\n${i + 1}. ${h.name}`);
        console.log(`   - isActive: ${h.isActive}`);
        console.log(`   - verificationStatus: ${h.verificationStatus}`);
        console.log(`   - email: ${h.email}`);
        console.log(`   - created: ${h.createdAt}`);
      });
    } else {
      console.log('\n⚠️ No hospitals found in database');
    }

    // Test the query that the API uses
    console.log(`\n🔍 Testing API query: Hospital.find({ isActive: true })`);
    const activeHospitals = await Hospital.find({ isActive: true })
      .select('name email type')
      .lean();
    console.log(`Query result count: ${activeHospitals.length}`);
    if (activeHospitals.length > 0) {
      console.log('Sample result:', activeHospitals[0]);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
    process.exit(0);
  }
}

testHospitals();
