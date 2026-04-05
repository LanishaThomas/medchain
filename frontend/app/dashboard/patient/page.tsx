'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/authService';
import PatientPermissionsComponent from './permissions';
import BookAppointmentComponent from './book-appointment';
import MentalHealthComponent from './mental-health';
import MedicalRecordsComponent from './medical-records';

export default function PatientDashboard() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'appointments' | 'records' | 'permissions' | 'mental-health'>('overview');
  
  // Dashboard states
  const [stats, setStats] = useState({
    appointments: 0,
    medicalRecords: 0,
    doctorsWithAccess: 0
  });

  const fetchStats = async () => {
    try {
      if (!user) return;
      const [appointmentsRes, recordsRes, permissionsRes] = await Promise.all([
        api.get('/appointments/patient'),
        api.get('/medical-records/stats/summary'),
        api.get('/permissions')
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
        doctorsWithAccess: activePermissions
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with logout */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Patient Dashboard</h1>
            <p className="text-gray-600">Welcome, {user.firstName} {user.lastName}</p>
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
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
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
              onClick={() => setActiveTab('records')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'records'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              📁 Medical Records
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'permissions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              🔐 Manage Permissions
            </button>
            <button
              onClick={() => setActiveTab('mental-health')}
              className={`px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'mental-health'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              🧠 Mental Health
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
        <>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Appointments</h2>
            <p className="text-3xl font-bold text-blue-600">{stats.appointments}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Medical Records</h2>
            <p className="text-3xl font-bold text-green-600">{stats.medicalRecords}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Doctors</h2>
            <p className="text-3xl font-bold text-purple-600">{stats.doctorsWithAccess}</p>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <button 
              onClick={() => setActiveTab('appointments')}
              className="p-4 border rounded-lg hover:bg-gray-50 text-center"
            >
              <span className="text-2xl mb-2 block">📅</span>
              <span className="text-sm font-medium">Book Appointment</span>
            </button>
            <button className="p-4 border rounded-lg hover:bg-gray-50 text-center" onClick={() => setActiveTab('records')}>
              <span className="text-2xl mb-2 block">📁</span>
              <span className="text-sm font-medium">My Records</span>
            </button>
            <button className="p-4 border rounded-lg hover:bg-gray-50 text-center">
              <span className="text-2xl mb-2 block">💊</span>
              <span className="text-sm font-medium">Prescriptions</span>
            </button>
            <button 
              onClick={() => setActiveTab('mental-health')}
              className="p-4 border rounded-lg hover:bg-teal-50 text-center border-teal-200"
            >
              <span className="text-2xl mb-2 block">🧠</span>
              <span className="text-sm font-medium text-teal-700">Mental Health</span>
            </button>
            <button 
              onClick={() => router.push('/chatbot')}
              className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 text-center"
            >
              <span className="text-2xl mb-2 block">🤖</span>
              <span className="text-sm font-medium text-purple-700">AI Assistant</span>
            </button>
            <button className="p-4 border rounded-lg hover:bg-gray-50 text-center">
              <span className="text-2xl mb-2 block">👤</span>
              <span className="text-sm font-medium">Profile</span>
            </button>
          </div>
        </div>
        </>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">📅 Appointments</h2>
            <BookAppointmentComponent />
          </div>
        )}

        {/* Medical Records Tab */}
        {activeTab === 'records' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">📁 Medical Records</h2>
            <MedicalRecordsComponent />
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">🔐 Manage Doctor Access Permissions</h2>
            <PatientPermissionsComponent />
          </div>
        )}

        {/* Mental Health Tab */}
        {activeTab === 'mental-health' && (
          <MentalHealthComponent />
        )}
      </div>
    </div>
  );
}
