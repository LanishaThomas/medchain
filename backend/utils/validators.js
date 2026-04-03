const { z } = require('zod');

// ============================================
// COMMON VALIDATORS
// ============================================

const phoneRegex = /^\+?[1-9]\d{9,14}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Helper function to validate password
const validatePassword = (pwd) => {
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const hasSpecial = /[@$!%*?&]/.test(pwd);
  const isLongEnough = pwd.length >= 8;
  
  return hasLower && hasUpper && hasDigit && hasSpecial && isLongEnough;
};

const phoneSchema = z.string()
  .regex(phoneRegex, 'Invalid phone number format. Use international format: +1234567890');

// Optional phone - allows empty strings
const optionalPhoneSchema = z.string()
  .or(z.literal(''))  // Allow empty string
  .refine(val => !val || /^\+?[1-9]\d{9,14}$/.test(val), 
    'Invalid phone number format. Use international format: +1234567890');

const emailSchema = z.string()
  .email('Invalid email address')
  .toLowerCase();

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    (pwd) => /[a-z]/.test(pwd),
    'Password must contain at least one lowercase letter (a-z)'
  )
  .refine(
    (pwd) => /[A-Z]/.test(pwd),
    'Password must contain at least one uppercase letter (A-Z)'
  )
  .refine(
    (pwd) => /\d/.test(pwd),
    'Password must contain at least one number (0-9)'
  )
  .refine(
    (pwd) => /[@$!%*?&]/.test(pwd),
    'Password must contain at least one special character (@$!%*?&)'
  );

const objectIdSchema = z.string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID format');

// Flexible date schema (accepts ISO string or date string)
const dateSchema = z.string()
  .refine(val => !isNaN(Date.parse(val)), 'Invalid date format');

// ============================================
// AUTH VALIDATORS
// ============================================

// Hospital Registration
const hospitalRegisterSchema = z.object({
  // Hospital Info
  hospitalName: z.string()
    .min(2, 'Hospital name must be at least 2 characters')
    .max(200, 'Hospital name cannot exceed 200 characters'),
  registrationNumber: z.string()
    .min(1, 'Registration number is required'),
  licenseNumber: z.string()
    .min(1, 'License number is required'),
  licenseExpiry: dateSchema.optional(),
  hospitalType: z.enum(['general', 'specialty', 'teaching', 'community', 'clinic', 'urgent_care'])
    .default('general'),
  hospitalEmail: emailSchema,
  hospitalPhone: phoneSchema,
  
  // Address
  address: z.object({
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().min(1, 'Zip code is required'),
    country: z.string().default('USA')
  }),
  
  // Admin Info (creates hospital admin account)
  adminFirstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name cannot exceed 50 characters'),
  adminLastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name cannot exceed 50 characters'),
  adminEmail: emailSchema,
  adminPassword: passwordSchema,
  adminPhone: optionalPhoneSchema.optional(),
  
  // Optional
  specialties: z.array(z.string()).optional(),
  description: z.string().max(2000).optional()
});

// Doctor Registration
const doctorRegisterSchema = z.object({
  // Personal Info
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name cannot exceed 50 characters'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name cannot exceed 50 characters'),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
  
  // Doctor Profile
  licenseNumber: z.string()
    .min(1, 'Medical license number is required'),
  licenseState: z.string()
    .min(1, 'License state is required'),
  licenseExpiry: dateSchema.optional(),
  specializations: z.array(z.string())
    .min(1, 'At least one specialization is required'),
  yearsOfExperience: z.number()
    .min(0, 'Years of experience cannot be negative')
    .optional(),
  bio: z.string()
    .max(1000, 'Bio cannot exceed 1000 characters')
    .optional(),
  
  // Hospital to join
  hospitalId: objectIdSchema,
  applicationNote: z.string()
    .max(1000, 'Application note cannot exceed 1000 characters')
    .optional(),
  
  // Employment details
  employmentType: z.enum(['full_time', 'part_time', 'visiting', 'consultant', 'resident', 'intern'])
    .default('full_time'),
  department: z.string().optional()
});

// Patient Registration (OTP-based)
const patientRegisterSchema = z.object({
  phone: phoneSchema,
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50),
  email: emailSchema.optional(),
  dateOfBirth: dateSchema.optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say'])
    .optional()
});

// Patient OTP Request
const otpRequestSchema = z.object({
  phone: phoneSchema
});

// Patient OTP Verify
const otpVerifySchema = z.object({
  phone: phoneSchema,
  otp: z.string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d+$/, 'OTP must contain only digits'),
  // For new user registration
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name cannot exceed 50 characters')
    .optional(),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name cannot exceed 50 characters')
    .optional(),
  email: emailSchema.optional(),
  dateOfBirth: dateSchema.optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say'])
    .optional()
});

// Email/Password Login (for doctors and hospital admins)
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required')
});

// Refresh Token
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

// Caregiver Invite
const caregiverInviteSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  permissions: z.object({
    canViewRecords: z.boolean().default(false),
    canBookAppointments: z.boolean().default(false),
    canReceiveNotifications: z.boolean().default(true)
  }).optional()
}).refine(data => data.email || data.phone, {
  message: 'Either email or phone is required'
});

// Caregiver Accept Invite
const caregiverAcceptSchema = z.object({
  inviteToken: z.string().min(1, 'Invite token is required'),
  password: passwordSchema,
  phone: phoneSchema.optional()
});

// Password Reset Request
const passwordResetRequestSchema = z.object({
  email: emailSchema
});

// Password Reset
const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema
});

// Change Password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema
});

// ============================================
// DOCTOR APPROVAL VALIDATORS
// ============================================

const doctorApprovalSchema = z.object({
  notes: z.string().max(1000).optional()
});

const doctorRejectionSchema = z.object({
  reason: z.string()
    .min(1, 'Rejection reason is required')
    .max(1000)
});

// ============================================
// VALIDATION MIDDLEWARE FACTORY
// ============================================

const validate = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    // Replace req.body with validated data (includes transformations)
    req.body = result.data;
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: error.message
    });
  }
};

// Validate query params
const validateQuery = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors
      });
    }
    
    req.query = result.data;
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: error.message
    });
  }
};

// Validate params
const validateParams = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse(req.params);
    
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        errors
      });
    }
    
    req.params = result.data;
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: error.message
    });
  }
};

module.exports = {
  // Schemas
  hospitalRegisterSchema,
  doctorRegisterSchema,
  patientRegisterSchema,
  otpRequestSchema,
  otpVerifySchema,
  loginSchema,
  refreshTokenSchema,
  caregiverInviteSchema,
  caregiverAcceptSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  changePasswordSchema,
  doctorApprovalSchema,
  doctorRejectionSchema,
  objectIdSchema,
  
  // Middleware
  validate,
  validateQuery,
  validateParams
};
