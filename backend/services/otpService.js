/**
 * OTP Service - Twilio-ready structure
 * In development: logs OTP to console
 * In production: sends via Twilio
 */

const crypto = require('crypto');

const TWILIO_ENABLED = process.env.TWILIO_ENABLED === 'true';
let twilioClient = null;

if (TWILIO_ENABLED) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    console.log('✓ Twilio client initialized');
  } catch (error) {
    console.warn('⚠ Twilio not installed. Run: npm install twilio');
  }
}

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Hash OTP for storage
 */
const hashOTP = (otp) => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

/**
 * Send OTP via SMS
 */
const sendOTP = async (phone, otp) => {
  const message = `Your MedChain verification code is: ${otp}. Valid for 10 minutes.`;
  
  if (process.env.NODE_ENV !== 'production' || !TWILIO_ENABLED) {
    console.log('\n========================================');
    console.log('📱 OTP SENT (Development Mode)');
    console.log(`   Phone: ${phone}`);
    console.log(`   OTP: ${otp}`);
    console.log('========================================\n');
    return { success: true, mode: 'development' };
  }
  
  if (!twilioClient) {
    throw new Error('Twilio not configured');
  }
  
  const result = await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone
  });
  
  return { success: true, mode: 'production', messageId: result.sid };
};

module.exports = { generateOTP, hashOTP, sendOTP };
