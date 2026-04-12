'use client';

import { useState, useEffect } from 'react';
import { authService } from '@/services/authService';
import { useRouter } from 'next/navigation';

interface Appointment {
  id: string;
  appointmentNumber: string;
  patient: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    age?: number;
    gender?: string;
  };
  hospital?: string;
  requestedDate: string;
  requestedTime: string;
  approvedDate?: string;
  approvedTime?: string;
  proposedDate?: string;
  proposedTime?: string;
  reason: string;
  symptoms?: string[];
  appointmentType: string;
  priority: string;
  duration: number;
  status: string;
  doctorResponse?: string;
  doctorNotes?: string;
  requestedAt: string;
  respondedAt?: string;
  time?: string;
}

interface AppointmentCounts {
  pending: number;
  approved: number;
  completed: number;
  rejected: number;
  rescheduled: number;
  cancelled: number;
  no_show: number;
}

const getStatusBadge = (status: string) => {
  const badges: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '⏳', label: 'Pending' },
    approved: { bg: 'bg-green-100', text: 'text-green-800', icon: '✅', label: 'Confirmed' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: '❌', label: 'Rejected' },
    rescheduled: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '🔄', label: 'Rescheduled' },
    completed: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '✔️', label: 'Completed' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🚫', label: 'Cancelled' },
    no_show: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '👻', label: 'No Show' }
  };
  return badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: '❓', label: status };
};

const getPriorityBadge = (priority: string) => {
  const badges: Record<string, { bg: string; icon: string }> = {
    normal: { bg: 'bg-green-100 text-green-800', icon: '🟢' },
    urgent: { bg: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
    emergency: { bg: 'bg-red-100 text-red-800', icon: '🔴' }
  };
  return badges[priority] || badges.normal;
};

const getAppointmentTypeLabel = (type: string) => {
  const types: Record<string, string> = {
    consultation: '🩺 Consultation',
    follow_up: '🔄 Follow-up',
    checkup: '📋 Check-up',
    emergency: '🚨 Emergency',
    procedure: '💉 Procedure',
    telemedicine: '💻 Telemedicine'
  };
  return types[type] || type;
};

export default function AppointmentManagementComponent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'today' | 'all'>('pending');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [counts, setCounts] = useState<AppointmentCounts>({
    pending: 0, approved: 0, completed: 0, rejected: 0, rescheduled: 0, cancelled: 0, no_show: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  // Form data for modals
  const [approveData, setApproveData] = useState({ notes: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [rescheduleData, setRescheduleData] = useState({ 
    proposedDate: '', 
    proposedTime: '', 
    message: '' 
  });

  useEffect(() => {
    fetchPendingAppointments();
    fetchTodayAppointments();
    fetchAllAppointments();
  }, []);

  const fetchPendingAppointments = async () => {
    try {
      setLoading(true);
      const response = await authService.client.get('/appointments/pending');
      const data = response.data;
      if (data.success) {
        setAppointments(prev => {
          // Merge with existing, prioritizing pending
          const pending = data.data;
          const others = prev.filter(a => a.status !== 'pending');
          return [...pending, ...others];
        });
      }
    } catch (err) {
      console.error('Failed to fetch pending appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAppointments = async () => {
    try {
      const response = await authService.client.get('/appointments/today');
      const data = response.data;
      if (data.success) {
        setTodayAppointments(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch today appointments:', err);
    }
  };

  const fetchAllAppointments = async () => {
    try {
      const response = await authService.client.get('/appointments/doctor');
      const data = response.data;
      if (data.success) {
        setAppointments(data.data);
        setCounts(data.counts);
      }
    } catch (err) {
      console.error('Failed to fetch all appointments:', err);
    }
  };

  const handleApprove = async () => {
    if (!selectedAppointment) return;
    
    setProcessingId(selectedAppointment.id);
    try {
      const response = await authService.client.post(
        `/appointments/${selectedAppointment.id}/approve`,
        {
          notes: approveData.notes
        }
      );
      const data = response.data;
      if (data.success) {
        setSuccess('✅ Appointment approved!');
        setShowApproveModal(false);
        setApproveData({ notes: '' });
        fetchPendingAppointments();
        fetchTodayAppointments();
        fetchAllAppointments();
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve appointment');
    } finally {
      setProcessingId(null);
      setSelectedAppointment(null);
    }
  };

  const handleReject = async () => {
    if (!selectedAppointment || !rejectReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }
    
    setProcessingId(selectedAppointment.id);
    try {
      const response = await authService.client.post(
        `/appointments/${selectedAppointment.id}/reject`,
        { reason: rejectReason }
      );
      const data = response.data;
      if (data.success) {
        setSuccess('Appointment rejected');
        setShowRejectModal(false);
        setRejectReason('');
        fetchPendingAppointments();
        fetchAllAppointments();
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject appointment');
    } finally {
      setProcessingId(null);
      setSelectedAppointment(null);
    }
  };

  const handleReschedule = async () => {
    if (!selectedAppointment || !rescheduleData.proposedDate || !rescheduleData.proposedTime) {
      setError('Please provide proposed date and time');
      return;
    }
    
    setProcessingId(selectedAppointment.id);
    try {
      const response = await authService.client.post(
        `/appointments/${selectedAppointment.id}/reschedule`,
        rescheduleData
      );
      const data = response.data;
      if (data.success) {
        setSuccess('🔄 Reschedule proposal sent to patient');
        setShowRescheduleModal(false);
        setRescheduleData({ proposedDate: '', proposedTime: '', message: '' });
        fetchPendingAppointments();
        fetchAllAppointments();
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reschedule appointment');
    } finally {
      setProcessingId(null);
      setSelectedAppointment(null);
    }
  };

  const handleComplete = async (appointmentId: string) => {
    setProcessingId(appointmentId);
    try {
      const response = await authService.client.post(
        `/appointments/${appointmentId}/complete`,
        { notes: '' }
      );
      const data = response.data;
      if (data.success) {
        setSuccess('✔️ Appointment marked as completed');
        fetchTodayAppointments();
        fetchAllAppointments();
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete appointment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleNoShow = async (appointmentId: string) => {
    if (!confirm('Mark this patient as no-show?')) return;
    
    setProcessingId(appointmentId);
    try {
      const response = await authService.client.post(
        `/appointments/${appointmentId}/no-show`
      );
      const data = response.data;
      if (data.success) {
        setSuccess('Appointment marked as no-show');
        fetchTodayAppointments();
        fetchAllAppointments();
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to mark no-show');
    } finally {
      setProcessingId(null);
    }
  };

  // Get tomorrow's date as min date for rescheduling
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const pendingAppointments = appointments.filter(a => a.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'pending'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ⏳ Pending Requests
          {counts.pending > 0 && (
            <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
              {counts.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('today'); fetchTodayAppointments(); }}
          className={`px-6 py-3 font-medium ${
            activeTab === 'today'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📅 Today's Schedule
          {todayAppointments.length > 0 && (
            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              {todayAppointments.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('all'); fetchAllAppointments(); }}
          className={`px-6 py-3 font-medium ${
            activeTab === 'all'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📋 All Appointments
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError('')} className="float-right">✕</button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
          <button onClick={() => setSuccess('')} className="float-right">✕</button>
        </div>
      )}

      {/* Pending Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Appointment Requests ({pendingAppointments.length})
          </h3>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : pendingAppointments.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-4xl mb-4">✅</p>
              <p className="text-gray-600">No pending appointment requests</p>
            </div>
          ) : (
            pendingAppointments.map(apt => {
              const priorityBadge = getPriorityBadge(apt.priority);
              
              return (
                <div
                  key={apt.id}
                  className={`bg-white p-6 rounded-lg shadow border-l-4 ${
                    apt.priority === 'emergency' ? 'border-red-500' :
                    apt.priority === 'urgent' ? 'border-yellow-500' :
                    'border-blue-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {apt.patient.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {apt.patient.age && `${apt.patient.age} years`}
                        {apt.patient.gender && ` • ${apt.patient.gender}`}
                      </p>
                      {apt.patient.phone && (
                        <p className="text-sm text-gray-500">📞 {apt.patient.phone}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 ${priorityBadge.bg} text-sm rounded-full`}>
                        {priorityBadge.icon} {apt.priority.toUpperCase()}
                      </span>
                      <p className="text-xs text-gray-500 mt-2">
                        Requested: {new Date(apt.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">REQUESTED DATE</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(apt.requestedDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">REQUESTED TIME</p>
                      <p className="font-semibold text-gray-900">{apt.requestedTime}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">TYPE</p>
                      <p className="font-semibold text-gray-900">
                        {getAppointmentTypeLabel(apt.appointmentType)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">DURATION</p>
                      <p className="font-semibold text-gray-900">{apt.duration} min</p>
                    </div>
                  </div>

                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700">Reason for Visit:</p>
                    <p className="text-sm text-gray-600">{apt.reason}</p>
                    {apt.symptoms && apt.symptoms.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">Symptoms: </span>
                        {apt.symptoms.map((s, i) => (
                          <span key={i} className="inline-block px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded mr-1">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedAppointment(apt);
                        setShowApproveModal(true);
                      }}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAppointment(apt);
                        setShowRescheduleModal(true);
                      }}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                    >
                      🔄 Reschedule
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAppointment(apt);
                        setShowRejectModal(true);
                      }}
                      className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Today Tab */}
      {activeTab === 'today' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Today's Appointments ({todayAppointments.length})
          </h3>
          
          {todayAppointments.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-4xl mb-4">📅</p>
              <p className="text-gray-600">No appointments scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map(apt => (
                <div
                  key={apt.id}
                  className="bg-white p-5 rounded-lg shadow flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center px-4 py-2 bg-blue-100 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{apt.time}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{apt.patient.name}</h4>
                      <p className="text-sm text-gray-600">
                        {getAppointmentTypeLabel(apt.appointmentType)} • {apt.duration} min
                      </p>
                      <p className="text-sm text-gray-500">{apt.reason}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {apt.appointmentType === 'telemedicine' && (
                      <button
                        onClick={() => router.push(`/dashboard/consultation/${apt.id}`)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Meet
                      </button>
                    )}
                    <button
                      onClick={() => handleComplete(apt.id)}
                      disabled={processingId === apt.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm"
                    >
                      ✔️ Complete
                    </button>
                    <button
                      onClick={() => handleNoShow(apt.id)}
                      disabled={processingId === apt.id}
                      className="px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-50 text-sm"
                    >
                      👻 No Show
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Tab */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 md:grid-cols-7 gap-2 mb-6">
            {Object.entries(counts).map(([status, count]) => {
              const badge = getStatusBadge(status);
              return (
                <div key={status} className={`p-3 rounded-lg ${badge.bg}`}>
                  <p className={`text-xl font-bold ${badge.text}`}>{count}</p>
                  <p className={`text-xs ${badge.text}`}>{badge.icon} {badge.label}</p>
                </div>
              );
            })}
          </div>

          <h3 className="text-lg font-semibold text-gray-900">All Appointments</h3>
          
          {appointments.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No appointments yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map(apt => {
                const badge = getStatusBadge(apt.status);
                
                return (
                  <div
                    key={apt.id}
                    className="bg-white p-4 rounded-lg shadow flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-semibold text-gray-900">{apt.patient.name}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(apt.approvedDate || apt.requestedDate).toLocaleDateString()} 
                        {' at '}{apt.approvedTime || apt.requestedTime}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getAppointmentTypeLabel(apt.appointmentType)} • #{apt.appointmentNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {apt.status === 'approved' && apt.appointmentType === 'telemedicine' && (
                        <button
                          onClick={() => router.push(`/dashboard/consultation/${apt.id}`)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Meet
                        </button>
                      )}
                      <span className={`px-3 py-1 ${badge.bg} ${badge.text} text-sm rounded-full`}>
                        {badge.icon} {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">✅ Approve Appointment</h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-medium">{selectedAppointment.patient.name}</p>
              <p className="text-sm text-gray-600">
                {new Date(selectedAppointment.requestedDate).toLocaleDateString()} at {selectedAppointment.requestedTime}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Any notes for this appointment..."
                  value={approveData.notes}
                  onChange={(e) => setApproveData({...approveData, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleApprove}
                disabled={processingId === selectedAppointment.id}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400"
              >
                {processingId === selectedAppointment.id ? '⏳' : '✅'} Confirm Approval
              </button>
              <button
                onClick={() => { setShowApproveModal(false); setSelectedAppointment(null); }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">❌ Reject Appointment</h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-medium">{selectedAppointment.patient.name}</p>
              <p className="text-sm text-gray-600">
                {new Date(selectedAppointment.requestedDate).toLocaleDateString()} at {selectedAppointment.requestedTime}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="Please explain why you're rejecting this appointment..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleReject}
                disabled={processingId === selectedAppointment.id || !rejectReason.trim()}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400"
              >
                {processingId === selectedAppointment.id ? '⏳' : '❌'} Reject
              </button>
              <button
                onClick={() => { setShowRejectModal(false); setSelectedAppointment(null); setRejectReason(''); }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🔄 Propose New Time</h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-medium">{selectedAppointment.patient.name}</p>
              <p className="text-sm text-gray-600">
                Original: {new Date(selectedAppointment.requestedDate).toLocaleDateString()} at {selectedAppointment.requestedTime}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proposed Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  min={minDate}
                  value={rescheduleData.proposedDate}
                  onChange={(e) => setRescheduleData({...rescheduleData, proposedDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proposed Time <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={rescheduleData.proposedTime}
                  onChange={(e) => setRescheduleData({...rescheduleData, proposedTime: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select time</option>
                  <option value="09:00">09:00 AM</option>
                  <option value="09:30">09:30 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="10:30">10:30 AM</option>
                  <option value="11:00">11:00 AM</option>
                  <option value="11:30">11:30 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="14:30">02:30 PM</option>
                  <option value="15:00">03:00 PM</option>
                  <option value="15:30">03:30 PM</option>
                  <option value="16:00">04:00 PM</option>
                  <option value="16:30">04:30 PM</option>
                  <option value="17:00">05:00 PM</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message to Patient (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Let the patient know why you're rescheduling..."
                  value={rescheduleData.message}
                  onChange={(e) => setRescheduleData({...rescheduleData, message: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleReschedule}
                disabled={processingId === selectedAppointment.id || !rescheduleData.proposedDate || !rescheduleData.proposedTime}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400"
              >
                {processingId === selectedAppointment.id ? '⏳' : '🔄'} Send Proposal
              </button>
              <button
                onClick={() => { 
                  setShowRescheduleModal(false); 
                  setSelectedAppointment(null); 
                  setRescheduleData({ proposedDate: '', proposedTime: '', message: '' });
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
