// Save this as: backend/test-hospital-flow.js
// Run with: node test-hospital-flow.js

require('dotenv').config();
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testHospitalFlow() {
  console.log('\n🧪 MedChain Hospital Flow Test\n');
  
  try {
    // Test 1: Get main hospitals endpoint
    console.log('Test 1: GET /api/auth/hospitals (main endpoint)');
    try {
      const response1 = await axios.get(`${API_URL}/auth/hospitals`);
      console.log(`✅ Status: ${response1.status}`);
      console.log(`✅ Hospitals found: ${response1.data.data.count}`);
      if (response1.data.data.count > 0) {
        console.log(`✅ Hospitals: ${response1.data.data.hospitals.map(h => h.name).join(', ')}`);
      }
    } catch (err) {
      console.error(`❌ Error: ${err.response?.status} - ${err.message}`);
      console.error(`Response: ${err.response?.data ? JSON.stringify(err.response.data) : 'No response'}`);
    }
    
    console.log('\n---\n');
    
    // Test 2: Get debug hospitals endpoint
    console.log('Test 2: GET /api/auth/hospitals/debug (debug endpoint)');
    try {
      const response2 = await axios.get(`${API_URL}/auth/hospitals/debug`);
      console.log(`✅ Status: ${response2.status}`);
      console.log(`✅ Total hospitals in DB: ${response2.data.debug.totalCount}`);
      console.log(`✅ Active hospitals: ${response2.data.debug.activeCount}`);
      if (response2.data.debug.allHospitals.length > 0) {
        console.log(`\n📋 All hospitals:`);
        response2.data.debug.allHospitals.forEach(h => {
          console.log(`   - ${h.name} (isActive: ${h.isActive}, type: ${h.type})`);
        });
      }
    } catch (err) {
      console.error(`❌ Error: ${err.response?.status} - ${err.message}`);
    }
    
    console.log('\n---\n');
    
    // Test 3: Compare results
    const response1 = await axios.get(`${API_URL}/auth/hospitals`);
    const response2 = await axios.get(`${API_URL}/auth/hospitals/debug`);
    
    const mainCount = response1.data.data.count;
    const totalCount = response2.data.debug.totalCount;
    const activeCount = response2.data.debug.activeCount;
    
    console.log('Test 3: Comparison Results');
    console.log(`📊 Main endpoint returns: ${mainCount} hospitals (active only)`);
    console.log(`📊 Debug shows: ${totalCount} total, ${activeCount} active`);
    
    if (mainCount === activeCount) {
      console.log(`✅ MATCH: Main endpoint correctly returns active hospitals`);
    } else {
      console.log(`❌ MISMATCH: Main endpoint returns ${mainCount}, but ${activeCount} are active`);
      if (activeCount > mainCount) {
        console.log(`   → Query might be filtering incorrectly`);
      } else if (mainCount > activeCount) {
        console.log(`   → Some hospitals might not be marked as active`);
      }
    }
    
    if (activeCount < totalCount) {
      console.log(`⚠️  WARNING: ${totalCount - activeCount} inactive hospitals in database`);
    }
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
  
  console.log('\n✅ Test complete\n');
  process.exit(0);
}

testHospitalFlow();
