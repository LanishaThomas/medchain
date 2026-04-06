'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/authService';

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface Permission {
  _id: string;
  patient: Patient;
  accessType: string;
  status: string;
  expiryDate: string;
  allowedActions: {
    view: boolean;
    download: boolean;
    share: boolean;
    print: boolean;
  };
  lastAccessedAt?: string;
  accessCount: number;
}

interface PatientProfileDetails {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  patientProfile?: {
    bloodType?: string;
    allergies?: Array<{ allergen: string; severity?: string; reaction?: string }>;
    currentMedications?: Array<{ name: string; dosage?: string; frequency?: string; prescribedFor?: string }>;
    previousSurgeries?: Array<{ name: string; date?: string; hospital?: string; notes?: string }>;
    chronicConditions?: string[];
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    emergencyContacts?: Array<{ name: string; relationship?: string; phone?: string }>;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
  };
}

interface MedicalRecord {
  _id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  recordType: string;
  clinicalData?: {
    testName?: string;
    testDate?: string;
    labName?: string;
    doctorName?: string;
    diagnosis?: string;
    notes?: string;
  };
  uploadedBy: {
    firstName: string;
    lastName: string;
    role: string;
  };
  hospital?: {
    name: string;
  };
  createdAt: string;
  tags?: string[];
}

const RECORD_TYPES = [
  { value: 'lab_report', label: '🧪 Lab Report' },
  { value: 'prescription', label: '💊 Prescription' },
  { value: 'imaging', label: '📷 Imaging' },
  { value: 'discharge_summary', label: '🏥 Discharge Summary' },
  { value: 'consultation_notes', label: '📝 Consultation Notes' },
  { value: 'vaccination', label: '💉 Vaccination' },
  { value: 'insurance', label: '📋 Insurance' },
  { value: 'other', label: '📄 Other' }
];

export default function PatientRecordsViewer() {
  const [approvedPatients, setApprovedPatients] = useState<Permission[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Permission | null>(null);
  const [selectedPatientProfile, setSelectedPatientProfile] = useState<PatientProfileDetails | null>(null);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState('');
  
  // Filters
  const [filterType, setFilterType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // View record modal
  const [viewingRecord, setViewingRecord] = useState<MedicalRecord | null>(null);

  // Fetch approved permissions (patients I have access to)
  const fetchApprovedPatients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/permissions/doctor/approved');
      
      if (response.data.success) {
        const profileAccessPermissions = (response.data.data.permissions || []).filter(
          (permission: Permission) =>
            permission.accessType === 'medical_records' || permission.accessType === 'full_access'
        );
        setApprovedPatients(profileAccessPermissions);
      }
    } catch (err: any) {
      console.error('Fetch approved patients error:', err);
      setError(err.response?.data?.message || 'Failed to fetch approved patients');
    } finally {
      setLoading(false);
    }
  };

  // Fetch patient records
  const fetchPatientRecords = async (patientId: string) => {
    try {
      setLoadingRecords(true);
      setError('');
      
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (filterType) params.append('recordType', filterType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(`/medical-records/patient/${patientId}?${params.toString()}`);
      
      if (response.data.success) {
        setRecords(response.data.data.records);
        setTotalPages(response.data.data.pagination.pages);
      }
    } catch (err: any) {
      console.error('Fetch records error:', err);
      setError(err.response?.data?.message || 'Failed to fetch records');
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const fetchPatientProfile = async (patientId: string) => {
    try {
      setLoadingProfile(true);
      const response = await api.get(`/profile/patient/${patientId}/details`);
      if (response.data.success) {
        setSelectedPatientProfile(response.data.data.profile);
      }
    } catch (err: any) {
      console.error('Fetch patient profile error:', err);
      setError(err.response?.data?.message || 'Failed to fetch patient profile details');
      setSelectedPatientProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchApprovedPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      fetchPatientRecords(selectedPatient.patient._id);
      fetchPatientProfile(selectedPatient.patient._id);
    }
  }, [selectedPatient, page, filterType, startDate, endDate]);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Get record type label
  const getRecordTypeLabel = (type: string) => {
    const found = RECORD_TYPES.find(t => t.value === type);
    return found ? found.label : type;
  };

  // Get file icon
  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image': return '🖼️';
      case 'pdf': return '📄';
      case 'document': return '📝';
      default: return '📎';
    }
  };

  // Handle view record
  const handleViewRecord = async (record: MedicalRecord) => {
    try {
      const response = await api.get(`/medical-records/${record._id}`);
      if (response.data.success) {
        setViewingRecord(response.data.data.record);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to view record');
    }
  };

  // Handle download
  const handleDownload = async (record: MedicalRecord) => {
    try {
      const response = await api.get(`/medical-records/${record._id}/download`);
      if (response.data.success) {
        window.open(response.data.data.downloadUrl, '_blank');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to download record');
    }
  };

  // Check if download is allowed
  const canDownload = selectedPatient?.allowedActions?.download || false;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError('')} className="float-right text-red-500">&times;</button>
        </div>
      )}

      {/* Patient Selection */}
      {!selectedPatient ? (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Select a Patient to View Records
          </h3>
          
          {approvedPatients.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <span className="text-6xl">🔒</span>
              <h3 className="text-xl font-medium text-gray-900 mt-4">No approved access</h3>
              <p className="text-gray-500 mt-2">
                You don't have access to any patient records yet.
                <br />
                Request access from the "Request Access" tab.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedPatients.map((permission) => (
                <div
                  key={permission._id}
                  className="bg-white p-4 rounded-lg shadow hover:shadow-md transition cursor-pointer border-2 border-transparent hover:border-blue-500"
                  onClick={() => { setSelectedPatient(permission); setSelectedPatientProfile(null); setPage(1); }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xl">👤</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {permission.patient.firstName} {permission.patient.lastName}
                      </h4>
                      <p className="text-sm text-gray-500">{permission.patient.email}</p>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Expires: {new Date(permission.expiryDate).toLocaleDateString()}
                    </span>
                    <span className="text-blue-600">View Records →</span>
                  </div>

                  <div className="mt-2 text-xs text-indigo-700">
                    Access: {permission.accessType === 'full_access' ? 'Full Access' : 'Basic Access'}
                  </div>
                  
                  <div className="mt-2 flex gap-1">
                    {permission.allowedActions.view && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">View</span>
                    )}
                    {permission.allowedActions.download && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Download</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Back Button & Patient Info */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => { setSelectedPatient(null); setSelectedPatientProfile(null); setRecords([]); }}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Patients
            </button>
            
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedPatient.patient.firstName} {selectedPatient.patient.lastName}'s Records
              </h3>
              <p className="text-sm text-gray-500">
                Access expires: {new Date(selectedPatient.expiryDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Patient Profile Details */}
          <div className="bg-white p-4 rounded-lg shadow mb-4">
            <h4 className="text-md font-semibold text-gray-900 mb-3">Patient Profile Details</h4>
            {loadingProfile ? (
              <p className="text-sm text-gray-500">Loading profile details...</p>
            ) : !selectedPatientProfile ? (
              <p className="text-sm text-gray-500">No profile details available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><span className="font-medium">Name:</span> {selectedPatientProfile.fullName}</p>
                  <p><span className="font-medium">Email:</span> {selectedPatientProfile.email || 'N/A'}</p>
                  <p><span className="font-medium">Phone:</span> {selectedPatientProfile.phone || 'N/A'}</p>
                  <p><span className="font-medium">Gender:</span> {selectedPatientProfile.gender || 'N/A'}</p>
                  <p><span className="font-medium">DOB:</span> {selectedPatientProfile.dateOfBirth ? new Date(selectedPatientProfile.dateOfBirth).toLocaleDateString() : 'N/A'}</p>
                  <p><span className="font-medium">Blood Type:</span> {selectedPatientProfile.patientProfile?.bloodType || 'N/A'}</p>
                </div>
                <div>
                  <p><span className="font-medium">Chronic Conditions:</span> {(selectedPatientProfile.patientProfile?.chronicConditions || []).join(', ') || 'N/A'}</p>
                  <p><span className="font-medium">Allergies:</span> {(selectedPatientProfile.patientProfile?.allergies || []).map(a => a.allergen).join(', ') || 'N/A'}</p>
                  <p><span className="font-medium">Current Medications:</span> {(selectedPatientProfile.patientProfile?.currentMedications || []).map(m => m.name).join(', ') || 'N/A'}</p>
                  <p><span className="font-medium">Emergency Contacts:</span> {(selectedPatientProfile.patientProfile?.emergencyContacts || []).map(c => `${c.name}${c.phone ? ` (${c.phone})` : ''}`).join(', ') || 'N/A'}</p>
                  <p><span className="font-medium">Insurance:</span> {selectedPatientProfile.patientProfile?.insuranceProvider || 'N/A'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-lg shadow mb-4">
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All Types</option>
              {RECORD_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm"
            />
            
            {(filterType || startDate || endDate) && (
              <button
                onClick={() => { setFilterType(''); setStartDate(''); setEndDate(''); setPage(1); }}
                className="text-sm text-blue-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Records List */}
          {loadingRecords ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <span className="text-6xl">📁</span>
              <h3 className="text-xl font-medium text-gray-900 mt-4">No records found</h3>
              <p className="text-gray-500 mt-2">
                This patient hasn't uploaded any medical records yet.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Record</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Size</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((record) => (
                    <tr key={record._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getFileIcon(record.fileType)}</span>
                          <div>
                            <div className="font-medium text-gray-900">{record.title}</div>
                            <div className="text-sm text-gray-500">{record.fileName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {getRecordTypeLabel(record.recordType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatSize(record.fileSize)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewRecord(record)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="View"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          {canDownload && (
                            <button
                              onClick={() => handleDownload(record)}
                              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                              title="Download"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* View Record Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-semibold">Record Details</h3>
              <button 
                onClick={() => setViewingRecord(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6">
              {/* File Preview */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                {viewingRecord.fileType === 'image' ? (
                  <img 
                    src={viewingRecord.fileUrl} 
                    alt={viewingRecord.title}
                    className="max-w-full max-h-96 mx-auto rounded"
                  />
                ) : viewingRecord.fileType === 'pdf' ? (
                  <div className="text-center">
                    <span className="text-6xl">📄</span>
                    <p className="mt-2 text-gray-600">PDF Document</p>
                    <a 
                      href={viewingRecord.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-blue-600 hover:underline"
                    >
                      Open in new tab →
                    </a>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="text-6xl">{getFileIcon(viewingRecord.fileType)}</span>
                    <p className="mt-2 text-gray-600">{viewingRecord.fileName}</p>
                  </div>
                )}
              </div>
              
              {/* Record Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Title</label>
                  <p className="font-medium">{viewingRecord.title}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Type</label>
                  <p className="font-medium">{getRecordTypeLabel(viewingRecord.recordType)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">File Size</label>
                  <p className="font-medium">{formatSize(viewingRecord.fileSize)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Uploaded On</label>
                  <p className="font-medium">{new Date(viewingRecord.createdAt).toLocaleString()}</p>
                </div>
                {viewingRecord.description && (
                  <div className="col-span-2">
                    <label className="text-sm text-gray-500">Description</label>
                    <p className="font-medium">{viewingRecord.description}</p>
                  </div>
                )}
              </div>
              
              {/* Clinical Data */}
              {viewingRecord.clinicalData && Object.keys(viewingRecord.clinicalData).length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-4">Clinical Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {viewingRecord.clinicalData.testName && (
                      <div>
                        <label className="text-sm text-gray-500">Test Name</label>
                        <p className="font-medium">{viewingRecord.clinicalData.testName}</p>
                      </div>
                    )}
                    {viewingRecord.clinicalData.testDate && (
                      <div>
                        <label className="text-sm text-gray-500">Test Date</label>
                        <p className="font-medium">{new Date(viewingRecord.clinicalData.testDate).toLocaleDateString()}</p>
                      </div>
                    )}
                    {viewingRecord.clinicalData.labName && (
                      <div>
                        <label className="text-sm text-gray-500">Lab/Hospital</label>
                        <p className="font-medium">{viewingRecord.clinicalData.labName}</p>
                      </div>
                    )}
                    {viewingRecord.clinicalData.diagnosis && (
                      <div>
                        <label className="text-sm text-gray-500">Diagnosis</label>
                        <p className="font-medium">{viewingRecord.clinicalData.diagnosis}</p>
                      </div>
                    )}
                    {viewingRecord.clinicalData.notes && (
                      <div className="col-span-2">
                        <label className="text-sm text-gray-500">Notes</label>
                        <p className="font-medium">{viewingRecord.clinicalData.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="mt-6 pt-6 border-t flex gap-3">
                {canDownload && (
                  <button
                    onClick={() => handleDownload(viewingRecord)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                )}
                <button
                  onClick={() => setViewingRecord(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
