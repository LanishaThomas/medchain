'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import RequestAccessComponent from './request-access';
import AppointmentManagementComponent from './appointments';
import PatientRecordsViewer from './patient-records';
import DoctorProfilePage from './profile';
import DoctorPrescriptionsComponent from './prescriptions';

/* ─── Interfaces ─────────────────────────────────────── */
interface HospitalApplication {
  applicationId: string;
  hospital: {
    id: string;
    name: string;
    type: string;
    address?: { city?: string; state?: string };
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

/* ─── Inner Component (uses searchParams) ────────────── */
function DoctorDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get('section');
  const { user, isLoading, logout } = useAuth();

  const [approvalData, setApprovalData]   = useState<ApprovalData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [loggingOut, setLoggingOut]       = useState(false);
  const [selectedHospitalForDetails, setSelectedHospitalForDetails] = useState<HospitalApplication | null>(null);
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [stats, setStats] = useState({ pending: 0, approved: 0, patients: 0, prescriptions: 0 });
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);

  /* ─── Handlers ────────────────────────────────────── */
  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.push('/auth/login');
    } catch (err) {
      console.error('Logout error:', err);
      sessionStorage.clear();
      router.push('/auth/login');
    }
  };

  /* ─── Effects ─────────────────────────────────────── */
  useEffect(() => {
    if (!isLoading && !user) router.push('/auth/login');
  }, [user, isLoading, router]);

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
          authService.client.get('/prescriptions/doctor'),
        ]);
        const appointments: any[] = appointmentsRes.data?.data || [];
        const pending  = appointments.filter((a: any) => a.status === 'pending').length;
        const approved = appointments.filter((a: any) => a.status === 'approved').length;
        // upcoming = pending + approved, sorted by date
        const upcoming = appointments
          .filter((a: any) => ['pending', 'approved', 'rescheduled'].includes(a.status))
          .sort((a: any, b: any) => {
            const da = new Date(a.approvedDate || a.requestedDate || 0).getTime();
            const db = new Date(b.approvedDate || b.requestedDate || 0).getTime();
            return da - db;
          })
          .slice(0, 5);
        setUpcomingAppointments(upcoming);
        setStats({
          pending,
          approved,
          patients: patientsRes.data?.data?.count || patientsRes.data?.data?.permissions?.length || 0,
          prescriptions: prescriptionsRes.data?.count || 0,
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

  /* ─── Guards ──────────────────────────────────────── */
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  );
  if (!user) return null;

  /* ─── Helpers ─────────────────────────────────────── */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':  return 'bg-green-100 text-green-800';
      case 'pending':   return 'bg-yellow-100 text-yellow-800';
      case 'rejected':  return 'bg-red-100 text-red-800';
      case 'suspended': return 'bg-gray-100 text-gray-800';
      default:          return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':  return '✓';
      case 'pending':   return '⏳';
      case 'rejected':  return '✗';
      case 'suspended': return '⏸';
      default:          return '?';
    }
  };

  const sectionTitle: Record<string, string> = {
    appointments: '📅 Appointments',
    prescriptions: '💊 Prescriptions',
    'patient-records': '📁 Patient Records',
    'request-access': '🔑 Request Patient Access',
    applications: '🏥 Hospital Affiliations',
    profile: '👤 Profile',
  };

  /* ─── Shared applications UI ─────────────────────── */
  const ApplicationsList = () => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-soft">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Hospital Affiliations</h2>
        <p className="text-sm text-gray-500 mt-0.5">Your hospital applications and approval status</p>
      </div>

      {loadingStatus ? (
        <div className="p-6 text-center text-gray-500">Loading applications…</div>
      ) : error ? (
        <div className="p-6 text-center text-red-600">{error}</div>
      ) : (approvalData?.applications?.length || 0) === 0 ? (
        <div className="p-6 text-center">
          <p className="text-gray-500 mb-4">You haven&apos;t applied to any hospital yet.</p>
          <button onClick={() => router.push('/auth/register')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
            Apply to a Hospital
          </button>
        </div>
      ) : (
        <div>
          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-gray-50 border-b border-gray-200">
            {[
              { value: approvalData?.summary.totalApplications, label: 'Total', cls: 'text-blue-600' },
              { value: approvalData?.summary.approved,          label: 'Approved', cls: 'text-green-600' },
              { value: approvalData?.summary.pending,           label: 'Pending', cls: 'text-yellow-600' },
              { value: approvalData?.summary.rejected,          label: 'Rejected', cls: 'text-red-600' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-xs text-gray-600 uppercase tracking-wide mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Applications List */}
          <div className="divide-y divide-gray-200">
            {approvalData?.applications.map((app) => (
              <div key={app.applicationId} className="p-6 hover:bg-gray-50 transition">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{app.hospital.name}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {app.hospital.type && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                          {app.hospital.type.replace('_', ' ')}
                        </span>
                      )}
                      {app.department && (
                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                          {app.department}
                        </span>
                      )}
                      {app.employmentType && (
                        <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded">
                          {app.employmentType.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                      <span>📅 Applied: {new Date(app.appliedAt).toLocaleDateString()}</span>
                      {app.reviewedAt && <span>✓ Reviewed: {new Date(app.reviewedAt).toLocaleDateString()}</span>}
                      {app.joiningDate && <span>🎯 Joining: {new Date(app.joiningDate).toLocaleDateString()}</span>}
                    </div>
                    {app.hospital.address?.city && (
                      <p className="text-sm text-gray-600 mt-2">
                        📍 {app.hospital.address.city}, {app.hospital.address.state}
                      </p>
                    )}
                    {app.status === 'rejected' && app.rejectionReason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-xs font-semibold text-red-800">Rejection Reason:</p>
                        <p className="text-sm text-red-700">{app.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 justify-between md:justify-end">
                    <span className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${getStatusColor(app.status)}`}>
                      <span className="text-lg">{getStatusIcon(app.status)}</span>
                      {app.status === 'pending'   && 'Pending Review'}
                      {app.status === 'approved'  && 'Approved ✓'}
                      {app.status === 'rejected'  && 'Rejected'}
                      {app.status === 'suspended' && 'Suspended'}
                    </span>
                    {app.status === 'approved' && (
                      <button
                        onClick={() => { setSelectedHospitalForDetails(app); setShowHospitalModal(true); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition">
                        View Details →
                      </button>
                    )}
                    {app.status === 'pending' && (
                      <div className="text-xs text-gray-500 text-right">
                        <p>⏳ Waiting for</p><p>hospital review</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(approvalData?.applications?.length || 0) > 0 && (
            <div className="p-6 bg-blue-50 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600 mb-3">Want to apply to more hospitals?</p>
              <button onClick={() => router.push('/auth/register')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                + Apply to Another Hospital
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  /* ═══ RENDER ═══════════════════════════════════════════ */
  return (
    <div className="theme-doctor min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ─── Page Header ───────────────────────────── */}
        <div className="role-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {section ? (sectionTitle[section] ?? 'Doctor Dashboard') : 'Doctor Dashboard'}
              </h1>
              <p className="text-white/80 text-base mt-1">
                Welcome back, <span className="font-bold text-white underline decoration-blue-400/30 underline-offset-4">Dr. {user?.lastName || user?.firstName}</span>
              </p>
            </div>
            <button id="doctor-logout-btn" onClick={handleLogout} disabled={loggingOut}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30
                         disabled:opacity-50 text-white text-sm font-semibold rounded-xl border
                         border-white/30 transition-all duration-200 backdrop-blur-sm">
              {loggingOut ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>Logging out…</>
              ) : (
                <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>Sign out</>
              )}
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            OVERVIEW (no section param)
            ════════════════════════════════════════════ */}
        {!section && (
          <>
            {/* Approval Status Banners */}
            {approvalData && !approvalData.summary.canPractice && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-xl">
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
              <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-xl">
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

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Pending</p>
                <p className="text-3xl font-bold text-amber-500">{stats.pending}</p>
                <p className="text-xs text-slate-400 mt-1">Awaiting action</p>
              </div>
              <div className="stat-card">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Approved</p>
                <p className="text-3xl font-bold text-role-primary">{stats.approved}</p>
                <p className="text-xs text-slate-400 mt-1">Confirmed</p>
              </div>
              <div className="stat-card">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Patients</p>
                <p className="text-3xl font-bold text-role-primary">{stats.patients}</p>
                <p className="text-xs text-slate-400 mt-1">Active</p>
              </div>
              <div className="stat-card">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Prescriptions</p>
                <p className="text-3xl font-bold text-role-dark">{stats.prescriptions}</p>
                <p className="text-xs text-slate-400 mt-1">Total issued</p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-blue-900">Start Online Consultation</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Open Appointments to join approved sessions and start secure video consultation.
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard/doctor?section=appointments')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
              >
                Start Now
              </button>
            </div>

            {/* Activity summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-slate-800">📅 Upcoming Appointments</h3>
                  <a href="/dashboard/doctor?section=appointments"
                    className="text-xs font-semibold text-role-primary hover:underline">Manage →</a>
                </div>
                {loadingStatus ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i=><div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse"/>)}
                  </div>
                ) : upcomingAppointments.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="text-4xl mb-2">📅</div>
                    <p className="text-slate-500 text-sm">No pending or upcoming appointments</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingAppointments.map((apt: any) => {
                      const displayDate = apt.approvedDate || apt.requestedDate;
                      const displayTime = apt.approvedTime || apt.requestedTime;
                      const statusColors: Record<string, string> = {
                        pending: 'bg-amber-50 text-amber-700',
                        approved: 'bg-green-50 text-green-700',
                        rescheduled: 'bg-blue-50 text-blue-700',
                      };
                      const tagCls = statusColors[apt.status] || 'bg-slate-50 text-slate-600';
                      return (
                        <div key={apt.id || apt._id} className="flex items-center gap-3 p-3 bg-role-subtle rounded-xl border border-role">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {apt.patient?.name || `${apt.patient?.firstName || ''} ${apt.patient?.lastName || ''}`.trim() || 'Patient'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {displayDate
                                ? new Date(displayDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })
                                : 'Date TBD'}
                              {displayTime ? ` · ${displayTime}` : ''}
                            </p>
                            {apt.reason && <p className="text-xs text-slate-400 truncate mt-0.5">{apt.reason}</p>}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0 capitalize ${tagCls}`}>
                            {apt.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-slate-800">🏥 Hospital Status</h3>
                  <a href="/dashboard/doctor?section=applications"
                    className="text-xs font-semibold text-role-primary hover:underline">View all →</a>
                </div>
                {loadingStatus ? (
                  <div className="space-y-2">
                    {[1,2].map(i=><div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse"/>)}
                  </div>
                ) : (approvalData?.applications?.length || 0) === 0 ? (
                  <div className="text-center py-6">
                    <div className="text-4xl mb-2">🏥</div>
                    <p className="text-slate-500 text-sm mb-3">No hospital applications yet</p>
                    <button onClick={() => router.push('/auth/register')}
                      className="text-xs font-semibold text-role-primary hover:underline">Apply now →</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {approvalData?.applications.slice(0, 3).map(app => (
                      <div key={app.applicationId} className="flex items-center gap-3 p-3 bg-role-subtle rounded-xl border border-role">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{app.hospital.name}</p>
                          <p className="text-xs text-slate-500">{app.department || app.hospital.type}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0 ${getStatusColor(app.status)}`}>
                          {app.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════
            SECTION VIEWS
            ════════════════════════════════════════════ */}
        {section === 'applications' && <ApplicationsList />}

        {section === 'appointments' && (
          <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
            <AppointmentManagementComponent />
          </div>
        )}

        {section === 'prescriptions' && (
          <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
            <DoctorPrescriptionsComponent />
          </div>
        )}

        {section === 'patient-records' && (
          <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
            <PatientRecordsViewer />
          </div>
        )}

        {section === 'request-access' && <RequestAccessComponent />}
        {section === 'profile' && <DoctorProfilePage />}

      </div>

      {/* ─── Hospital Details Modal ─────────────────────── */}
      {showHospitalModal && selectedHospitalForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedHospitalForDetails.hospital.name}</h2>
                  <span className="inline-block mt-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full">
                    {selectedHospitalForDetails.hospital.type?.replace('_', ' ')}
                  </span>
                </div>
                <button onClick={() => { setShowHospitalModal(false); setSelectedHospitalForDetails(null); }}
                  className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>

              <div className="space-y-6">
                {selectedHospitalForDetails.hospital.address && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Location</h3>
                    <p className="text-gray-900">
                      📍 {selectedHospitalForDetails.hospital.address.city}, {selectedHospitalForDetails.hospital.address.state}
                    </p>
                  </div>
                )}

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

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Timeline</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Applied:</span>
                      <span className="font-medium text-gray-900">{new Date(selectedHospitalForDetails.appliedAt).toLocaleDateString()}</span>
                    </div>
                    {selectedHospitalForDetails.reviewedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Reviewed:</span>
                        <span className="font-medium text-gray-900">{new Date(selectedHospitalForDetails.reviewedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    {selectedHospitalForDetails.joiningDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Joining Date:</span>
                        <span className="font-medium text-gray-900">{new Date(selectedHospitalForDetails.joiningDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Status</h3>
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
                    selectedHospitalForDetails.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedHospitalForDetails.status === 'approved' ? '✅ Approved' : selectedHospitalForDetails.status}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <button
                  onClick={() => { setShowHospitalModal(false); setSelectedHospitalForDetails(null); }}
                  className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-medium transition">
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

/* ─── Page Export with Suspense ──────────────────────── */
export default function DoctorDashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading dashboard…</p>
        </div>
      </div>
    }>
      <DoctorDashboardContent />
    </Suspense>
  );
}
