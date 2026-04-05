'use client';

import { useState, useEffect } from 'react';
import { authService } from '@/services/authService';

interface Hospital {
  id: string;
  name: string;
  type: string;
  description?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  phone?: string;
  email?: string;
  specialties?: string[];
  facilities?: string[];
  bedCount?: number;
  is24HoursEmergency?: boolean;
}

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  hospital: {
    id: string;
    name: string;
  };
  department?: string;
}

interface Appointment {
  id: string;
  appointmentNumber: string;
  doctor: {
    name: string;
    specialization: string;
    phone?: string;
  };
  hospital?: {
    name: string;
  };
  requestedDate: string;
  requestedTime: string;
  approvedDate?: string;
  approvedTime?: string;
  proposedDate?: string;
  proposedTime?: string;
  reason: string;
  appointmentType: string;
  priority: string;
  status: string;
  doctorResponse?: string;
  meetingLink?: string;
}

const getStatusBadge = (status: string) => {
  const badges: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '⏳', label: 'Pending Approval' },
    approved: { bg: 'bg-green-100', text: 'text-green-800', icon: '✅', label: 'Confirmed' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: '❌', label: 'Rejected' },
    rescheduled: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '🔄', label: 'Rescheduled' },
    completed: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '✔️', label: 'Completed' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🚫', label: 'Cancelled' },
    no_show: { bg: 'bg-orange-100', text: 'text-orange-800', icon: '👻', label: 'No Show' }
  };
  return badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: '❓', label: status };
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

export default function BookAppointmentComponent() {
  const [activeTab, setActiveTab] = useState<'book' | 'my-appointments'>('book');
  const [bookingStep, setBookingStep] = useState<'hospital' | 'doctor' | 'form'>('hospital');
  
  // Data states
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  // Selection states
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    requestedDate: '',
    requestedTime: '',
    reason: '',
    symptoms: '',
    appointmentType: 'consultation',
    priority: 'normal'
  });

  // Filters
  const [specializationFilter, setSpecializationFilter] = useState('');

  useEffect(() => {
    if (activeTab === 'book') {
      fetchHospitals();
    } else {
      fetchMyAppointments();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedHospital) {
      fetchDoctorsByHospital(selectedHospital.id);
    }
  }, [selectedHospital, specializationFilter]);

  const fetchHospitals = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🔍 Fetching hospitals from API...');
      
      const response = await authService.client.get('/hospital/list');
      const data = response.data;
      
      console.log('Response data:', data);
      
      if (data.success) {
        console.log('✅ Hospitals received:', data.count, data.data);
        setHospitals(data.data);
        if (data.data.length === 0) {
          setError('No hospitals found in database. Please contact administrator.');
        }
      } else {
        setError(data.message || 'Failed to load hospitals');
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch hospitals:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError(err.response?.data?.message || 'Failed to load hospitals. Check console for details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorsByHospital = async (hospitalId: string) => {
    try {
      setLoadingDoctors(true);
      const params = new URLSearchParams({ hospitalId });
      if (specializationFilter) params.append('specialization', specializationFilter);

      const response = await authService.client.get(`/appointments/doctors?${params}`);
      const data = response.data;
      
      if (data.success) {
        setDoctors(data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch doctors:', err);
      setError(err.response?.data?.message || 'Failed to load doctors');
    } finally {
      setLoadingDoctors(false);
    }
  };

  const fetchMyAppointments = async () => {
    try {
      const response = await authService.client.get('/appointments/my-appointments');
      const data = response.data;
      
      if (data.success) {
        setAppointments(data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch appointments:', err);
    }
  };

  const handleSelectHospital = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setSelectedDoctor(null);
    setBookingStep('doctor');
  };

  const handleSelectDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setBookingStep('form');
  };

  const handleBackToHospitals = () => {
    setSelectedHospital(null);
    setSelectedDoctor(null);
    setDoctors([]);
    setSpecializationFilter('');
    setBookingStep('hospital');
  };

  const handleBackToDoctors = () => {
    setSelectedDoctor(null);
    setBookingStep('doctor');
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !selectedHospital) {
      setError('Please select a hospital and doctor');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authService.client.post('/appointments/request', {
        doctorId: selectedDoctor.id,
        hospitalId: selectedHospital.id,
        requestedDate: formData.requestedDate,
        requestedTime: formData.requestedTime,
        reason: formData.reason,
        symptoms: formData.symptoms.split(',').map(s => s.trim()).filter(s => s),
        appointmentType: formData.appointmentType,
        priority: formData.priority
      });

      const data = response.data;
      if (data.success) {
        setSuccess('✅ Appointment request submitted! Waiting for doctor approval.');
        setFormData({
          requestedDate: '',
          requestedTime: '',
          reason: '',
          symptoms: '',
          appointmentType: 'consultation',
          priority: 'normal'
        });
        handleBackToHospitals();
        setTimeout(() => setActiveTab('my-appointments'), 2000);
      } else {
        setError(data.message || 'Failed to request appointment');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptReschedule = async (appointmentId: string) => {
    setProcessingId(appointmentId);
    try {
      const response = await authService.client.post(
        `/appointments/${appointmentId}/accept-reschedule`
      );
      const data = response.data;
      if (data.success) {
        setSuccess('✅ Reschedule accepted! Appointment confirmed.');
        fetchMyAppointments();
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to accept reschedule');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineReschedule = async (appointmentId: string) => {
    setProcessingId(appointmentId);
    try {
      const response = await authService.client.post(
        `/appointments/${appointmentId}/decline-reschedule`
      );
      const data = response.data;
      if (data.success) {
        setSuccess('Reschedule declined. Appointment cancelled.');
        fetchMyAppointments();
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to decline reschedule');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    
    setProcessingId(appointmentId);
    try {
      const response = await authService.client.post(
        `/appointments/${appointmentId}/cancel`,
        { reason: 'Cancelled by patient' }
      );
      const data = response.data;
      if (data.success) {
        setSuccess('Appointment cancelled');
        fetchMyAppointments();
      } else {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel appointment');
    } finally {
      setProcessingId(null);
    }
  };

  // Get tomorrow's date as min date for booking
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  // Count appointments by status
  const pendingCount = appointments.filter(a => a.status === 'pending').length;
  const rescheduledCount = appointments.filter(a => a.status === 'rescheduled').length;
  const upcomingCount = appointments.filter(a => a.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          onClick={() => { setActiveTab('book'); handleBackToHospitals(); }}
          className={`px-6 py-3 font-medium ${
            activeTab === 'book'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📅 Book Appointment
        </button>
        <button
          onClick={() => { setActiveTab('my-appointments'); fetchMyAppointments(); }}
          className={`px-6 py-3 font-medium ${
            activeTab === 'my-appointments'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📋 My Appointments
          {(pendingCount + rescheduledCount) > 0 && (
            <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
              {pendingCount + rescheduledCount}
            </span>
          )}
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

      {/* Book Appointment Tab */}
      {activeTab === 'book' && (
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-6 text-sm">
            <button
              onClick={handleBackToHospitals}
              className={`px-3 py-1 rounded ${bookingStep === 'hospital' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              1. Select Hospital
            </button>
            <span className="text-gray-400">→</span>
            <button
              onClick={() => selectedHospital && setBookingStep('doctor')}
              disabled={!selectedHospital}
              className={`px-3 py-1 rounded ${bookingStep === 'doctor' ? 'bg-blue-100 text-blue-700' : selectedHospital ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
            >
              2. Select Doctor
            </button>
            <span className="text-gray-400">→</span>
            <button
              onClick={() => selectedDoctor && setBookingStep('form')}
              disabled={!selectedDoctor}
              className={`px-3 py-1 rounded ${bookingStep === 'form' ? 'bg-blue-100 text-blue-700' : selectedDoctor ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'}`}
            >
              3. Book Appointment
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step 1: Select Hospital */}
            {bookingStep === 'hospital' && (
              <div className="lg:col-span-2">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Hospital</h3>
                  
                  {loading ? (
                    <p className="text-center text-gray-500 py-8">Loading hospitals...</p>
                  ) : hospitals.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No hospitals available</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {hospitals.map((hospital) => (
                        <button
                          key={hospital.id}
                          onClick={() => handleSelectHospital(hospital)}
                          className="p-5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-left transition"
                        >
                          <div className="font-semibold text-gray-900 text-lg mb-2">{hospital.name}</div>
                          <div className="text-sm text-gray-600 mb-2">{hospital.type}</div>
                          {hospital.address && (
                            <div className="text-sm text-gray-500">
                              📍 {hospital.address.city}, {hospital.address.state}
                            </div>
                          )}
                          {hospital.is24HoursEmergency && (
                            <div className="text-xs text-green-600 mt-2">🚨 24/7 Emergency</div>
                          )}
                          {hospital.specialties && hospital.specialties.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {hospital.specialties.slice(0, 3).map((spec, idx) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                  {spec}
                                </span>
                              ))}
                              {hospital.specialties.length > 3 && (
                                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                                  +{hospital.specialties.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Select Doctor */}
            {bookingStep === 'doctor' && selectedHospital && (
              <div className="lg:col-span-2">
                <div className="bg-white p-6 rounded-lg shadow">
                  {/* Hospital Info */}
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-blue-900 text-lg">{selectedHospital.name}</h4>
                        <p className="text-sm text-blue-700">{selectedHospital.type}</p>
                        {selectedHospital.address && (
                          <p className="text-sm text-blue-600 mt-1">
                            📍 {selectedHospital.address.street}, {selectedHospital.address.city}, {selectedHospital.address.state}
                          </p>
                        )}
                        {selectedHospital.phone && (
                          <p className="text-sm text-blue-600">📞 {selectedHospital.phone}</p>
                        )}
                      </div>
                      <button
                        onClick={handleBackToHospitals}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        ← Change
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Doctor</h3>
                  
                  {/* Specialization Filter */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Specialization (Optional)
                    </label>
                    <select
                      value={specializationFilter}
                      onChange={(e) => setSpecializationFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">🔍 All Specializations</option>
                      <option value="General Medicine">General Medicine</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Dermatology">Dermatology</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="Neurology">Neurology</option>
                      <option value="Psychiatry">Psychiatry</option>
                      <option value="Gynecology">Gynecology</option>
                    </select>
                  </div>

                  {/* Doctor List */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {loadingDoctors ? (
                      <p className="text-center text-gray-500 py-8">Loading doctors...</p>
                    ) : doctors.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        {specializationFilter 
                          ? `No ${specializationFilter} doctors found at this hospital` 
                          : 'No doctors found at this hospital'}
                      </p>
                    ) : (
                      doctors.map((doctor) => (
                        <button
                          key={doctor.id}
                          onClick={() => handleSelectDoctor(doctor)}
                          className="w-full p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-left transition flex items-center justify-between"
                        >
                          <div className="flex items-baseline gap-3">
                            <span className="font-semibold text-gray-900 text-lg">{doctor.name}</span>
                            <span className="text-sm text-blue-600">• {doctor.specialization}</span>
                          </div>
                          {doctor.department && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {doctor.department}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Booking Form */}
            {bookingStep === 'form' && selectedDoctor && selectedHospital && (
              <div className="lg:col-span-2">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Appointment Details</h3>
                  
                  {/* Selected Doctor Info */}
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-blue-900">{selectedDoctor.name}</p>
                        <p className="text-sm text-blue-700">{selectedDoctor.specialization}</p>
                        <p className="text-sm text-blue-600">🏥 {selectedHospital.name}</p>
                      </div>
                      <button
                        onClick={handleBackToDoctors}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        ← Change
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleBookAppointment} className="space-y-4">
                    {/* Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preferred Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        min={minDate}
                        value={formData.requestedDate}
                        onChange={(e) => setFormData({...formData, requestedDate: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {/* Time */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preferred Time <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.requestedTime}
                        onChange={(e) => setFormData({...formData, requestedTime: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Select time slot</option>
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

                    {/* Appointment Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Appointment Type
                      </label>
                      <select
                        value={formData.appointmentType}
                        onChange={(e) => setFormData({...formData, appointmentType: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="consultation">🩺 Consultation</option>
                        <option value="follow_up">🔄 Follow-up Visit</option>
                        <option value="checkup">📋 General Check-up</option>
                        <option value="telemedicine">💻 Telemedicine (Online)</option>
                      </select>
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priority
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({...formData, priority: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="normal">🟢 Normal</option>
                        <option value="urgent">🟡 Urgent</option>
                        <option value="emergency">🔴 Emergency</option>
                      </select>
                    </div>

                    {/* Reason */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason for Visit <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={3}
                        maxLength={500}
                        placeholder="Briefly describe why you need this appointment..."
                        value={formData.reason}
                        onChange={(e) => setFormData({...formData, reason: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      />
                      <p className="text-xs text-gray-500 mt-1">{formData.reason.length}/500</p>
                    </div>

                    {/* Symptoms */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Symptoms (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., headache, fever, cough (comma-separated)"
                        value={formData.symptoms}
                        onChange={(e) => setFormData({...formData, symptoms: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleBackToDoctors}
                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
                      >
                        ← Back
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition"
                      >
                        {loading ? '⏳ Submitting...' : '📅 Request Appointment'}
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 text-center">
                      Your request will be sent to the doctor for approval.
                      You will be notified once the doctor responds.
                    </p>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* My Appointments Tab - (keep existing code, just truncate here for brevity) */}
      {activeTab === 'my-appointments' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-2xl font-bold text-yellow-800">{pendingCount}</p>
              <p className="text-sm text-yellow-600">⏳ Pending</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-2xl font-bold text-blue-800">{rescheduledCount}</p>
              <p className="text-sm text-blue-600">🔄 Needs Response</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-2xl font-bold text-green-800">{upcomingCount}</p>
              <p className="text-sm text-green-600">✅ Upcoming</p>
            </div>
          </div>

          {/* Rescheduled Appointments (Need Action) */}
          {rescheduledCount > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                🔄 Reschedule Proposals ({rescheduledCount})
              </h3>
              <div className="space-y-3">
                {appointments
                  .filter(apt => apt.status === 'rescheduled')
                  .map(apt => (
                    <div key={apt.id} className="bg-blue-50 p-5 rounded-lg border border-blue-200">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{apt.doctor.name}</h4>
                          <p className="text-sm text-gray-600">{apt.doctor.specialization}</p>
                        </div>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                          🔄 Rescheduled
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-gray-500">ORIGINAL REQUEST</p>
                          <p className="font-medium text-gray-700 line-through">
                            {new Date(apt.requestedDate).toLocaleDateString()} at {apt.requestedTime}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">PROPOSED NEW TIME</p>
                          <p className="font-semibold text-blue-700">
                            {apt.proposedDate && new Date(apt.proposedDate).toLocaleDateString()} at {apt.proposedTime}
                          </p>
                        </div>
                      </div>

                      {apt.doctorResponse && (
                        <div className="mb-3 p-3 bg-white rounded border">
                          <p className="text-sm text-gray-600">
                            <strong>Doctor's message:</strong> {apt.doctorResponse}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => handleAcceptReschedule(apt.id)}
                          disabled={processingId === apt.id}
                          className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400"
                        >
                          {processingId === apt.id ? '⏳' : '✅'} Accept New Time
                        </button>
                        <button
                          onClick={() => handleDeclineReschedule(apt.id)}
                          disabled={processingId === apt.id}
                          className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400"
                        >
                          {processingId === apt.id ? '⏳' : '❌'} Decline & Cancel
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* All Appointments List */}
          <h3 className="text-lg font-semibold text-gray-900 mb-3">All Appointments</h3>
          
          {appointments.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-4xl mb-4">📅</p>
              <p className="text-gray-600">No appointments yet</p>
              <button
                onClick={() => setActiveTab('book')}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Book Your First Appointment
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments
                .filter(apt => apt.status !== 'rescheduled')
                .map(apt => {
                  const badge = getStatusBadge(apt.status);
                  const isPast = new Date(apt.approvedDate || apt.requestedDate) < new Date();
                  const canCancel = ['pending', 'approved'].includes(apt.status) && !isPast;

                  return (
                    <div
                      key={apt.id}
                      className={`bg-white p-5 rounded-lg shadow border-l-4 ${
                        apt.status === 'approved' ? 'border-green-500' :
                        apt.status === 'pending' ? 'border-yellow-500' :
                        apt.status === 'rejected' ? 'border-red-500' :
                        'border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{apt.doctor.name}</h4>
                          <p className="text-sm text-gray-600">{apt.doctor.specialization}</p>
                          {apt.hospital && (
                            <p className="text-sm text-gray-500">🏥 {apt.hospital.name}</p>
                          )}
                        </div>
                        <span className={`px-3 py-1 ${badge.bg} ${badge.text} text-sm rounded-full`}>
                          {badge.icon} {badge.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                        <div>
                          <p className="text-xs text-gray-500">DATE</p>
                          <p className="font-medium">
                            {new Date(apt.approvedDate || apt.requestedDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">TIME</p>
                          <p className="font-medium">{apt.approvedTime || apt.requestedTime}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">TYPE</p>
                          <p className="font-medium">{getAppointmentTypeLabel(apt.appointmentType)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">APPOINTMENT #</p>
                          <p className="font-mono text-xs">{apt.appointmentNumber}</p>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-3">
                        <strong>Reason:</strong> {apt.reason}
                      </div>

                      {apt.status === 'rejected' && apt.doctorResponse && (
                        <div className="p-3 bg-red-50 rounded border border-red-200 text-sm mb-3">
                          <strong>Rejection reason:</strong> {apt.doctorResponse}
                        </div>
                      )}

                      {apt.status === 'approved' && apt.meetingLink && (
                        <div className="p-3 bg-blue-50 rounded border border-blue-200 text-sm mb-3">
                          <strong>Meeting Link:</strong>{' '}
                          <a href={apt.meetingLink} target="_blank" className="text-blue-600 hover:underline">
                            {apt.meetingLink}
                          </a>
                        </div>
                      )}

                      {canCancel && (
                        <button
                          onClick={() => handleCancelAppointment(apt.id)}
                          disabled={processingId === apt.id}
                          className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm"
                        >
                          {processingId === apt.id ? '⏳' : '🚫'} Cancel Appointment
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
