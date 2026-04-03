const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const dirs = ['config', 'models', 'utils'];

// Create directories
dirs.forEach(dir => {
  const dirPath = path.join(baseDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  } else {
    console.log(`⊘ Directory already exists: ${dir}`);
  }
});

// Create database.js
const databaseConfig = `const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    
    if (!mongoURI) {
      throw new Error('MONGO_URI environment variable is not defined');
    }

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    };

    const conn = await mongoose.connect(mongoURI, options);

    console.log(\`MongoDB Connected: \${conn.connection.host}\`);

    mongoose.connection.on('error', (err) => {
      console.error(\`MongoDB connection error: \${err}\`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error(\`Error connecting to MongoDB: \${error.message}\`);
    process.exit(1);
  }
};

module.exports = connectDB;
`;

fs.writeFileSync(path.join(baseDir, 'config', 'database.js'), databaseConfig);
console.log('✓ Created config/database.js');

console.log('\n✓ Setup complete! Now run: node server.js');
