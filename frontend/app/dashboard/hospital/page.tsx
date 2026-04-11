'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import EmergencyAccessPage from './emergency-access';

interface DoctorApplication {
  applicationId: string;
  verificationStatus?: 'VERIFIED' | 'TAMPERED';
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
    <div className="theme-hospital min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ─── Page Header ─────────────────────────────── */}
        <div className="role-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Hospital Dashboard</h1>
              <p className="text-white/75 text-sm mt-1">
                <span className="font-semibold text-white">{hospitalName || 'Your Hospital'}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/blockchain-logs"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30
                           text-white text-sm font-semibold rounded-xl border border-white/30
                           transition-all duration-200 backdrop-blur-sm"
              >
                Blockchain Logs
              </Link>
              <button
                id="hospital-logout-btn"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 disabled:opacity-50
                           text-white text-sm font-semibold rounded-xl border border-white/30
                           transition-all duration-200 backdrop-blur-sm"
              >
                {loggingOut ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Logging out…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* ─── Tab Navigation ───────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-2">
          <div className="flex gap-1 flex-wrap">
            {([
              { id: 'overview',      label: 'Overview',            emoji: '📊' },
              { id: 'applications',  label: 'Doctor Applications', emoji: '📋', badge: stats.pendingApplications },
              { id: 'emergency',     label: 'Emergency Access',    emoji: '🚨' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${ activeTab === tab.id ? 'tab-btn-active' : '' } relative`}
              >
                <span className="mr-1.5">{tab.emoji}</span>{tab.label}
                {'badge' in tab && tab.badge > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-400 text-white text-xs font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
        {/* ─── Stats Cards ───────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Pending Applications</p>
            <p className="text-3xl font-bold text-amber-500">{stats.pendingApplications}</p>
            <p className="text-xs text-slate-400 mt-1">Awaiting review</p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Active Doctors</p>
            <p className="text-3xl font-bold text-role-primary">{stats.approvedDoctors}</p>
            <p className="text-xs text-slate-400 mt-1">Approved</p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Total Records</p>
            <p className="text-3xl font-bold text-role-dark">{stats.totalRecords}</p>
            <p className="text-xs text-slate-400 mt-1">On blockchain</p>
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
                      <div className="mt-2">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                          app.verificationStatus === 'VERIFIED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {app.verificationStatus || 'TAMPERED'}
                        </span>
                      </div>
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
                        <div className="mt-2">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                            app.verificationStatus === 'VERIFIED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {app.verificationStatus || 'TAMPERED'}
                          </span>
                        </div>
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
