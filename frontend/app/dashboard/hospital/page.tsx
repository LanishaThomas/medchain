'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import EmergencyAccessPage from './emergency-access';

interface DoctorApplication {
  applicationId: string;
  doctor: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    licenseNumber: string;
    specializations: string[];
    yearsOfExperience: number;
  };
  applicationNote: string;
  employmentType: string;
  department: string;
  appliedAt: string;
}

interface HospitalStats {
  approvedDoctors: number;
  pendingApplications: number;
  totalRecords: number;
}

export default function HospitalDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [pendingDoctors, setPendingDoctors] = useState<DoctorApplication[]>([]);
  const [stats, setStats] = useState<HospitalStats>({ approvedDoctors: 0, pendingApplications: 0, totalRecords: 0 });
  const [hospitalName, setHospitalName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'emergency'>('overview');

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.push('/auth/login');
    } catch (err) {
      console.error('Logout error:', err);
      localStorage.clear();
      router.push('/auth/login');
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    } else if (!authLoading && user?.role !== 'hospital_admin') {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === 'hospital_admin') {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Load hospital profile and pending applications in parallel
      const [profileRes, applicationsRes] = await Promise.all([
        authService.getHospitalProfile(),
        authService.getPendingApplications()
      ]);

      if (profileRes.data?.success) {
        setHospitalName(profileRes.data.data.hospital.name);
        setStats(profileRes.data.data.stats);
      }

      if (applicationsRes.data?.success) {
        setPendingDoctors(applicationsRes.data.data.applications);
      }
    } catch (err: any) {
      console.error('Dashboard load error:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (applicationId: string) => {
    try {
      setActionLoading(applicationId);
      await authService.approveDoctorApplication(applicationId, { notes: 'Approved by admin' });
      
      // Refresh data
      await loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve doctor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (applicationId: string) => {
    const reason = prompt('Please enter rejection reason:');
    if (!reason) return;

    try {
      setActionLoading(applicationId);
      await authService.rejectDoctorApplication(applicationId, reason);
      
      // Refresh data
      await loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject doctor');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== 'hospital_admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Hospital Dashboard</h1>
            <p className="text-gray-600">{hospitalName}</p>
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

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setActiveTab('applications')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'applications'
                  ? 'border-yellow-600 text-yellow-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              📋 Doctor Applications
              {stats.pendingApplications > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                  {stats.pendingApplications}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('emergency')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'emergency'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              🚨 Emergency Access
            </button>
          </div>
        </div>
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Pending Applications</h2>
            <p className="text-3xl font-bold text-yellow-600">{stats.pendingApplications}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Active Doctors</h2>
            <p className="text-3xl font-bold text-green-600">{stats.approvedDoctors}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Total Records</h2>
            <p className="text-3xl font-bold text-blue-600">{stats.totalRecords}</p>
          </div>
        </div>

        {/* Pending Doctor Applications */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Pending Doctor Applications ({pendingDoctors.length})
            </h2>
          </div>

          {pendingDoctors.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No pending applications
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {pendingDoctors.map((app) => (
                <div key={app.applicationId} className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Dr. {app.doctor.fullName}
                      </h3>
                      <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <p><strong>Email:</strong> {app.doctor.email}</p>
                        <p><strong>Phone:</strong> {app.doctor.phone || 'N/A'}</p>
                        <p><strong>License:</strong> {app.doctor.licenseNumber || 'N/A'}</p>
                        <p><strong>Experience:</strong> {app.doctor.yearsOfExperience || 0} years</p>
                        <p><strong>Specializations:</strong> {app.doctor.specializations?.join(', ') || 'N/A'}</p>
                        <p><strong>Employment Type:</strong> {app.employmentType}</p>
                        <p><strong>Department:</strong> {app.department || 'Not specified'}</p>
                        <p><strong>Applied:</strong> {new Date(app.appliedAt).toLocaleDateString()}</p>
                      </div>
                      {app.applicationNote && (
                        <p className="mt-2 text-sm text-gray-600">
                          <strong>Note:</strong> {app.applicationNote}
                        </p>
                      )}
                    </div>

                    <div className="flex space-x-3 ml-6">
                      <button
                        onClick={() => handleApprove(app.applicationId)}
                        disabled={actionLoading === app.applicationId}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium"
                      >
                        {actionLoading === app.applicationId ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(app.applicationId)}
                        disabled={actionLoading === app.applicationId}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}

        {/* Applications Tab (Same as overview but just applications) */}
        {activeTab === 'applications' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Doctor Applications ({pendingDoctors.length} pending)
              </h2>
            </div>

            {pendingDoctors.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-lg">No pending applications</p>
                <p className="text-sm mt-2">All applications have been reviewed</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {pendingDoctors.map((app) => (
                  <div key={app.applicationId} className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Dr. {app.doctor.fullName}
                        </h3>
                        <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
                          <p><strong>Email:</strong> {app.doctor.email}</p>
                          <p><strong>Phone:</strong> {app.doctor.phone || 'N/A'}</p>
                          <p><strong>License:</strong> {app.doctor.licenseNumber || 'N/A'}</p>
                          <p><strong>Experience:</strong> {app.doctor.yearsOfExperience || 0} years</p>
                          <p><strong>Specializations:</strong> {app.doctor.specializations?.join(', ') || 'N/A'}</p>
                          <p><strong>Employment Type:</strong> {app.employmentType}</p>
                          <p><strong>Department:</strong> {app.department || 'Not specified'}</p>
                          <p><strong>Applied:</strong> {new Date(app.appliedAt).toLocaleDateString()}</p>
                        </div>
                        {app.applicationNote && (
                          <p className="mt-2 text-sm text-gray-600">
                            <strong>Note:</strong> {app.applicationNote}
                          </p>
                        )}
                      </div>

                      <div className="flex space-x-3 ml-6">
                        <button
                          onClick={() => handleApprove(app.applicationId)}
                          disabled={actionLoading === app.applicationId}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium"
                        >
                          {actionLoading === app.applicationId ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(app.applicationId)}
                          disabled={actionLoading === app.applicationId}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Emergency Access Tab */}
        {activeTab === 'emergency' && (
          <EmergencyAccessPage />
        )}
      </div>
    </div>
  );
}
