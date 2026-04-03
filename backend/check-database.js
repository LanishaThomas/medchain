require('dotenv').config();
const mongoose = require('mongoose');

async function checkDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check all collections
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log('📊 DATABASE CONTENTS:\n');
    console.log('='*.repeat(50));
    
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`\n📁 ${coll.name}: ${count} documents`);
      
      // Show a few sample records
      if (count > 0) {
        const samples = await db.collection(coll.name).find({}).limit(3).toArray();
        samples.forEach((doc, i) => {
          if (coll.name === 'users') {
            console.log(`   ${i+1}. ${doc.firstName} ${doc.lastName} (${doc.role}) - ${doc.email}`);
          } else if (coll.name === 'hospitals') {
            console.log(`   ${i+1}. ${doc.name} - Active: ${doc.isActive}`);
          } else if (coll.name === 'appointments') {
            console.log(`   ${i+1}. ${doc.appointmentNumber} - Status: ${doc.status}`);
          } else if (coll.name === 'doctorhospitalmappings') {
            console.log(`   ${i+1}. Doctor ${doc.doctor} at Hospital ${doc.hospital} - Status: ${doc.status}`);
          } else if (coll.name === 'permissions') {
            console.log(`   ${i+1}. Patient ${doc.patient} → Doctor ${doc.doctor} - Status: ${doc.status}`);
          } else {
            console.log(`   ${i+1}. ID: ${doc._id}`);
          }
        });
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('\n✅ All data is stored in MongoDB and persists!');
    console.log('💡 When you log back in, you will see all your data.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
