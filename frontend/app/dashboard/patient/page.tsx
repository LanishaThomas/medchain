'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/authService';
import PatientPermissionsComponent from './permissions';
import BookAppointmentComponent from './book-appointment';
import MentalHealthComponent from './mental-health';
import MedicalRecordsComponent from './medical-records';
import PatientProfilePage from './profile';
import EmergencyQRPage from './emergency-qr';
import PatientPrescriptionsComponent from './prescriptions';

export default function PatientDashboard() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'prescriptions' | 'records' | 'permissions' | 'mental-health' | 'profile' | 'emergency'>('overview');
  
  // Dashboard states
  const [stats, setStats] = useState({
    appointments: 0,
    medicalRecords: 0,
    doctorsWithAccess: 0,
    prescriptions: 0
  });

  const fetchStats = async () => {
    try {
      if (!user) return;
      const [appointmentsRes, recordsRes, permissionsRes, prescriptionsRes] = await Promise.all([
        api.get('/appointments/my-appointments'),
        api.get('/medical-records/stats/summary'),
        api.get('/permissions'),
        api.get('/prescriptions/patient')
      ]);

      const upcomingAppointments = appointmentsRes.data?.data?.appointments?.filter((a: any) => 
        ['scheduled', 'rescheduled'].includes(a.status)
      ).length || 0;

      const activePermissions = permissionsRes.data?.data?.permissions?.filter((p: any) => 
        p.status === 'approved' && new Date(p.expiryDate) > new Date()
      ).length || 0;

      setStats({
        appointments: upcomingAppointments,
        medicalRecords: recordsRes.data?.data?.totalRecords || 0,
        doctorsWithAccess: activePermissions,
        prescriptions: prescriptionsRes.data?.count || 0
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview' && user) {
      fetchStats();
    }
  }, [activeTab, user]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      router.push('/auth/patient-login');
    } catch (err) {
      console.error('Logout error:', err);
      localStorage.clear();
      router.push('/auth/patient-login');
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/patient-login');
    }
  }, [user, isLoading, router]);

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

  return (
    <div className="theme-patient min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8 animate-fade-in">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ─── Page Header ─────────────────────────────── */}
        <div className="role-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Patient Dashboard</h1>
              <p className="text-white/75 text-sm mt-1">
                Welcome back, <span className="font-semibold text-white">{user.firstName} {user.lastName}</span>
              </p>
            </div>
            <button
              id="patient-logout-btn"
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
        
        {/* ─── Tab Navigation ───────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-2">
          <div className="flex gap-1 flex-wrap">
            {([
              { id: 'overview',      label: 'Overview',         emoji: '🏠' },
              { id: 'appointments',  label: 'Appointments',     emoji: '📅' },
              { id: 'prescriptions', label: 'Prescriptions',    emoji: '💊' },
              { id: 'records',       label: 'Medical Records',  emoji: '📁' },
              { id: 'permissions',   label: 'Permissions',      emoji: '🔐' },
              { id: 'mental-health', label: 'Mental Health',    emoji: '🧠' },
              { id: 'profile',       label: 'Profile',          emoji: '👤' },
              { id: 'emergency',     label: 'Emergency QR',     emoji: '🚨' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${ activeTab === tab.id ? 'tab-btn-active' : '' }`}
              >
                <span className="mr-1.5">{tab.emoji}</span>{tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
        <>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Appointments</p>
            <p className="text-3xl font-bold text-role-primary">{stats.appointments}</p>
            <p className="text-xs text-slate-400 mt-1">Upcoming</p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Medical Records</p>
            <p className="text-3xl font-bold text-role-primary">{stats.medicalRecords}</p>
            <p className="text-xs text-slate-400 mt-1">Total</p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Doctors</p>
            <p className="text-3xl font-bold text-role-dark">{stats.doctorsWithAccess}</p>
            <p className="text-xs text-slate-400 mt-1">With access</p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Prescriptions</p>
            <p className="text-3xl font-bold text-role-primary">{stats.prescriptions}</p>
            <p className="text-xs text-slate-400 mt-1">Active</p>
          </div>
        </div>

        {/* ─── Quick Actions ────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {[
              { emoji: '📅', label: 'Book Appointment', action: () => setActiveTab('appointments'), color: 'hover:bg-sky-50 hover:border-sky-200' },
              { emoji: '📁', label: 'My Records',        action: () => setActiveTab('records'),      color: 'hover:bg-emerald-50 hover:border-emerald-200' },
              { emoji: '💊', label: 'Prescriptions',     action: () => setActiveTab('prescriptions'), color: 'hover:bg-indigo-50 hover:border-indigo-200' },
              { emoji: '🧠', label: 'Mental Health',     action: () => setActiveTab('mental-health'), color: 'hover:bg-teal-50 hover:border-teal-200' },
              { emoji: '🤖', label: 'AI Assistant',      action: () => router.push('/chatbot'),       color: 'hover:bg-purple-50 hover:border-purple-200' },
              { emoji: '👤', label: 'Profile',           action: () => setActiveTab('profile'),       color: 'hover:bg-slate-100 hover:border-slate-200' },
              { emoji: '🚨', label: 'Emergency QR',      action: () => setActiveTab('emergency'),     color: 'hover:bg-red-50 hover:border-red-200' },
            ].map((item) => (
              <button
                key={item.label}
                id={`quick-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={item.action}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 transition-all duration-150 ${item.color}`}
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="text-xs font-medium text-slate-700 text-center leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        </>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6">📅 Appointments</h2>
            <BookAppointmentComponent />
          </div>
        )}

        {/* Medical Records Tab */}
        {activeTab === 'records' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">📁 Medical Records</h2>
            <MedicalRecordsComponent />
          </div>
        )}

        {/* Prescriptions Tab */}
        {activeTab === 'prescriptions' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6">💊 My Prescriptions</h2>
            <PatientPrescriptionsComponent />
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-soft p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6">🔐 Manage Doctor Access Permissions</h2>
            <PatientPermissionsComponent />
          </div>
        )}

        {/* Mental Health Tab */}
        {activeTab === 'mental-health' && (
          <MentalHealthComponent />
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <PatientProfilePage />
        )}

        {/* Emergency QR Tab */}
        {activeTab === 'emergency' && (
          <EmergencyQRPage />
        )}
      </div>
    </div>
  );
}
