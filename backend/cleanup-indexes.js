/**
 * Fix duplicate indexes warning
 * Run once to clean up MongoDB indexes
 */

require('dotenv').config();
const mongoose = require('mongoose');

const cleanupIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get User collection
    const userCollection = mongoose.connection.collection('users');
    
    // Get all indexes
    const indexes = await userCollection.getIndexes();
    console.log('Current indexes:', indexes);

    // Drop duplicate indexes (keep the unique ones)
    for (const indexName in indexes) {
      const indexSpec = indexes[indexName];
      // Drop duplicate non-unique indexes on email and phone
      if (indexName.startsWith('email_') && !indexSpec.unique) {
        await userCollection.dropIndex(indexName);
        console.log('Dropped:', indexName);
      }
      if (indexName.startsWith('phone_') && !indexSpec.unique) {
        await userCollection.dropIndex(indexName);
        console.log('Dropped:', indexName);
      }
    }

    console.log('✓ Indexes cleaned up');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

cleanupIndexes();
