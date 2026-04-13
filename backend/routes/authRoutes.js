const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { protect, restrictTo, isHospitalAdmin } = require("../middleware/authMiddleware");
const { 
  validate,
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
  changePasswordSchema
} = require("../utils/validators");

// ============================================
// HOSPITAL REGISTRATION
// ============================================

/**
 * @route   POST /api/auth/hospital/register
 * @desc    Register a new hospital (creates hospital + admin account)
 * @access  Public
 */
router.post(
  "/hospital/register",
  validate(hospitalRegisterSchema),
  authController.registerHospital
);

/**
 * @route   GET /api/auth/hospitals
 * @desc    Get list of all active hospitals (for doctor registration)
 * @access  Public
 */
router.get("/hospitals", authController.getHospitals);

/**
 * @route   GET /api/auth/hospitals/debug
 * @desc    Debug: Get all hospitals regardless of isActive status
 * @access  Public
 */
router.get("/hospitals/debug", authController.getHospitalsDebug);

// ============================================
// DOCTOR REGISTRATION
// ============================================

/**
 * @route   POST /api/auth/doctor/register
 * @desc    Register as a doctor (pending hospital approval)
 * @access  Public
 */
router.post(
  "/doctor/register",
  validate(doctorRegisterSchema),
  authController.registerDoctor
);

// ============================================
// PATIENT REGISTRATION
// ============================================

/**
 * @route   POST /api/auth/patient/register
 * @desc    Register a new patient with email/password
 * @access  Public
 */
router.post(
  "/patient/register",
  authController.registerPatient
);

// ============================================
// PATIENT OTP FLOW (DEPRECATED)
// ============================================

/**
 * @route   POST /api/auth/patient/request-otp
 * @desc    Request OTP for patient login/registration
 * @access  Public
 */
router.post(
  "/patient/request-otp",
  validate(otpRequestSchema),
  authController.requestOTP
);

/**
 * @route   POST /api/auth/patient/verify-otp
 * @desc    Verify OTP and login/register patient
 * @access  Public
 */
router.post(
  "/patient/verify-otp",
  validate(otpVerifySchema),
  authController.verifyOTP
);

// ============================================
// CAREGIVER FLOW
// ============================================

/**
 * @route   POST /api/auth/caregiver/invite
 * @desc    Patient invites a caregiver
 * @access  Private (Patient only)
 */
router.post(
  "/caregiver/invite",
  protect,
  restrictTo('patient'),
  validate(caregiverInviteSchema),
  authController.inviteCaregiver
);

/**
 * @route   POST /api/auth/caregiver/accept
 * @desc    Caregiver accepts invitation
 * @access  Public
 */
router.post(
  "/caregiver/accept",
  validate(caregiverAcceptSchema),
  authController.acceptCaregiverInvite
);

// ============================================
// LOGIN / LOGOUT
// ============================================

/**
 * @route   POST /api/auth/login
 * @desc    Login with email/password (doctors, hospital admins, caregivers)
 * @access  Public
 */
router.post(
  "/login",
  validate(loginSchema),
  authController.login
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout (invalidate refresh token)
 * @access  Private
 */
router.post(
  "/logout",
  protect,
  authController.logout
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post(
  "/logout-all",
  protect,
  authController.logoutAll
);

// ============================================
// TOKEN REFRESH
// ============================================

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post(
  "/refresh",
  validate(refreshTokenSchema),
  authController.refreshToken
);

// ============================================
// PASSWORD MANAGEMENT
// ============================================

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post(
  "/forgot-password",
  validate(passwordResetRequestSchema),
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  "/reset-password",
  validate(passwordResetSchema),
  authController.resetPassword
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password (authenticated)
 * @access  Private
 */
router.post(
  "/change-password",
  protect,
  validate(changePasswordSchema),
  authController.changePassword
);

// ============================================
// CURRENT USER
// ============================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get(
  "/me",
  protect,
  authController.getMe
);

// ============================================
// EMAIL VERIFICATION (Supabase layer)
// ============================================

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend Supabase verification email
 * @access  Private
 */
router.post(
  "/resend-verification",
  protect,
  authController.resendVerification
);

/**
 * @route   GET /api/auth/verification-status
 * @desc    Get email verification status
 * @access  Private
 */
router.get(
  "/verification-status",
  protect,
  authController.getVerificationStatus
);

// ============================================
// TEST ROUTES
// ============================================

/**
 * @route   GET /api/auth/protected
 * @desc    Test protected route
 * @access  Private
 */
router.get("/protected", protect, (req, res) => {
  res.json({ 
    success: true,
    message: "Access granted", 
    user: req.user 
  });
});

/**
 * @route   GET /api/auth/hospital-admin-only
 * @desc    Test hospital admin only route
 * @access  Private (Hospital Admin only)
 */
router.get("/hospital-admin-only", protect, isHospitalAdmin, (req, res) => {
  res.json({ 
    success: true,
    message: "Hospital admin access granted", 
    user: req.user 
  });
});

module.exports = router;