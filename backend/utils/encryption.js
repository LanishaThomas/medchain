/**
 * Encryption utility for Emergency QR tokens
 * Uses AES-256-GCM for authenticated encryption
 */

const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.EMERGENCY_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt data for QR code
 * @param {Object} data - Data to encrypt (patientId, expiry, etc.)
 * @returns {string} - Base64 encoded encrypted string
 */
function encrypt(data) {
  if (!ENCRYPTION_KEY) {
    throw new Error('EMERGENCY_ENCRYPTION_KEY not set in environment');
  }
  
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('EMERGENCY_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const jsonData = JSON.stringify(data);
  let encrypted = cipher.update(jsonData, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Combine: IV (16 bytes) + AuthTag (16 bytes) + Encrypted data
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'hex')
  ]);
  
  return combined.toString('base64url'); // URL-safe base64
}

/**
 * Decrypt QR token data
 * @param {string} encryptedData - Base64 encoded encrypted string
 * @returns {Object|null} - Decrypted data or null if invalid
 */
function decrypt(encryptedData) {
  if (!ENCRYPTION_KEY) {
    throw new Error('EMERGENCY_ENCRYPTION_KEY not set in environment');
  }
  
  try {
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const combined = Buffer.from(encryptedData, 'base64url');
    
    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return null;
  }
}

/**
 * Generate a unique access token for QR
 * @returns {string} - Random 32-byte hex token
 */
function generateAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage comparison
 * @param {string} token - Token to hash
 * @returns {string} - SHA-256 hash of token
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  encrypt,
  decrypt,
  generateAccessToken,
  hashToken
};
