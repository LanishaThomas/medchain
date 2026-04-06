'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authService, api } from '@/services/authService';
import RequestAccessComponent from './request-access';
import AppointmentManagementComponent from './appointments';
import PatientRecordsViewer from './patient-records';
import DoctorProfilePage from './profile';
import DoctorPrescriptionsComponent from './prescriptions';

interface HospitalApplication {
  applicationId: string;
  hospital: {
    id: string;
    name: string;
    type: string;
    address?: {
      city?: string;
      state?: string;
    };
  };
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  department?: string;
  employmentType?: string;
  appliedAt: string;
  reviewedAt?: string;
  joiningDate?: string;
  rejectionReason?: string;
}

interface ApprovalData {
  summary: {
    totalApplications: number;
    approved: number;
    pending: number;
    rejected: number;
    canPractice: boolean;
  };
  applications: HospitalApplication[];
}

export default function DoctorDashboard() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [approvalData, setApprovalData] = useState<ApprovalData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'applications' | 'appointments' | 'prescriptions' | 'patient-records' | 'request-access' | 'profile'>('applications');
  const [selectedHospitalForDetails, setSelectedHospitalForDetails] = useState<HospitalApplication | null>(null);
  const [showHospitalModal, setShowHospitalModal] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.push('/auth/login');
    } catch (err) {
      console.error('Logout error:', err);
      // Force logout on error
      localStorage.clear();
      router.push('/auth/login');
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  const [stats, setStats] = useState({
    appointments: 0,
    patients: 0,
    prescriptions: 0
  });

  useEffect(() => {
    const fetchApprovalStatus = async () => {
      if (!user) return;
      
      try {
        const response = await authService.getDoctorApprovalStatus();
        setApprovalData(response.data.data);
      } catch (err: any) {
        console.error('Error fetching approval status:', err);
        setError(err.response?.data?.message || 'Failed to load approval status');
      } finally {
        setLoadingStatus(false);
      }
    };

    const fetchDoctorStats = async () => {
      if (!user) return;
      try {
        const [appointmentsRes, patientsRes, prescriptionsRes] = await Promise.all([
          authService.client.get('/appointments/doctor'),
          authService.client.get('/permissions/doctor/approved'),
          authService.client.get('/prescriptions/doctor')
        ]);
        
        const appointments = appointmentsRes.data?.data?.appointments || [];
        const todayAppointments = appointments.filter((a: any) => {
          const appointmentDate = new Date(a.date).toDateString();
          const today = new Date().toDateString();
          return appointmentDate === today && ['scheduled', 'rescheduled'].includes(a.status);
        });

        const activePatients = patientsRes.data?.data?.permissions?.length || 0;

        setStats({
          appointments: todayAppointments.length,
          patients: activePatients,
          prescriptions: prescriptionsRes.data?.count || 0
        });
      } catch (err) {
        console.error('Failed to fetch doctor stats:', err);
      }
    };

    if (user) {
      fetchApprovalStatus();
      fetchDoctorStats();
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'suspended': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return '✓';
      case 'pending': return '⏳';
      case 'rejected': return '✗';
      case 'suspended': return '⏸';
      default: return '?';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with logout */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
            <p className="text-gray-600">Welcome, Dr. {user?.lastName || user?.firstName}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2"
          >
            {loggingOut ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Logging out...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('applications')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'applications'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              🏥 Hospital Applications
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'appointments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              📅 Appointments
            </button>
            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'prescriptions'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              💊 Prescriptions
            </button>
            <button
              onClick={() => setActiveTab('patient-records')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'patient-records'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              📁 Patient Records
            </button>
            <button
              onClick={() => setActiveTab('request-access')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'request-access'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              🔑 Request Patient Access
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'profile'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              👤 Profile
            </button>
          </div>
        </div>
        
        {/* Approval Status Banner */}
        {approvalData && !approvalData.summary.canPractice && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Pending Approval:</strong> You need hospital approval to access patient records and write prescriptions.
                  {approvalData.summary.pending > 0 && ` You have ${approvalData.summary.pending} pending application(s).`}
                </p>
              </div>
            </div>
          </div>
        )}

        {approvalData?.summary.canPractice && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  <strong>Verified:</strong> You are approved at {approvalData.summary.approved} hospital(s) and can practice.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Appointments</h2>
            <p className="text-3xl font-bold text-blue-600">{stats.appointments}</p>
            <p className="text-sm text-gray-500">Today</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Patients</h2>
            <p className="text-3xl font-bold text-green-600">{stats.patients}</p>
            <p className="text-sm text-gray-500">Active</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Prescriptions</h2>
            <p className="text-3xl font-bold text-purple-600">{stats.prescriptions}</p>
            <p className="text-sm text-gray-500">This week</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Hospitals</h2>
            <p className="text-3xl font-bold text-indigo-600">{approvalData?.summary.approved || 0}</p>
            <p className="text-sm text-gray-500">Approved</p>
          </div>
        </div>

        {/* Hospital Applications */}
        {activeTab === 'applications' && (
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Hospital Affiliations</h2>
            <p className="text-sm text-gray-500">Your hospital applications and approval status</p>
          </div>

          {loadingStatus ? (
            <div className="p-6 text-center text-gray-500">Loading applications...</div>
          ) : error ? (
            <div className="p-6 text-center text-red-600">{error}</div>
          ) : (approvalData?.applications?.length || 0) === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 mb-4">You haven&apos;t applied to any hospital yet.</p>
              <button
                onClick={() => router.push('/auth/register')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Apply to a Hospital
              </button>
            </div>
          ) : (
            <div>
              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50 border-b border-gray-200">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{approvalData?.summary.totalApplications}</p>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Total Applications</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{approvalData?.summary.approved}</p>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Approved</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">{approvalData?.summary.pending}</p>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{approvalData?.summary.rejected}</p>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Rejected</p>
                </div>
              </div>

              {/* Applications List */}
              <div className="divide-y divide-gray-200">
                {approvalData?.applications.map((app) => (
                  <div key={app.applicationId} className="p-6 hover:bg-gray-50 transition">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      {/* Hospital Info */}
                      <div className="flex-1">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">{app.hospital.name}</h3>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {app.hospital.type && (
                                <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                  {app.hospital.type.replace('_', ' ')}
                                </span>
                              )}
                              {app.department && (
                                <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                                  {app.department}
                                </span>
                              )}
                              {app.employmentType && (
                                <span className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded">
                                  {app.employmentType.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            
                            {/* Timestamps */}
                            <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                              <span>📅 Applied: {new Date(app.appliedAt).toLocaleDateString()}</span>
                              {app.reviewedAt && (
                                <span>✓ Reviewed: {new Date(app.reviewedAt).toLocaleDateString()}</span>
                              )}
                              {app.joiningDate && (
                                <span>🎯 Joining: {new Date(app.joiningDate).toLocaleDateString()}</span>
                              )}
                            </div>

                            {/* Hospital Location */}
                            {app.hospital.address?.city && (
                              <p className="text-sm text-gray-600 mt-2">
                                📍 {app.hospital.address.city}, {app.hospital.address.state}
                              </p>
                            )}

                            {/* Rejection Reason */}
                            {app.status === 'rejected' && app.rejectionReason && (
                              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                                <p className="text-xs font-semibold text-red-800">Rejection Reason:</p>
                                <p className="text-sm text-red-700">{app.rejectionReason}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge and Action */}
                      <div className="flex items-center gap-4 justify-between md:justify-end">
                        <span className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${getStatusColor(app.status)}`}>
                          <span className="text-lg">{getStatusIcon(app.status)}</span>
                          {app.status === 'pending' && 'Pending Review'}
                          {app.status === 'approved' && 'Approved ✓'}
                          {app.status === 'rejected' && 'Rejected'}
                          {app.status === 'suspended' && 'Suspended'}
                        </span>
                        
                        {app.status === 'approved' && (
                          <button
                            onClick={() => {
                              setSelectedHospitalForDetails(app);
                              setShowHospitalModal(true);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
                          >
                            View Details →
                          </button>
                        )}

                        {app.status === 'pending' && (
                          <div className="text-xs text-gray-500 text-right">
                            <p>⏳ Waiting for</p>
                            <p>hospital review</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Apply More Button */}
              {(approvalData?.applications?.length || 0) > 0 && (
                <div className="p-6 bg-blue-50 border-t border-gray-200 text-center">
                  <p className="text-sm text-gray-600 mb-3">Want to apply to more hospitals?</p>
                  <button
                    onClick={() => router.push('/auth/register')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                  >
                    + Apply to Another Hospital
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">📅 Appointment Management</h2>
            <AppointmentManagementComponent />
          </div>
        )}

        {/* Prescriptions Tab */}
        {activeTab === 'prescriptions' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">💊 Prescriptions</h2>
            <DoctorPrescriptionsComponent />
          </div>
        )}

        {/* Patient Records Tab */}
        {activeTab === 'patient-records' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">📁 Patient Records</h2>
            <PatientRecordsViewer />
          </div>
        )}

        {/* Request Patient Access Tab */}
        {activeTab === 'request-access' && (
          <RequestAccessComponent />
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <DoctorProfilePage />
        )}

        {approvalData?.summary.canPractice && activeTab === 'applications' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button 
                onClick={() => setActiveTab('appointments')}
                className="p-4 border rounded-lg hover:bg-gray-50 text-center"
              >
                <span className="text-2xl mb-2 block">📋</span>
                <span className="text-sm font-medium">View Appointments</span>
              </button>
              <button
                onClick={() => setActiveTab('prescriptions')}
                className="p-4 border rounded-lg hover:bg-gray-50 text-center"
              >
                <span className="text-2xl mb-2 block">💊</span>
                <span className="text-sm font-medium">Write Prescription</span>
              </button>
              <button 
                onClick={() => setActiveTab('request-access')}
                className="p-4 border rounded-lg hover:bg-gray-50 text-center"
              >
                <span className="text-2xl mb-2 block">📁</span>
                <span className="text-sm font-medium">Patient Records</span>
              </button>
              <button className="p-4 border rounded-lg hover:bg-gray-50 text-center">
                <span className="text-2xl mb-2 block">📊</span>
                <span className="text-sm font-medium">Analytics</span>
              </button>
            </div>
          </div>
        )}

        {/* Hospital Details Modal */}
        {showHospitalModal && selectedHospitalForDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedHospitalForDetails.hospital.name}</h2>
                    <span className="inline-block mt-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
                      {selectedHospitalForDetails.hospital.type?.replace('_', ' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowHospitalModal(false);
                      setSelectedHospitalForDetails(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>

                {/* Details Grid */}
                <div className="space-y-6">
                  {/* Location */}
                  {selectedHospitalForDetails.hospital.address && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Location</h3>
                      <p className="text-gray-900">
                        📍 {selectedHospitalForDetails.hospital.address.city}, {selectedHospitalForDetails.hospital.address.state}
                      </p>
                    </div>
                  )}

                  {/* Your Details */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Your Affiliation Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedHospitalForDetails.department && (
                        <div>
                          <p className="text-xs text-gray-500">DEPARTMENT</p>
                          <p className="font-medium text-gray-900">{selectedHospitalForDetails.department}</p>
                        </div>
                      )}
                      {selectedHospitalForDetails.employmentType && (
                        <div>
                          <p className="text-xs text-gray-500">EMPLOYMENT TYPE</p>
                          <p className="font-medium text-gray-900">{selectedHospitalForDetails.employmentType.replace('_', ' ')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Timeline</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Applied:</span>
                        <span className="font-medium text-gray-900">
                          {new Date(selectedHospitalForDetails.appliedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {selectedHospitalForDetails.reviewedAt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Reviewed:</span>
                          <span className="font-medium text-gray-900">
                            {new Date(selectedHospitalForDetails.reviewedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {selectedHospitalForDetails.joiningDate && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Joining Date:</span>
                          <span className="font-medium text-gray-900">
                            {new Date(selectedHospitalForDetails.joiningDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Status</h3>
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
                      selectedHospitalForDetails.status === 'approved' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedHospitalForDetails.status === 'approved' ? '✅ Approved' : selectedHospitalForDetails.status}
                    </span>
                  </div>
                </div>

                {/* Close Button */}
                <div className="mt-6 pt-6 border-t">
                  <button
                    onClick={() => {
                      setShowHospitalModal(false);
                      setSelectedHospitalForDetails(null);
                    }}
                    className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
