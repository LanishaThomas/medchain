const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || '15m';
const REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES || '30d';

/**
 * Generate access token (short-lived)
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: ACCESS_TOKEN_EXPIRES,
    issuer: 'medchain',
    subject: payload.id?.toString() || payload.userId?.toString()
  });
};

/**
 * Generate refresh token (long-lived, random string)
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Generate both tokens
 */
const generateAuthTokens = (user) => {
  const payload = {
    id: user._id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    hospitalId: user.hospitalId || null
  };
  
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken();
  
  return {
    accessToken,
    refreshToken,
    accessTokenExpires: getExpiryTime(ACCESS_TOKEN_EXPIRES),
    refreshTokenExpires: getExpiryTime(REFRESH_TOKEN_EXPIRES)
  };
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: 'medchain' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token expired');
    }
    throw new Error('Invalid access token');
  }
};

/**
 * Decode token without verification (for debugging)
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

/**
 * Hash refresh token for storage
 */
const hashRefreshToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Calculate expiry time from duration string
 */
const getExpiryTime = (duration) => {
  const units = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000
  };
  
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return Date.now() + 24 * 60 * 60 * 1000; // default 1 day
  
  const [, value, unit] = match;
  return Date.now() + parseInt(value) * units[unit];
};

// Legacy function for backward compatibility
const generateToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = { 
  generateAccessToken,
  generateRefreshToken,
  generateAuthTokens,
  verifyAccessToken,
  decodeToken,
  hashRefreshToken,
  getExpiryTime,
  // Legacy
  generateToken, 
  verifyToken
};
