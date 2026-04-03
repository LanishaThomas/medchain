require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('=== ALL USERS AND THEIR ROLES ===\n');
  
  const users = await User.find({}).select('email firstName lastName role isActive');
  
  users.forEach(u => {
    console.log(`${u.email} | ${u.firstName} ${u.lastName} | Role: ${u.role} | Active: ${u.isActive}`);
  });
  
  console.log('\n=== SUMMARY ===');
  const doctors = users.filter(u => u.role === 'doctor');
  const patients = users.filter(u => u.role === 'patient');
  const admins = users.filter(u => u.role === 'hospital_admin');
  
  console.log(`Doctors: ${doctors.length}`);
  console.log(`Patients: ${patients.length}`);
  console.log(`Hospital Admins: ${admins.length}`);
  
  mongoose.disconnect();
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
