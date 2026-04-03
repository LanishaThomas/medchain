require('dotenv').config();
const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');

async function testHospitalEndpoint() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Simulate what the API endpoint does
    console.log('🔍 Testing hospital list endpoint logic...\n');
    
    // First, show ALL hospitals
    const allHospitals = await Hospital.find({});
    console.log('📊 ALL HOSPITALS IN DATABASE:', allHospitals.length);
    allHospitals.forEach((h, idx) => {
      console.log(`\n${idx + 1}. ${h.name}`);
      console.log(`   ID: ${h._id}`);
      console.log(`   isActive: ${h.isActive}`);
      console.log(`   type: ${h.type}`);
      console.log(`   createdAt: ${h.createdAt}`);
    });
    
    // Now simulate the endpoint filter
    console.log('\n\n🔍 SIMULATING API ENDPOINT /api/hospital/list');
    console.log('   Filter: { isActive: true }');
    
    const apiResult = await Hospital.find({ isActive: true })
      .select('name type description email phone address specialties facilities bedCount is24HoursEmergency logo')
      .sort({ name: 1 });
    
    console.log(`\n✅ API would return: ${apiResult.length} hospital(s)`);
    
    if (apiResult.length === 0) {
      console.log('\n❌ PROBLEM: No hospitals match the filter!');
      console.log('\n💡 SOLUTION:');
      console.log('   Run: node fix-hospitals.js');
      console.log('   This will set isActive=true for all hospitals');
    } else {
      console.log('\n✅ SUCCESS! These hospitals will show in booking:');
      apiResult.forEach((h, idx) => {
        console.log(`\n${idx + 1}. ${h.name}`);
        console.log(`   Type: ${h.type}`);
        console.log(`   Email: ${h.email}`);
        console.log(`   Phone: ${h.phone}`);
        if (h.address) {
          console.log(`   Location: ${h.address.city}, ${h.address.state}`);
        }
        if (h.specialties && h.specialties.length > 0) {
          console.log(`   Specialties: ${h.specialties.join(', ')}`);
        }
      });
      
      // Show the exact JSON that would be returned
      console.log('\n\n📤 EXACT API RESPONSE:');
      const apiResponse = {
        success: true,
        count: apiResult.length,
        data: apiResult.map(h => ({
          id: h._id,
          name: h.name,
          type: h.type,
          description: h.description,
          email: h.email,
          phone: h.phone,
          address: h.address,
          specialties: h.specialties,
          facilities: h.facilities,
          bedCount: h.bedCount,
          is24HoursEmergency: h.is24HoursEmergency,
          logo: h.logo
        }))
      };
      console.log(JSON.stringify(apiResponse, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testHospitalEndpoint();
