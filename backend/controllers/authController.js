const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const DoctorHospitalMapping = require('../models/DoctorHospitalMapping');
const { generateAuthTokens, hashRefreshToken } = require('../utils/jwt');
const { writeAuditLog, buildDeterministicHash } = require('../services/blockchainAuditService');
const { getVerificationStatusForEntity } = require('../services/entityVerificationService');
const { createSupabaseUser } = require('../services/supabaseService');

/**
 * Fire-and-forget Supabase user creation after MongoDB registration.
 * Errors are logged but never propagate — registration must not fail.
 */
const attachSupabaseVerification = async (mongoUser, password) => {
  try {
    const { supabaseUserId } = await createSupabaseUser(mongoUser.email, password);
    await User.findByIdAndUpdate(mongoUser._id, { supabaseUserId });
    console.log(`[Supabase] Verification email sent to ${mongoUser.email}`);
  } catch (err) {
    console.error(`[Supabase] Failed to create verification user for ${mongoUser.email}:`, err.message);
    // Non-fatal — user can retry via /api/auth/resend-verification
  }
};

// ============================================
// HOSPITAL REGISTRATION
// ============================================

/**
 * @desc    Register a new hospital (also creates hospital admin account)
 * @route   POST /api/auth/hospital/register
 * @access  Public
 */
exports.registerHospital = async (req, res, next) => {
  try {
    const {
      // Hospital info
      hospitalName,
      registrationNumber,
      licenseNumber,
      licenseExpiry,
      hospitalType,
      hospitalEmail,
      hospitalPhone,
      address,
      specialties,
      description,
      // Admin info
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPassword,
      adminPhone
    } = req.body;

    // Check if hospital already exists
    const existingHospital = await Hospital.findOne({ registrationNumber });
    if (existingHospital) {
      return res.status(400).json({
        success: false,
        message: 'Hospital with this registration number already exists'
      });
    }

    // Check if admin email already exists
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    console.log('Creating admin user with email:', adminEmail);

    // ── Pre-generate IDs so we can hash before writing to MongoDB ────────────
    const adminUserId = new mongoose.Types.ObjectId();
    const hospitalId  = new mongoose.Types.ObjectId();

    // ── Build deterministic data payloads ────────────────────────────────────
    const hospitalData = {
      id: hospitalId.toString(),
      name: hospitalName,
      registrationNumber,
      licenseNumber,
      email: hospitalEmail,
      phone: hospitalPhone,
      address,
      type: hospitalType || 'general',
      specialties: specialties || []
    };

    const adminUserData = {
      id: adminUserId.toString(),
      role: 'hospital_admin',
      email: adminEmail,
      firstName: adminFirstName,
      lastName: adminLastName,
      hospitalId: hospitalId.toString()
    };

    // ── Write blockchain FIRST — if this fails, nothing is stored ─────────────
    let hospitalAuditDoc, adminAuditDoc;
    try {
      hospitalAuditDoc = await writeAuditLog({
        entityType: 'HOSPITAL_PROFILE',
        entityId: hospitalId.toString(),
        actorId: adminUserId.toString(),
        actionType: 'CREATE',
        data: hospitalData,
        metadata: { role: 'hospital_admin' }
      });

      adminAuditDoc = await writeAuditLog({
        entityType: 'USER_PROFILE',
        entityId: adminUserId.toString(),
        actorId: adminUserId.toString(),
        actionType: 'CREATE',
        data: adminUserData,
        metadata: { role: 'hospital_admin' }
      });
    } catch (blockchainErr) {
      console.error('🔴 Blockchain write failed — registration aborted:', blockchainErr.message);
      return res.status(503).json({
        success: false,
        message: 'Registration failed: could not write to blockchain. Please try again.',
        details: blockchainErr.code === 'INSUFFICIENT_FUNDS'
          ? 'Blockchain wallet has insufficient funds.'
          : blockchainErr.message
      });
    }

    // ── Blockchain succeeded — now persist to MongoDB ─────────────────────────
    const adminUser = await User.create({
      _id: adminUserId,
      email: adminEmail,
      password: adminPassword,
      phone: adminPhone,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: 'hospital_admin',
      isEmailVerified: false,
      blockchainHash: adminAuditDoc.dataHash,
      blockchainTxHash: adminAuditDoc.blockchainTxHash
    });

    console.log('Admin user created:', adminUser._id);

    // Create hospital with admin reference
    const hospital = await Hospital.create({
      _id: hospitalId,
      name: hospitalName,
      registrationNumber,
      licenseNumber,
      licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : undefined,
      type: hospitalType,
      email: hospitalEmail,
      phone: hospitalPhone,
      address,
      specialties: specialties || [],
      description,
      primaryAdmin: adminUser._id,
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      isActive: true,
      blockchainHash: hospitalAuditDoc.dataHash,
      blockchainTxHash: hospitalAuditDoc.blockchainTxHash
    });

    console.log('✅ Hospital created:', { 
      id: hospital._id, 
      name: hospital.name, 
      isActive: hospital.isActive,
      verificationStatus: hospital.verificationStatus 
    });

    // Update admin with hospital reference
    adminUser.hospitalId = hospital._id;
    await adminUser.save();

    console.log('Admin user updated with hospital reference');

    // Generate tokens
    const tokens = generateAuthTokens(adminUser);
    
    console.log('Tokens generated');

    // Store refresh token
    adminUser.addRefreshToken(tokens.refreshToken, req.headers['user-agent'], req.ip);
    await adminUser.save();

    console.log('Refresh token stored, hospital registration complete');

    // Supabase: send verification email to hospital admin (non-blocking)
    attachSupabaseVerification(adminUser, adminPassword);

    res.status(201).json({
      success: true,
      message: 'Hospital registered successfully. A verification email has been sent — please check your inbox.',
      data: {
        hospital: {
          id: hospital._id,
          name: hospital.name,
          slug: hospital.slug,
          registrationNumber: hospital.registrationNumber,
          verificationStatus: hospital.verificationStatus
        },
        admin: {
          id: adminUser._id,
          email: adminUser.email,
          fullName: adminUser.fullName,
          role: adminUser.role,
          emailVerificationRequired: true
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.accessTokenExpires
        }
      }
    });
  } catch (error) {
    console.error('🔴 Hospital registration error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
      details: error.errors ? Object.entries(error.errors).map(([k, v]) => `${k}: ${v.message}`) : 'N/A'
    });
    next(error);
  }
};

// ============================================
// DOCTOR REGISTRATION
// ============================================

/**
 * @desc    Register a doctor (pending hospital approval)
 * @route   POST /api/auth/doctor/register
 * @access  Public
 */
exports.registerDoctor = async (req, res, next) => {
  try {
    console.log('📝 Doctor registration request:', {
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      licenseNumber: req.body.licenseNumber,
      specializations: req.body.specializations,
      hospitalId: req.body.hospitalId
    });
    
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      licenseNumber,
      licenseState,
      licenseExpiry,
      specializations,
      yearsOfExperience,
      bio,
      hospitalId,
      applicationNote,
      employmentType,
      department,
      offersOnlineConsultation,
      onlineConsultationFee
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if hospital exists
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    if (!hospital.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This hospital is not accepting applications'
      });
    }

    // ── Pre-generate IDs ──────────────────────────────────────────────────────
    const doctorId  = new mongoose.Types.ObjectId();
    const mappingId = new mongoose.Types.ObjectId();
    const appliedAt = new Date();

    const doctorData = {
      id: doctorId.toString(),
      role: 'doctor',
      email,
      firstName,
      lastName,
      doctorProfile: {
        licenseNumber,
        licenseState,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry).toISOString() : null,
        specializations: specializations || [],
        yearsOfExperience,
        bio
      }
    };

    const mappingData = {
      mappingId: mappingId.toString(),
      doctorId: doctorId.toString(),
      hospitalId: hospital._id.toString(),
      status: 'pending',
      employmentType: employmentType || 'full_time',
      department,
      appliedAt
    };

    // ── Blockchain FIRST ──────────────────────────────────────────────────────
    let doctorAuditDoc, mappingAuditDoc;
    try {
      doctorAuditDoc = await writeAuditLog({
        entityType: 'USER_PROFILE',
        entityId: doctorId.toString(),
        actorId: doctorId.toString(),
        actionType: 'CREATE',
        data: doctorData,
        metadata: { hospitalId: hospital._id.toString() }
      });

      mappingAuditDoc = await writeAuditLog({
        entityType: 'DOCTOR_REGISTRY',
        entityId: mappingId.toString(),
        actorId: doctorId.toString(),
        actionType: 'CREATE',
        data: mappingData,
        metadata: { event: 'DOCTOR_REGISTRATION_REQUEST' }
      });
    } catch (blockchainErr) {
      console.error('🔴 Blockchain write failed — doctor registration aborted:', blockchainErr.message);
      return res.status(503).json({
        success: false,
        message: 'Registration failed: could not write to blockchain. Please try again.',
        details: blockchainErr.code === 'INSUFFICIENT_FUNDS'
          ? 'Blockchain wallet has insufficient funds.'
          : blockchainErr.message
      });
    }

    // ── MongoDB — only after blockchain confirmed ─────────────────────────────
    // Create doctor user
    const doctor = await User.create({
      _id: doctorId,
      email,
      password,
      phone,
      firstName,
      lastName,
      role: 'doctor',
      blockchainHash: doctorAuditDoc.dataHash,
      blockchainTxHash: doctorAuditDoc.blockchainTxHash,
      doctorProfile: {
        licenseNumber,
        licenseState,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : undefined,
        specializations,
        yearsOfExperience,
        bio,
        offersOnlineConsultation: Boolean(offersOnlineConsultation),
        onlineConsultationFee: offersOnlineConsultation ? Number(onlineConsultationFee || 0) : 0
      }
    });

    // Create pending mapping to hospital
    const mapping = await DoctorHospitalMapping.create({
      _id: mappingId,
      doctor: doctor._id,
      hospital: hospital._id,
      applicationNote,
      employmentType: employmentType || 'full_time',
      department,
      specialtiesAtHospital: specializations,
      status: 'pending',
      appliedAt
    });

    // Generate tokens
    const tokens = generateAuthTokens(doctor);
    
    // Store refresh token
    doctor.addRefreshToken(tokens.refreshToken, req.headers['user-agent'], req.ip);
    await doctor.save();

    // Supabase: send verification email (non-blocking)
    attachSupabaseVerification(doctor, password);

    const userVerificationStatus = await getVerificationStatusForEntity({
      entityType: 'USER_PROFILE',
      entityId: doctor._id,
      dbHash: doctor.blockchainHash
    });

    const applicationVerificationStatus = await getVerificationStatusForEntity({
      entityType: 'DOCTOR_REGISTRY',
      entityId: mapping._id,
      dbHash: null
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Awaiting hospital approval. A verification email has been sent — please check your inbox.',
      data: {
        user: {
          id: doctor._id,
          email: doctor.email,
          fullName: doctor.fullName,
          role: doctor.role,
          verificationStatus: userVerificationStatus
        },
        application: {
          id: mapping._id,
          hospitalName: hospital.name,
          status: mapping.status,
          appliedAt: mapping.appliedAt,
          verificationStatus: applicationVerificationStatus
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.accessTokenExpires
        }
      }
    });
  } catch (error) {
    console.error('❌ Doctor registration error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      details: error.errors ? Object.entries(error.errors).map(([k, v]) => `${k}: ${v.message}`) : 'N/A'
    });
    next(error);
  }
};

// ============================================
// PATIENT REGISTRATION (PASSWORD)
// ============================================

/**
 * @desc    Register a patient with email/password
 * @route   POST /api/auth/patient/register
 * @access  Public
 */
exports.registerPatient = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      dateOfBirth,
      gender,
      bloodType,
      allergies,
      chronicConditions
    } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Check if phone already exists
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered'
        });
      }
    }

    // ── Pre-generate ID ───────────────────────────────────────────────────────
    const patientId = new mongoose.Types.ObjectId();

    const patientData = {
      id: patientId.toString(),
      role: 'patient',
      email,
      firstName,
      lastName,
      phone,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender,
      patientProfile: {
        bloodType,
        allergies: allergies || [],
        chronicConditions: chronicConditions || []
      }
    };

    // ── Blockchain FIRST ──────────────────────────────────────────────────────
    let patientAuditDoc;
    try {
      patientAuditDoc = await writeAuditLog({
        entityType: 'USER_PROFILE',
        entityId: patientId.toString(),
        actorId: patientId.toString(),
        actionType: 'CREATE',
        data: patientData,
        metadata: { excluded: ['mental_health_chat'] }
      });
    } catch (blockchainErr) {
      console.error('🔴 Blockchain write failed — patient registration aborted:', blockchainErr.message);
      return res.status(503).json({
        success: false,
        message: 'Registration failed: could not write to blockchain. Please try again.',
        details: blockchainErr.code === 'INSUFFICIENT_FUNDS'
          ? 'Blockchain wallet has insufficient funds.'
          : blockchainErr.message
      });
    }

    // ── MongoDB — only after blockchain confirmed ─────────────────────────────
    // Create patient user
    const patient = await User.create({
      _id: patientId,
      email,
      password,
      phone,
      firstName,
      lastName,
      role: 'patient',
      blockchainHash: patientAuditDoc.dataHash,
      blockchainTxHash: patientAuditDoc.blockchainTxHash,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender,
      patientProfile: {
        bloodType,
        allergies: allergies || [],
        chronicConditions: chronicConditions || []
      }
    });

    // Generate tokens
    const tokens = generateAuthTokens(patient);
    
    // Store refresh token
    patient.addRefreshToken(tokens.refreshToken, req.headers['user-agent'], req.ip);
    await patient.save();

    // Supabase: send verification email (non-blocking)
    attachSupabaseVerification(patient, password);

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully. A verification email has been sent — please check your inbox.',
      data: {
        user: {
          id: patient._id,
          email: patient.email,
          firstName: patient.firstName,
          lastName: patient.lastName,
          role: patient.role,
          emailVerificationRequired: true
        },
        tokens
      }
    });
  } catch (error) {
    console.error('Patient registration error:', error);
    next(error);
  }
};

// ============================================
// PATIENT REGISTRATION (OTP) - DEPRECATED
// ============================================

/**
 * @desc    Request OTP for patient login/registration
 * @route   POST /api/auth/patient/request-otp
 * @access  Public
 */
exports.requestOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;

    // Find or prepare user
    let user = await User.findOne({ phone });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      // Don't create user yet, just acknowledge we'll need registration data
    }

    // Rate limiting check
    if (user?.otp?.lastSentAt) {
      const timeSinceLastOTP = Date.now() - user.otp.lastSentAt.getTime();
      if (timeSinceLastOTP < 60000) { // 1 minute
        const waitTime = Math.ceil((60000 - timeSinceLastOTP) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitTime} seconds before requesting another OTP`
        });
      }
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (user) {
      user.otp = {
        code: otpHash,
        expiresAt: otpExpiry,
        attempts: 0,
        lastSentAt: new Date()
      };
      await user.save();
    }

    // In production, send OTP via Twilio
    // For development, log to console
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n========================================');
      console.log('📱 OTP SENT (Development Mode)');
      console.log(`   Phone: ${phone}`);
      console.log(`   OTP: ${otp}`);
      console.log('========================================\n');
    } else {
      // TODO: Integrate Twilio here
      // await twilioClient.messages.create({
      //   body: `Your MedChain OTP is: ${otp}. Valid for 10 minutes.`,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to: phone
      // });
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        phone,
        isNewUser,
        expiresAt: otpExpiry,
        // Include OTP in development mode
        ...(process.env.NODE_ENV !== 'production' && { otp })
      }
    });

    // Store OTP for new users temporarily
    if (isNewUser) {
      // Store in memory cache or Redis in production
      global.pendingOTPs = global.pendingOTPs || {};
      global.pendingOTPs[phone] = {
        code: otpHash,
        expiresAt: otpExpiry,
        attempts: 0
      };
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP and login/register patient
 * @route   POST /api/auth/patient/verify-otp
 * @access  Public
 */
exports.verifyOTP = async (req, res, next) => {
  try {
    const { phone, otp, firstName, lastName, email, dateOfBirth, gender } = req.body;

    console.log('📱 OTP Verification attempt:', { phone, otp: '***', isNewUser: !firstName });

    // Find existing user or check pending OTP
    let user = await User.findOne({ phone }).select('+otp.code');
    let storedOTP;

    if (user) {
      storedOTP = user.otp;
    } else {
      // Check pending OTPs for new users
      storedOTP = global.pendingOTPs?.[phone];
    }

    if (!storedOTP || !storedOTP.code) {
      console.log('❌ No OTP found for phone:', phone);
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new one.'
      });
    }

    // Check expiry
    if (new Date(storedOTP.expiresAt) < Date.now()) {
      console.log('❌ OTP expired for phone:', phone);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Check attempts
    if (storedOTP.attempts >= 3) {
      console.log('❌ Too many OTP attempts for phone:', phone);
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.'
      });
    }

    // Verify OTP
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (otpHash !== storedOTP.code) {
      // Increment attempts
      if (user) {
        user.otp.attempts += 1;
        await user.save();
      } else if (global.pendingOTPs?.[phone]) {
        global.pendingOTPs[phone].attempts += 1;
      }

      console.log('❌ Invalid OTP for phone:', phone);
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.'
      });
    }

    console.log('✅ OTP verified for phone:', phone);

    // OTP verified - create or update user
    if (!user) {
      // New user - require firstName and lastName
      if (!firstName || !lastName) {
        return res.status(400).json({
          success: false,
          message: 'First name and last name are required for registration'
        });
      }

      user = await User.create({
        phone,
        firstName,
        lastName,
        email,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender,
        role: 'patient',
        isEmailVerified: !!email
      });

      // Clean up pending OTP
      if (global.pendingOTPs?.[phone]) {
        delete global.pendingOTPs[phone];
      }
    } else {
      // Clear OTP
      user.otp = undefined;
      user.lastLogin = new Date();
      user.lastLoginIp = req.ip;
      await user.save();
    }

    // Generate tokens
    const tokens = generateAuthTokens(user);
    
    // Store refresh token
    user.addRefreshToken(tokens.refreshToken, req.headers['user-agent'], req.ip);
    await user.save();

    res.status(200).json({
      success: true,
      message: user.isNew ? 'Registration successful' : 'Login successful',
      data: {
        user: {
          id: user._id,
          phone: user.phone,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.accessTokenExpires
        }
      }
    });
  } catch (error) {
    console.error('🔴 OTP verification error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    next(error);
  }
};

// ============================================
// CAREGIVER FLOW
// ============================================

/**
 * @desc    Patient invites a caregiver
 * @route   POST /api/auth/caregiver/invite
 * @access  Private (Patient only)
 */
exports.inviteCaregiver = async (req, res, next) => {
  try {
    const { email, phone, firstName, lastName, permissions } = req.body;
    const patientId = req.user.id;

    // Check if patient
    if (req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Only patients can invite caregivers'
      });
    }

    // Check if already a user with this email/phone
    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : [])
      ]
    });

    if (existingUser) {
      // If already a caregiver, just add this patient
      if (existingUser.role === 'caregiver') {
        if (!existingUser.caregiverProfile.patientsUnderCare.includes(patientId)) {
          existingUser.caregiverProfile.patientsUnderCare.push(patientId);
          existingUser.caregiverProfile.permissions = permissions || existingUser.caregiverProfile.permissions;
          await existingUser.save();
        }

        return res.status(200).json({
          success: true,
          message: 'Caregiver added successfully',
          data: {
            caregiver: {
              id: existingUser._id,
              fullName: existingUser.fullName,
              email: existingUser.email
            }
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'This email/phone is already registered with a different role'
        });
      }
    }

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(inviteToken).digest('hex');

    // Create caregiver user with pending status
    const caregiver = await User.create({
      email,
      phone,
      firstName,
      lastName,
      role: 'caregiver',
      isActive: false, // Activate when they accept
      caregiverProfile: {
        invitedBy: patientId,
        inviteToken: hashedToken,
        inviteExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        patientsUnderCare: [patientId],
        permissions: permissions || {
          canViewRecords: false,
          canBookAppointments: false,
          canReceiveNotifications: true
        }
      }
    });

    // In production, send invite via email/SMS
    const inviteUrl = `${process.env.FRONTEND_URL}/caregiver/accept?token=${inviteToken}`;
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n========================================');
      console.log('📧 CAREGIVER INVITE (Development Mode)');
      console.log(`   To: ${email || phone}`);
      console.log(`   Token: ${inviteToken}`);
      console.log(`   URL: ${inviteUrl}`);
      console.log('========================================\n');
    }

    res.status(201).json({
      success: true,
      message: 'Caregiver invitation sent',
      data: {
        caregiver: {
          id: caregiver._id,
          fullName: caregiver.fullName,
          email: caregiver.email,
          phone: caregiver.phone
        },
        inviteExpires: caregiver.caregiverProfile.inviteExpires,
        // Include token in development
        ...(process.env.NODE_ENV !== 'production' && { inviteToken, inviteUrl })
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Caregiver accepts invitation
 * @route   POST /api/auth/caregiver/accept
 * @access  Public
 */
exports.acceptCaregiverInvite = async (req, res, next) => {
  try {
    const { inviteToken, password, phone } = req.body;

    // Hash token to find user
    const hashedToken = crypto.createHash('sha256').update(inviteToken).digest('hex');

    const caregiver = await User.findOne({
      'caregiverProfile.inviteToken': hashedToken,
      'caregiverProfile.inviteExpires': { $gt: Date.now() }
    });

    if (!caregiver) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }

    // Set password and activate account
    caregiver.password = password;
    caregiver.isActive = true;
    if (phone) caregiver.phone = phone;
    caregiver.caregiverProfile.inviteToken = undefined;
    caregiver.caregiverProfile.inviteExpires = undefined;
    await caregiver.save();

    // Generate tokens
    const tokens = generateAuthTokens(caregiver);
    
    // Store refresh token
    caregiver.addRefreshToken(tokens.refreshToken, req.headers['user-agent'], req.ip);
    await caregiver.save();

    res.status(200).json({
      success: true,
      message: 'Account activated successfully',
      data: {
        user: {
          id: caregiver._id,
          email: caregiver.email,
          fullName: caregiver.fullName,
          role: caregiver.role
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.accessTokenExpires
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// LOGIN / LOGOUT
// ============================================

/**
 * @desc    Login with email/password (doctors, hospital admins)
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed attempts. Try again later.'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Reset login attempts on success
    await user.resetLoginAttempts();

    // ── Email verification gate ──────────────────────────────────────────────
    // Block login if email is not verified. For users without a supabaseUserId
    // (registered before Supabase integration), create one now so they get
    // the verification email and are gated going forward.
    if (!user.isEmailVerified) {
      try {
        const { checkEmailVerified, createSupabaseUser } = require('../services/supabaseService');
        const userWithSupabase = await User.findById(user._id).select('+supabaseUserId');
        let supabaseUserId = userWithSupabase?.supabaseUserId;

        if (!supabaseUserId) {
          // First login after integration — create Supabase user & send email
          try {
            const result = await createSupabaseUser(user.email, password);
            supabaseUserId = result.supabaseUserId;
            await User.findByIdAndUpdate(user._id, { supabaseUserId });
          } catch (createErr) {
            console.error('[Login] Could not create Supabase user:', createErr.message);
          }
        }

        if (supabaseUserId) {
          const verified = await checkEmailVerified({ supabaseUserId });
          if (verified) {
            await User.findByIdAndUpdate(user._id, { isEmailVerified: true });
          } else {
            return res.status(403).json({
              success: false,
              emailVerificationRequired: true,
              email: user.email,
              message: 'Please verify your email before logging in. Check your inbox for the verification link.'
            });
          }
        }
      } catch (supabaseErr) {
        // Supabase down — log but allow login so system stays up
        console.error('[Login] Supabase check failed, allowing login:', supabaseErr.message);
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // For doctors, check hospital approval status
    let hospitalInfo = null;
    if (user.role === 'doctor') {
      const mappings = await DoctorHospitalMapping.find({
        doctor: user._id
      }).populate('hospital', 'name slug');
      
      hospitalInfo = mappings.map(m => ({
        hospitalId: m.hospital._id,
        hospitalName: m.hospital.name,
        status: m.status,
        isApproved: m.status === 'approved'
      }));
    }

    // For hospital admins, get hospital info
    if (user.role === 'hospital_admin' && user.hospitalId) {
      const hospital = await Hospital.findById(user.hospitalId).select('name slug');
      if (hospital) {
        hospitalInfo = {
          hospitalId: hospital._id,
          hospitalName: hospital.name,
          hospitalSlug: hospital.slug
        };
      }
    }

    // Generate tokens
    const tokens = generateAuthTokens(user);
    
    // Store refresh token
    user.addRefreshToken(tokens.refreshToken, req.headers['user-agent'], req.ip);
    user.lastLogin = new Date();
    user.lastLoginIp = req.ip;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          hospitalInfo
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.accessTokenExpires
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout (invalidate refresh token)
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId).select('+refreshTokens');
    if (user && refreshToken) {
      user.removeRefreshToken(refreshToken);
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout from all devices
 * @route   POST /api/auth/logout-all
 * @access  Private
 */
exports.logoutAll = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await User.findByIdAndUpdate(userId, {
      $set: { refreshTokens: [] }
    });

    res.status(200).json({
      success: true,
      message: 'Logged out from all devices'
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// TOKEN REFRESH
// ============================================

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Public (with refresh token)
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Find user with this refresh token
    const hashedToken = hashRefreshToken(refreshToken);
    const user = await User.findOne({
      'refreshTokens.token': hashedToken,
      'refreshTokens.expiresAt': { $gt: Date.now() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Remove old refresh token
    user.removeRefreshToken(refreshToken);

    // Generate new tokens
    const tokens = generateAuthTokens(user);
    
    // Store new refresh token
    user.addRefreshToken(tokens.refreshToken, req.headers['user-agent'], req.ip);
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.accessTokenExpires
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// PASSWORD MANAGEMENT
// ============================================

/**
 * @desc    Request password reset
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return res.status(200).json({
        success: true,
        message: 'If this email exists, a reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // In production, send email
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n========================================');
      console.log('📧 PASSWORD RESET (Development Mode)');
      console.log(`   Email: ${email}`);
      console.log(`   Token: ${resetToken}`);
      console.log(`   URL: ${resetUrl}`);
      console.log('========================================\n');
    }

    res.status(200).json({
      success: true,
      message: 'If this email exists, a reset link has been sent',
      ...(process.env.NODE_ENV !== 'production' && { resetToken, resetUrl })
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password with token
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Hash token to compare
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Set new password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // Logout all devices
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. Please login with your new password.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change password (authenticated)
 * @route   POST /api/auth/change-password
 * @access  Private
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Set new password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET CURRENT USER
// ============================================

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get additional info based on role
    let additionalInfo = {};

    if (user.role === 'doctor') {
      const mappings = await DoctorHospitalMapping.find({
        doctor: user._id
      }).populate('hospital', 'name slug type');
      
      additionalInfo.hospitals = mappings.map(m => ({
        id: m.hospital._id,
        name: m.hospital.name,
        slug: m.hospital.slug,
        type: m.hospital.type,
        status: m.status,
        department: m.department,
        employmentType: m.employmentType
      }));
    }

    if (user.role === 'hospital_admin') {
      const hospital = await Hospital.findById(user.hospitalId);
      if (hospital) {
        additionalInfo.hospital = {
          id: hospital._id,
          name: hospital.name,
          slug: hospital.slug,
          type: hospital.type,
          verificationStatus: hospital.verificationStatus
        };
      }
    }

    if (user.role === 'caregiver') {
      const patients = await User.find({
        _id: { $in: user.caregiverProfile?.patientsUnderCare || [] }
      }).select('firstName lastName profileImage');
      
      additionalInfo.patients = patients;
      additionalInfo.permissions = user.caregiverProfile?.permissions;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          phone: user.phone,
          fullName: user.fullName,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          profileImage: user.profileImage,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
          ...additionalInfo
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET HOSPITALS (for doctor registration)
// ============================================

/**
 * @desc    Get list of all active hospitals
 * @route   GET /api/auth/hospitals
 * @access  Public
 */
exports.getHospitals = async (req, res, next) => {
  try {
    console.log('\n🔍 GET /api/auth/hospitals called');
    
    const hospitals = await Hospital.find({ isActive: true })
      .select('_id name slug type email phone address bedCount logo')
      .sort({ createdAt: -1 });

    console.log(`\n✅ getHospitals Query Results:`);
    console.log(`   - Query: Hospital.find({ isActive: true })`);
    console.log(`   - Found: ${hospitals.length} hospitals`);
    console.log(`   - Hospitals: ${hospitals.map(h => h.name).join(', ')}`);

    res.status(200).json({
      success: true,
      data: {
        count: hospitals.length,
        hospitals: hospitals.map(h => ({
          id: h._id,
          name: h.name,
          slug: h.slug,
          type: h.type,
          email: h.email,
          phone: h.phone,
          location: h.address ? `${h.address.city}, ${h.address.state}` : 'Location not specified',
          bedCount: h.bedCount,
          logo: h.logo
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error in getHospitals:', error);
    next(error);
  }
};

// ============================================
// DEBUG: GET HOSPITALS (all, including inactive)
// ============================================

/**
 * @desc    Debug: Get ALL hospitals (for debugging)
 * @route   GET /api/auth/hospitals/debug
 * @access  Public
 */
exports.getHospitalsDebug = async (req, res, next) => {
  try {
    const allHospitals = await Hospital.find({})
      .select('_id name slug type email phone address isActive bedCount')
      .sort({ createdAt: -1 });

    const activeHospitals = await Hospital.find({ isActive: true })
      .select('_id name slug type email phone address isActive bedCount')
      .sort({ createdAt: -1 });

    console.log(`\n📊 Hospital Debug Info:`);
    console.log(`   Total hospitals: ${allHospitals.length}`);
    console.log(`   Active hospitals: ${activeHospitals.length}`);
    console.log(`   All hospitals:`, allHospitals.map(h => ({ name: h.name, isActive: h.isActive })));

    res.status(200).json({
      success: true,
      debug: {
        totalCount: allHospitals.length,
        activeCount: activeHospitals.length,
        allHospitals: allHospitals.map(h => ({
          id: h._id,
          name: h.name,
          isActive: h.isActive,
          slug: h.slug,
          type: h.type
        }))
      },
      data: {
        count: activeHospitals.length,
        hospitals: activeHospitals.map(h => ({
          id: h._id,
          name: h.name,
          slug: h.slug,
          type: h.type,
          email: h.email,
          phone: h.phone,
          location: h.address ? `${h.address.city}, ${h.address.state}` : 'Location not specified',
          bedCount: h.bedCount
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// RESEND VERIFICATION EMAIL
// ============================================

/**
 * @desc    Resend Supabase verification email
 * @route   POST /api/auth/resend-verification
 * @access  Private
 */
exports.resendVerification = async (req, res, next) => {
  try {
    const { resendVerificationEmail, checkEmailVerified } = require('../services/supabaseService');

    const user = await User.findById(req.user.id).select('+supabaseUserId');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Check if already verified
    if (user.supabaseUserId) {
      const verified = await checkEmailVerified({ supabaseUserId: user.supabaseUserId });
      if (verified) {
        // Sync flag
        await User.findByIdAndUpdate(user._id, { isEmailVerified: true });
        return res.status(200).json({
          success: true,
          message: 'Your email is already verified.'
        });
      }
    }

    await resendVerificationEmail(user.email);

    res.status(200).json({
      success: true,
      message: 'Verification email resent. Please check your inbox.'
    });
  } catch (error) {
    console.error('[resendVerification] Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification email. Please try again later.'
    });
  }
};

// ============================================
// EMAIL VERIFICATION STATUS
// ============================================

/**
 * @desc    Check current email verification status
 * @route   GET /api/auth/verification-status
 * @access  Private
 */
exports.getVerificationStatus = async (req, res, next) => {
  try {
    const { checkEmailVerified, confirmUserEmail, createSupabaseUser } = require('../services/supabaseService');

    const user = await User.findById(req.user.id).select('+supabaseUserId isEmailVerified email');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let verified = user.isEmailVerified;
    let supabaseUserId = user.supabaseUserId;

    // If no supabaseUserId yet, create one now and send verification email
    if (!supabaseUserId && !verified) {
      try {
        const tempPassword = require('crypto').randomBytes(16).toString('hex');
        const result = await createSupabaseUser(user.email, tempPassword);
        supabaseUserId = result.supabaseUserId;
        await User.findByIdAndUpdate(user._id, { supabaseUserId });
      } catch (err) {
        console.error('[getVerificationStatus] Could not create Supabase user:', err.message);
        // Supabase unavailable — treat as verified so user isn't blocked
        return res.status(200).json({
          success: true,
          data: { email: user.email, isEmailVerified: true, supabaseLinked: false }
        });
      }
    }

    // Re-check Supabase if not yet marked verified
    if (!verified && supabaseUserId) {
      try {
        verified = await checkEmailVerified({ supabaseUserId });
        if (verified) {
          try { await confirmUserEmail(supabaseUserId); } catch (_) {}
          await User.findByIdAndUpdate(user._id, { isEmailVerified: true });
        }
      } catch (err) {
        console.error('[getVerificationStatus] Supabase check failed:', err.message);
        // Supabase down — don't block the user
        verified = true;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        email: user.email,
        isEmailVerified: verified,
        supabaseLinked: !!supabaseUserId
      }
    });
  } catch (error) {
    next(error);
  }
};
