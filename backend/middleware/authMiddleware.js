const jwt = require("jsonwebtoken");
const User = require("../models/User");
const DoctorHospitalMapping = require("../models/DoctorHospitalMapping");

/**
 * Protect routes - Verify JWT token
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Access denied. No token provided." 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "User no longer exists." 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: "User account is deactivated." 
      });
    }

    // Attach user to request
    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token." 
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        message: "Token expired." 
      });
    }
    return res.status(500).json({ 
      success: false,
      message: "Authentication error." 
    });
  }
};

/**
 * Restrict to specific roles
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action."
      });
    }
    next();
  };
};

/**
 * Check if user is hospital admin
 */
exports.isHospitalAdmin = (req, res, next) => {
  if (req.user.role !== "hospital_admin") {
    return res.status(403).json({
      success: false,
      message: "This action requires hospital administrator privileges."
    });
  }
  next();
};

/**
 * Check if user is a doctor
 */
exports.isDoctor = (req, res, next) => {
  console.log('🔍 isDoctor check:', { userId: req.user?.id, role: req.user?.role, email: req.user?.email });
  if (req.user.role !== "doctor") {
    console.log('❌ isDoctor FAILED - user role is:', req.user.role);
    return res.status(403).json({
      success: false,
      message: `This action requires doctor privileges. Your role: ${req.user.role}`
    });
  }
  next();
};

/**
 * Check if user is the owner of the resource or has special role
 */
exports.isOwnerOrRole = (...allowedRoles) => {
  return (req, res, next) => {
    const resourceOwnerId = req.params.userId || req.body.userId;
    
    // Check if user is the owner
    if (req.user.id.toString() === resourceOwnerId) {
      return next();
    }

    // Check if user has allowed role
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You do not have permission to access this resource."
    });
  };
};

/**
 * Check if doctor is approved at a specific hospital
 * Requires hospitalId in req.params or req.body
 */
exports.isApprovedDoctor = async (req, res, next) => {
  try {
    // Only applies to doctors
    if (req.user.role !== "doctor") {
      return res.status(403).json({
        success: false,
        message: "This action requires doctor privileges."
      });
    }

    // Get hospital ID from params, body, or query
    const hospitalId = req.params.hospitalId || req.body.hospitalId || req.query.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "Hospital ID is required."
      });
    }

    // Check if doctor is approved at this hospital
    const isApproved = await DoctorHospitalMapping.isApproved(req.user.id, hospitalId);

    if (!isApproved) {
      return res.status(403).json({
        success: false,
        message: "You are not approved to practice at this hospital. Please wait for hospital approval."
      });
    }

    // Attach hospital ID to request for convenience
    req.hospitalId = hospitalId;
    next();
  } catch (error) {
    console.error("isApprovedDoctor middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking doctor approval status."
    });
  }
};

/**
 * Check if doctor is approved at ANY hospital
 * For actions that don't require specific hospital context
 */
exports.isApprovedDoctorAtAny = async (req, res, next) => {
  try {
    // Only applies to doctors
    if (req.user.role !== "doctor") {
      return res.status(403).json({
        success: false,
        message: "This action requires doctor privileges."
      });
    }

    // Check if doctor is approved at any hospital
    const approvedMappings = await DoctorHospitalMapping.find({
      doctor: req.user.id,
      status: "approved",
      isActive: true
    }).select("hospital").populate("hospital", "name");

    if (approvedMappings.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You are not approved at any hospital. Please wait for hospital approval.",
        pendingApproval: true
      });
    }

    // Attach approved hospitals to request
    req.approvedHospitals = approvedMappings.map(m => ({
      id: m.hospital._id,
      name: m.hospital.name
    }));
    next();
  } catch (error) {
    console.error("isApprovedDoctorAtAny middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking doctor approval status."
    });
  }
};

/**
 * Check if user is a patient
 */
exports.isPatient = (req, res, next) => {
  if (req.user.role !== "patient") {
    return res.status(403).json({
      success: false,
      message: "This action requires patient privileges."
    });
  }
  next();
};