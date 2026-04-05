/**
 * Profile Controller
 * Handles patient and doctor profile management
 */

const User = require('../models/User');
const Permission = require('../models/Permission');
const crypto = require('crypto');

/**
 * Get Patient Profile (own profile)
 * GET /api/profile/patient
 */
exports.getPatientProfile = async (req, res) => {
  try {
    console.log('📋 getPatientProfile called:', {
      userId: req.user?.id,
      userRole: req.user?.role,
      email: req.user?.email
    });
    
    const patient = await User.findById(req.user.id);
    
    console.log('👤 Patient from DB:', {
      found: !!patient,
      userId: patient?._id,
      role: patient?.role,
      email: patient?.email
    });
    
    if (!patient || patient.role !== 'patient') {
      console.log('❌ Profile access denied:', {
        patientFound: !!patient,
        patientRole: patient?.role,
        expectedRole: 'patient',
        mismatch: patient && patient.role !== 'patient'
      });
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Calculate profile completion
    const completionStatus = calculateProfileCompletion(patient);
    
    res.status(200).json({
      success: true,
      data: {
        profile: {
          id: patient._id,
          email: patient.email,
          phone: patient.phone,
          firstName: patient.firstName,
          lastName: patient.lastName,
          fullName: patient.fullName,
          profileImage: patient.profileImage,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          patientProfile: patient.patientProfile
        },
        completionStatus
      }
    });
    
  } catch (error) {
    console.error('Get patient profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
};

/**
 * Update Patient Profile
 * PUT /api/profile/patient
 */
exports.updatePatientProfile = async (req, res) => {
  try {
    const patientId = req.user.id;
    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone,
      bloodType,
      allergies,
      currentMedications,
      previousSurgeries,
      chronicConditions,
      address,
      emergencyContacts,
      insuranceProvider,
      insurancePolicyNumber
    } = req.body;
    
    // Build update object
    const updateData = {};
    
    // Basic fields
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
    if (gender) updateData.gender = gender;
    if (phone) updateData.phone = phone;
    
    // Patient profile fields
    if (bloodType) updateData['patientProfile.bloodType'] = bloodType;
    if (allergies !== undefined) updateData['patientProfile.allergies'] = allergies;
    if (currentMedications !== undefined) updateData['patientProfile.currentMedications'] = currentMedications;
    if (previousSurgeries !== undefined) updateData['patientProfile.previousSurgeries'] = previousSurgeries;
    if (chronicConditions !== undefined) updateData['patientProfile.chronicConditions'] = chronicConditions;
    if (address) updateData['patientProfile.address'] = address;
    if (emergencyContacts !== undefined) updateData['patientProfile.emergencyContacts'] = emergencyContacts;
    if (insuranceProvider !== undefined) updateData['patientProfile.insuranceProvider'] = insuranceProvider;
    if (insurancePolicyNumber !== undefined) updateData['patientProfile.insurancePolicyNumber'] = insurancePolicyNumber;
    
    const patient = await User.findByIdAndUpdate(
      patientId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    // Recalculate profile completion
    const completionStatus = calculateProfileCompletion(patient);
    
    // Update isProfileComplete flag
    if (completionStatus.percentage >= 80) {
      await User.findByIdAndUpdate(patientId, {
        'patientProfile.isProfileComplete': true
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        profile: {
          id: patient._id,
          email: patient.email,
          phone: patient.phone,
          firstName: patient.firstName,
          lastName: patient.lastName,
          fullName: patient.fullName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          patientProfile: patient.patientProfile
        },
        completionStatus
      }
    });
    
  } catch (error) {
    console.error('Update patient profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

/**
 * Get Patient Emergency Info (for doctors with permission)
 * GET /api/profile/patient/:patientId/emergency-info
 */
exports.getPatientEmergencyInfo = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { patientId } = req.params;
    
    // Check if doctor has permission
    const hasAccess = await Permission.hasAccess(patientId, doctorId, 'emergency_info');
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this patient\'s emergency info'
      });
    }
    
    const patient = await User.findById(patientId).select(
      'firstName lastName fullName dateOfBirth gender phone patientProfile.bloodType patientProfile.allergies patientProfile.currentMedications patientProfile.previousSurgeries patientProfile.chronicConditions patientProfile.emergencyContacts patientProfile.address'
    );
    
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    
    res.status(200).json({
      success: true,
      data: {
        patient: {
          id: patient._id,
          name: patient.fullName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          phone: patient.phone
        },
        emergencyInfo: patient.patientProfile
      }
    });
    
  } catch (error) {
    console.error('Get patient emergency info error:', error);
    res.status(500).json({ success: false, message: 'Failed to get emergency info' });
  }
};

/**
 * Get Doctor Profile (own or public)
 * GET /api/profile/doctor/:doctorId?
 */
exports.getDoctorProfile = async (req, res) => {
  try {
    console.log('📋 getDoctorProfile called:', {
      userId: req.user?.id,
      userRole: req.user?.role,
      doctorId: req.params.doctorId,
      authRequired: !!req.user
    });
    
    const { doctorId } = req.params;
    const isOwnProfile = !doctorId || doctorId === req.user?.id?.toString();
    
    let doctor;
    
    if (isOwnProfile && req.user) {
      doctor = await User.findById(req.user.id);
    } else {
      // Public profile - check if public
      doctor = await User.findById(doctorId);
      
      if (!doctor || doctor.role !== 'doctor') {
        return res.status(404).json({ success: false, message: 'Doctor not found' });
      }
      
      // Check if profile is public
      if (!doctor.doctorProfile?.profileSettings?.isPublic) {
        return res.status(403).json({ 
          success: false, 
          message: 'This doctor\'s profile is private' 
        });
      }
    }
    
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Build response based on public/private access
    const profileData = {
      id: doctor._id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      fullName: doctor.fullName,
      profileImage: doctor.profileImage,
      gender: doctor.gender,
      doctorProfile: {
        specializations: doctor.doctorProfile?.specializations || [],
        qualifications: doctor.doctorProfile?.qualifications || [],
        yearsOfExperience: doctor.doctorProfile?.yearsOfExperience,
        bio: doctor.doctorProfile?.bio,
        certificates: doctor.doctorProfile?.certificates || [],
        achievements: doctor.doctorProfile?.achievements || [],
        consultationFee: doctor.doctorProfile?.consultationFee,
        languages: doctor.doctorProfile?.languages || []
      }
    };
    
    // Add contact info based on settings
    if (isOwnProfile) {
      profileData.email = doctor.email;
      profileData.phone = doctor.phone;
      profileData.doctorProfile.licenseNumber = doctor.doctorProfile?.licenseNumber;
      profileData.doctorProfile.licenseState = doctor.doctorProfile?.licenseState;
      profileData.doctorProfile.licenseExpiry = doctor.doctorProfile?.licenseExpiry;
      profileData.doctorProfile.profileSettings = doctor.doctorProfile?.profileSettings;
    } else {
      // Public view - respect settings
      const settings = doctor.doctorProfile?.profileSettings || {};
      if (settings.showEmail) profileData.email = doctor.email;
      if (settings.showPhone) profileData.phone = doctor.phone;
    }
    
    res.status(200).json({
      success: true,
      data: { profile: profileData }
    });
    
  } catch (error) {
    console.error('Get doctor profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
};

/**
 * Get Doctor Profile by Slug (public link)
 * GET /api/profile/doctor/slug/:slug
 */
exports.getDoctorProfileBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const doctor = await User.findOne({
      role: 'doctor',
      'doctorProfile.profileSettings.shareableSlug': slug,
      'doctorProfile.profileSettings.isPublic': true
    });
    
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    
    const settings = doctor.doctorProfile?.profileSettings || {};
    
    const profileData = {
      id: doctor._id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      fullName: doctor.fullName,
      profileImage: doctor.profileImage,
      gender: doctor.gender,
      doctorProfile: {
        specializations: doctor.doctorProfile?.specializations || [],
        qualifications: doctor.doctorProfile?.qualifications || [],
        yearsOfExperience: doctor.doctorProfile?.yearsOfExperience,
        bio: doctor.doctorProfile?.bio,
        certificates: doctor.doctorProfile?.certificates || [],
        achievements: doctor.doctorProfile?.achievements || [],
        consultationFee: doctor.doctorProfile?.consultationFee,
        languages: doctor.doctorProfile?.languages || []
      }
    };
    
    if (settings.showEmail) profileData.email = doctor.email;
    if (settings.showPhone) profileData.phone = doctor.phone;
    
    res.status(200).json({
      success: true,
      data: { profile: profileData }
    });
    
  } catch (error) {
    console.error('Get doctor profile by slug error:', error);
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
};

/**
 * Update Doctor Profile
 * PUT /api/profile/doctor
 */
exports.updateDoctorProfile = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const {
      firstName,
      lastName,
      gender,
      phone,
      licenseNumber,
      licenseState,
      licenseExpiry,
      specializations,
      qualifications,
      yearsOfExperience,
      bio,
      certificates,
      achievements,
      consultationFee,
      languages,
      profileSettings
    } = req.body;
    
    // Build update object
    const updateData = {};
    
    // Basic fields
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (gender) updateData.gender = gender;
    if (phone) updateData.phone = phone;
    
    // Doctor profile fields
    if (licenseNumber) updateData['doctorProfile.licenseNumber'] = licenseNumber;
    if (licenseState) updateData['doctorProfile.licenseState'] = licenseState;
    if (licenseExpiry) updateData['doctorProfile.licenseExpiry'] = licenseExpiry;
    if (specializations) updateData['doctorProfile.specializations'] = specializations;
    if (qualifications) updateData['doctorProfile.qualifications'] = qualifications;
    if (yearsOfExperience !== undefined) updateData['doctorProfile.yearsOfExperience'] = yearsOfExperience;
    if (bio !== undefined) updateData['doctorProfile.bio'] = bio;
    if (certificates) updateData['doctorProfile.certificates'] = certificates;
    if (achievements) updateData['doctorProfile.achievements'] = achievements;
    if (consultationFee !== undefined) updateData['doctorProfile.consultationFee'] = consultationFee;
    if (languages) updateData['doctorProfile.languages'] = languages;
    
    // Profile settings
    if (profileSettings) {
      if (profileSettings.isPublic !== undefined) {
        updateData['doctorProfile.profileSettings.isPublic'] = profileSettings.isPublic;
      }
      if (profileSettings.showEmail !== undefined) {
        updateData['doctorProfile.profileSettings.showEmail'] = profileSettings.showEmail;
      }
      if (profileSettings.showPhone !== undefined) {
        updateData['doctorProfile.profileSettings.showPhone'] = profileSettings.showPhone;
      }
    }
    
    const doctor = await User.findByIdAndUpdate(
      doctorId,
      { $set: updateData },
      { new: true, returnDocument: 'after', runValidators: true }
    );
    
    if (!doctor) {
      return res.status(404).json({ 
        success: false, 
        message: 'Doctor not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        profile: {
          id: doctor._id,
          email: doctor.email,
          phone: doctor.phone,
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          fullName: doctor.fullName,
          gender: doctor.gender,
          doctorProfile: doctor.doctorProfile
        }
      }
    });
    
  } catch (error) {
    console.error('Update doctor profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

/**
 * Generate Shareable Slug for Doctor Profile
 * POST /api/profile/doctor/generate-slug
 */
exports.generateShareableSlug = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const doctor = await User.findById(doctorId);
    
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can generate profile links' });
    }
    
    // Generate unique slug from name + random string
    const baseSlug = `dr-${doctor.firstName}-${doctor.lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex');
    const slug = `${baseSlug}-${randomSuffix}`;
    
    await User.findByIdAndUpdate(doctorId, {
      'doctorProfile.profileSettings.shareableSlug': slug,
      'doctorProfile.profileSettings.isPublic': true
    });
    
    const shareUrl = `${process.env.FRONTEND_URL}/doctor/${slug}`;
    
    res.status(200).json({
      success: true,
      data: {
        slug,
        shareUrl,
        qrContent: shareUrl
      }
    });
    
  } catch (error) {
    console.error('Generate slug error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate shareable link' });
  }
};

// Helper: Calculate profile completion percentage
function calculateProfileCompletion(patient) {
  const requiredFields = [
    { key: 'bloodType', path: 'patientProfile.bloodType' },
    { key: 'dateOfBirth', path: 'dateOfBirth' },
    { key: 'gender', path: 'gender' },
    { key: 'phone', path: 'phone' },
    { key: 'emergencyContacts', path: 'patientProfile.emergencyContacts' },
    { key: 'address', path: 'patientProfile.address' }
  ];
  
  const optionalFields = [
    { key: 'allergies', path: 'patientProfile.allergies' },
    { key: 'currentMedications', path: 'patientProfile.currentMedications' },
    { key: 'previousSurgeries', path: 'patientProfile.previousSurgeries' },
    { key: 'chronicConditions', path: 'patientProfile.chronicConditions' },
    { key: 'insuranceProvider', path: 'patientProfile.insuranceProvider' }
  ];
  
  const completed = [];
  const missing = [];
  
  // Check required fields
  for (const field of requiredFields) {
    const value = getNestedValue(patient, field.path);
    if (hasValue(value)) {
      completed.push(field.key);
    } else {
      missing.push(field.key);
    }
  }
  
  // Check optional fields
  for (const field of optionalFields) {
    const value = getNestedValue(patient, field.path);
    if (hasValue(value)) {
      completed.push(field.key);
    }
  }
  
  const totalFields = requiredFields.length + optionalFields.length;
  const percentage = Math.round((completed.length / totalFields) * 100);
  
  return {
    percentage,
    completed,
    missing,
    isComplete: missing.length === 0
  };
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

module.exports = exports;
