'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/authService';
import PatientPermissionsComponent from './permissions';
import BookAppointmentComponent from './book-appointment';
import MentalHealthComponent from './mental-health';
import MedicalRecordsComponent from './medical-records';
import PatientProfilePage from './profile';
import EmergencyQRPage from './emergency-qr';
import PatientPrescriptionsComponent from './prescriptions';

/* ─── Types ─────────────────────────────────────────── */
interface AppointmentItem {
  id?: string;
  _id?: string;
  requestedDate?: string;
  approvedDate?: string;
  requestedTime?: string;
  approvedTime?: string;
  doctor?: { id?: string; name?: string; fullName?: string; firstName?: string; lastName?: string };
  status: string;
  reason?: string;
  appointmentType?: string;
}

interface PrescriptionItem {
  id: string;
  _id?: string;
  medicines?: Array<{ name: string; dosage?: string }>;
  doctorName?: string;
  createdAt: string;
}

interface ActivityItem {
  id: string;
  icon: string;
  description: string;
  time: string;
}

/* ─── Inner Component (uses searchParams) ────────────── */
function PatientDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get('section');
  const { user, isLoading, logout } = useAuth();

  const [loggingOut, setLoggingOut] = useState(false);
  const [stats, setStats] = useState({ appointments: 0, medicalRecords: 0, doctorsWithAccess: 0, prescriptions: 0 });
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentItem[]>([]);
  const [ongoingPrescriptions, setOngoingPrescriptions] = useState<PrescriptionItem[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);

  /* ─── Data fetch ──────────────────────────────────── */
  useEffect(() => {
    if (!user || section) return; // only fetch for overview
    const fetchOverviewData = async () => {
      try {
        setOverviewLoading(true);
        const [apptRes, recordsRes, permRes, rxRes] = await Promise.all([
          api.get('/appointments/my-appointments'),
          api.get('/medical-records/stats/summary'),
          api.get('/permissions'),
          api.get('/prescriptions/patient'),
        ]);

        const allAppts: AppointmentItem[] = apptRes.data?.data || [];
        // Show pending + approved (not yet completed/cancelled) appointments
        const upcoming = allAppts
          .filter(a => ['pending', 'approved', 'rescheduled'].includes(a.status))
          .sort((a, b) => {
            const dateA = new Date(a.approvedDate || a.requestedDate || 0).getTime();
            const dateB = new Date(b.approvedDate || b.requestedDate || 0).getTime();
            return dateA - dateB;
          })
          .slice(0, 3);

        const activePerms = (permRes.data?.data?.permissions || [])
          .filter((p: any) => p.status === 'approved' && new Date(p.expiryDate) > new Date()).length;

        const allRx: PrescriptionItem[] = rxRes.data?.data || [];

        setStats({
          appointments: upcoming.length,
          medicalRecords: recordsRes.data?.data?.totalRecords || 0,
          doctorsWithAccess: activePerms,
          prescriptions: rxRes.data?.count || allRx.length || 0,
        });
        setUpcomingAppointments(upcoming);
        setOngoingPrescriptions(allRx.slice(0, 3));

        const activities: ActivityItem[] = [
          ...allAppts.slice(0, 3).map(a => ({
            id: a.id || a._id || String(Math.random()), icon: '📅',
            description: `Appointment ${a.status} — Dr. ${a.doctor?.name || a.doctor?.firstName || '—'}`,
            time: a.approvedDate || a.requestedDate || new Date().toISOString(),
          })),
          ...allRx.slice(0, 2).map(r => ({
            id: r.id || r._id || String(Math.random()), icon: '💊',
            description: `Prescription: ${r.medicines?.[0]?.name || 'Medication'}`,
            time: r.createdAt,
          })),
        ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);

        setActivityLog(activities);
      } catch (e) {
        console.error('Overview data error:', e);
      } finally {
        setOverviewLoading(false);
      }
    };
    fetchOverviewData();
  }, [user, section]);

  useEffect(() => {
    if (!isLoading && !user) router.push('/auth/patient-login');
  }, [user, isLoading, router]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.push('/auth/patient-login');
    } catch {
      sessionStorage.clear();
      router.push('/auth/patient-login');
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  );
  if (!user) return null;

  const sectionTitle: Record<string, string> = {
    records: 'My Medical Records', appointments: 'Appointments',
    prescriptions: 'My Prescriptions', permissions: 'Access Control',
    emergency: 'Emergency QR', 'mental-health': 'Mental Health', profile: 'Profile',
  };

  return (
    <div className="theme-patient min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ─── Page Header ───────────────────────────── */}
        <div className="role-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {section ? (sectionTitle[section] ?? 'Patient Dashboard') : 'Patient Dashboard'}
              </h1>
              <p className="text-white/80 text-base mt-1">
                Welcome back, <span className="font-bold text-white underline decoration-green-400/30 underline-offset-4">{user.firstName} {user.lastName}</span>
              </p>
            </div>
            <button
              id="patient-logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30
                         disabled:opacity-50 text-white text-sm font-semibold rounded-xl border
                         border-white/30 transition-all duration-200 backdrop-blur-sm"
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            OVERVIEW (no section param)
            ════════════════════════════════════════════ */}
        {!section && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Appointments', value: stats.appointments, sub: 'Upcoming' },
                { label: 'Medical Records', value: stats.medicalRecords, sub: 'Total' },
                { label: 'Doctors', value: stats.doctorsWithAccess, sub: 'With access' },
                { label: 'Prescriptions', value: stats.prescriptions, sub: 'Active' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{s.label}</p>
                  <p className="text-3xl font-bold text-role-primary">{s.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-green-900">Start Online Consultation</h3>
                <p className="text-sm text-green-700 mt-1">
                  Open Appointments and tap Meet for approved online sessions.
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard/patient?section=appointments')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
              >
                Start Now
              </button>
            </div>

            {/* Upcoming appointments + Ongoing prescriptions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── Upcoming Appointments ── */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-slate-800">📅 Upcoming Appointments</h3>
                  <a href="/dashboard/patient?section=appointments"
                    className="text-xs font-semibold text-role-primary hover:underline">View all →</a>
                </div>

                {overviewLoading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
                  </div>
                ) : upcomingAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">📅</div>
                    <p className="text-slate-500 text-sm mb-3">No upcoming appointments</p>
                    <a href="/dashboard/patient?section=appointments"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-role-primary hover:underline">
                      Book one now →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingAppointments.map(apt => {
                      const displayDate = apt.approvedDate || apt.requestedDate;
                      const displayTime = apt.approvedTime || apt.requestedTime;
                      const statusColors: Record<string, string> = {
                        pending: 'bg-amber-50 text-amber-700',
                        approved: 'bg-green-50 text-green-700',
                        rescheduled: 'bg-blue-50 text-blue-700',
                      };
                      const tagCls = statusColors[apt.status] || 'bg-slate-50 text-slate-600';
                      const aptId = apt.id || apt._id || '';
                      return (
                        <div key={aptId}
                          className="flex items-center gap-3 p-3 bg-role-subtle rounded-xl border border-role">
                          <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 bg-role-primary text-white shadow-sm">
                            <span className="text-lg leading-none">
                              {apt.status === 'pending' ? '⏳' : apt.status === 'approved' ? '✅' : '📅'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              Dr. {apt.doctor?.name?.replace('Dr. ', '') || apt.doctor?.firstName || 'Doctor'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {displayDate
                                ? new Date(displayDate).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })
                                : 'Date TBD'}
                              {displayTime ? ` · ${displayTime}` : ''}
                            </p>
                            {apt.reason && (
                              <p className="text-xs text-slate-400 truncate mt-0.5">{apt.reason}</p>
                            )}
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

              {/* ── Ongoing Prescriptions ── */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-slate-800">💊 Ongoing Prescriptions</h3>
                  <a href="/dashboard/patient?section=prescriptions"
                    className="text-xs font-semibold text-role-primary hover:underline">View all →</a>
                </div>

                {overviewLoading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
                  </div>
                ) : ongoingPrescriptions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">💊</div>
                    <p className="text-slate-500 text-sm">No active prescriptions</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ongoingPrescriptions.map((rx, i) => (
                      <div key={rx.id || rx._id || i}
                        className="flex items-center gap-3 p-3 bg-role-subtle rounded-xl border border-role">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-soft">
                          <span className="text-xl">💊</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {rx.medicines?.[0]?.name || 'Medication'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {rx.medicines?.[0]?.dosage || 'As prescribed'}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Since {new Date(rx.createdAt).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full font-semibold bg-green-50 text-green-700 flex-shrink-0">
                          Active
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Activity Log ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
              <h3 className="text-base font-semibold text-slate-800 mb-4">🕐 Recent Activity</h3>
              {overviewLoading ? (
                <div className="space-y-2">
                  {[1,2,3,4].map(i => <div key={i} className="h-10 rounded-xl bg-slate-100 animate-pulse" />)}
                </div>
              ) : activityLog.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No recent activity to display</p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {activityLog.map((item, i) => (
                    <div key={`${item.id}-${i}`} className="flex items-center gap-4 py-3">
                      <span className="text-xl flex-shrink-0 w-8 text-center">{item.icon}</span>
                      <p className="flex-1 text-sm text-slate-700">{item.description}</p>
                      <span className="text-xs text-slate-400 flex-shrink-0 whitespace-nowrap">
                        {new Date(item.time).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════
            SECTION VIEWS
            ════════════════════════════════════════════ */}
        {section === 'appointments' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
            <BookAppointmentComponent />
          </div>
        )}

        {section === 'records' && (
          <div className="space-y-4">
            <MedicalRecordsComponent />
          </div>
        )}

        {section === 'prescriptions' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
            <PatientPrescriptionsComponent />
          </div>
        )}

        {section === 'permissions' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
            <PatientPermissionsComponent />
          </div>
        )}

        {section === 'mental-health' && <MentalHealthComponent />}
        {section === 'profile' && <PatientProfilePage />}
        {section === 'emergency' && <EmergencyQRPage />}

      </div>
    </div>
  );
}

/* ─── Page Export with Suspense ──────────────────────── */
export default function PatientDashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading dashboard…</p>
        </div>
      </div>
    }>
      <PatientDashboardContent />
    </Suspense>
  );
}
