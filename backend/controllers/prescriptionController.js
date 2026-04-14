const mongoose = require('mongoose');
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const DoctorHospitalMapping = require('../models/DoctorHospitalMapping');
const Permission = require('../models/Permission');
const {
  executeWithBlockchainConsistency,
  hashFromResult
} = require('../services/blockchainConsistencyService');
const { attachVerificationStatus, getVerificationStatusForEntity } = require('../services/entityVerificationService');
const { notify } = require('../services/notificationService');
const { reAuditConsultation } = require('../services/consultationAuditService');

const createPrescription = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { patientId, hospitalId, medicines, notes } = req.body;

    if (!patientId || !hospitalId || !Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'patientId, hospitalId, and medicines are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId) || !mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patientId or hospitalId'
      });
    }

    const patient = await User.findOne({ _id: patientId, role: 'patient', isActive: true });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const hospital = await Hospital.findOne({ _id: hospitalId, isActive: true });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    const doctorMapping = await DoctorHospitalMapping.findOne({
      doctor: doctorId,
      hospital: hospitalId,
      status: 'approved',
      isActive: true,
      'permissions.canCreatePrescriptions': true
    });

    if (!doctorMapping) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: only verified doctors at this hospital can create prescriptions'
      });
    }

    const hasPrescriptionAccess = await Permission.findOne({
      patient: patientId,
      doctor: doctorId,
      status: 'approved',
      expiryDate: { $gt: new Date() },
      accessType: { $in: ['prescriptions', 'full_access'] }
    });

    if (!hasPrescriptionAccess) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: patient has not granted prescriptions/full access to this doctor'
      });
    }

    const normalizedMedicines = medicines
      .map((item) => {
        if (typeof item === 'string') {
          return {
            name: item.trim(),
            dosage: '',
            notes: ''
          };
        }

        return {
          name: String(item?.name || '').trim(),
          dosage: String(item?.dosage || '').trim(),
          notes: String(item?.notes || '').trim()
        };
      })
      .filter((item) => item.name);

    const hasInvalidMedicine = normalizedMedicines.some((item) => !item.dosage);
    if (normalizedMedicines.length === 0 || hasInvalidMedicine) {
      return res.status(400).json({
        success: false,
        message: 'Each medicine must include name and dosage'
      });
    }

    const combinedDosage = normalizedMedicines
      .map((item) => `${item.name}: ${item.dosage}`)
      .join('; ');

    const consistencyResult = await executeWithBlockchainConsistency(
      async () => {
        const prescription = await Prescription.create({
          patientId,
          doctorId,
          hospitalId,
          medicines: normalizedMedicines,
          dosage: combinedDosage,
          notes: notes ? String(notes).trim() : ''
        });

        const afterSnapshot = prescription.toObject({ depopulate: true, virtuals: false });

        return {
          entityType: 'PRESCRIPTION',
          entityId: prescription._id.toString(),
          actorId: doctorId.toString(),
          actionType: 'CREATE',
          hashSource: {
            id: prescription._id.toString(),
            prescriptionNumber: prescription.prescriptionNumber,
            patientId: prescription.patientId.toString(),
            doctorId: prescription.doctorId.toString(),
            hospitalId: prescription.hospitalId.toString(),
            medicines: prescription.medicines,
            dosage: prescription.dosage,
            notes: prescription.notes,
            status: prescription.status,
            hash: prescription.hash
          },
          versioning: {
            beforeSnapshot: null,
            afterSnapshot,
            metadata: {
              hospitalId: hospitalId.toString()
            }
          },
          dbState: {
            model: 'Prescription',
            operation: 'CREATE',
            id: prescription._id.toString()
          },
          onSuccess: async (auditDoc) => {
            await Prescription.updateOne(
              { _id: prescription._id },
              {
                $set: {
                  blockchainHash: auditDoc.dataHash,
                  blockchainTxHash: auditDoc.blockchainTxHash,
                  blockchainTimestamp: auditDoc.timestamp
                }
              }
            );
          },
          createdId: prescription._id
        };
      },
      async (operationResult) => {
        await Prescription.findByIdAndDelete(operationResult.createdId);
      },
      hashFromResult
    );

    const prescriptionId = consistencyResult.entityId;

    const populatedPrescription = await Prescription.findById(prescriptionId)
      .populate('patientId', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName email')
      .populate('hospitalId', 'name');

    const medNames = populatedPrescription.medicines.slice(0, 2).map(m => m.name).join(', ');
    notify(patientId, {
      type: 'prescription',
      title: 'New Prescription 💊',
      message: `Dr. ${populatedPrescription.doctorId?.firstName} ${populatedPrescription.doctorId?.lastName} issued a prescription: ${medNames}${populatedPrescription.medicines.length > 2 ? ' and more' : ''}.`,
      priority: 'high',
      data: { prescriptionId: populatedPrescription._id, prescriptionNumber: populatedPrescription.prescriptionNumber }
    }).catch(() => {});

    // Re-audit any completed online consultation for this doctor+patient pair
    // Fire-and-forget — runs after response is sent
    const Consultation = require('../models/Consultation');
    Consultation.findOne({
      doctorId:  populatedPrescription.doctorId?._id,
      patientId: populatedPrescription.patientId?._id,
      status: 'completed'
    })
      .sort({ endTime: -1 })
      .then(c => { if (c) reAuditConsultation(c._id.toString()); })
      .catch(err => console.error('[ConsultationAudit] Re-audit after prescription failed:', err.message));

    return res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: {
        id: populatedPrescription._id,
        prescriptionNumber: populatedPrescription.prescriptionNumber,
        patientId: populatedPrescription.patientId?._id,
        patientName: populatedPrescription.patientId
          ? `${populatedPrescription.patientId.firstName} ${populatedPrescription.patientId.lastName}`
          : null,
        doctorId: populatedPrescription.doctorId?._id,
        doctorName: populatedPrescription.doctorId
          ? `Dr. ${populatedPrescription.doctorId.firstName} ${populatedPrescription.doctorId.lastName}`
          : null,
        hospitalId: populatedPrescription.hospitalId?._id,
        hospitalName: populatedPrescription.hospitalId?.name || null,
        medicines: populatedPrescription.medicines,
        notes: populatedPrescription.notes,
        hash: populatedPrescription.hash,
        status: populatedPrescription.status,
        verificationStatus: await getVerificationStatusForEntity({
          entityType: 'PRESCRIPTION',
          entityId: populatedPrescription._id,
          dbHash: populatedPrescription.blockchainHash
        }),
        createdAt: populatedPrescription.createdAt
      }
    });

  } catch (error) {
    console.error('Create prescription error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create prescription',
      error: error.message
    });
  }
};

const getDoctorPrescriptions = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { patientId, hospitalId, status } = req.query;

    const query = { doctorId };
    if (patientId) query.patientId = patientId;
    if (hospitalId) query.hospitalId = hospitalId;
    if (status) query.status = status;

    const prescriptions = await Prescription.find(query)
      .populate('patientId', 'firstName lastName email')
      .populate('hospitalId', 'name')
      .sort({ createdAt: -1 });

    const mapped = prescriptions.map((item) => ({
      id: item._id,
      prescriptionNumber: item.prescriptionNumber,
      patientId: item.patientId?._id,
      patientName: item.patientId ? `${item.patientId.firstName} ${item.patientId.lastName}` : null,
      patientEmail: item.patientId?.email || null,
      hospitalId: item.hospitalId?._id,
      hospitalName: item.hospitalId?.name || null,
      medicines: item.medicines,
      notes: item.notes,
      hash: item.hash,
      status: item.status,
      blockchainHash: item.blockchainHash,
      createdAt: item.createdAt
    }));

    const verified = await attachVerificationStatus(mapped, {
      entityType: 'PRESCRIPTION',
      getId: (item) => item.id,
      getHash: (item) => item.blockchainHash
    }).catch(() => mapped.map(item => ({ ...item, verificationStatus: 'UNVERIFIED' })));

    return res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: verified
    });
  } catch (error) {
    console.error('Get doctor prescriptions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch prescriptions',
      error: error.message
    });
  }
};

const getPatientPrescriptions = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { hospitalId, status } = req.query;

    const query = { patientId };
    if (hospitalId) query.hospitalId = hospitalId;
    if (status) query.status = status;

    const prescriptions = await Prescription.find(query)
      .populate('doctorId', 'firstName lastName email')
      .populate('hospitalId', 'name')
      .sort({ createdAt: -1 });

    const mapped = prescriptions.map((item) => ({
      id: item._id,
      prescriptionNumber: item.prescriptionNumber,
      doctorId: item.doctorId?._id,
      doctorName: item.doctorId ? `Dr. ${item.doctorId.firstName} ${item.doctorId.lastName}` : null,
      doctorEmail: item.doctorId?.email || null,
      hospitalId: item.hospitalId?._id,
      hospitalName: item.hospitalId?.name || null,
      medicines: item.medicines,
      notes: item.notes,
      hash: item.hash,
      status: item.status,
      blockchainHash: item.blockchainHash,
      createdAt: item.createdAt
    }));

    const verified = await attachVerificationStatus(mapped, {
      entityType: 'PRESCRIPTION',
      getId: (item) => item.id,
      getHash: (item) => item.blockchainHash
    }).catch(() => mapped.map(item => ({ ...item, verificationStatus: 'UNVERIFIED' })));

    return res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: verified
    });
  } catch (error) {
    console.error('Get patient prescriptions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch prescriptions',
      error: error.message
    });
  }
};

module.exports = {
  createPrescription,
  getDoctorPrescriptions,
  getPatientPrescriptions
};
