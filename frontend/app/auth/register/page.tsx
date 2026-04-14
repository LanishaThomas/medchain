'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';

interface Hospital {
  id: string;
  name: string;
  slug: string;
  type: string;
  email: string;
  phone: string;
  location: string;
  bedCount?: number;
  logo?: string;
}

export default function RegisterPage() {
  const [userType, setUserType] = useState<'hospital' | 'doctor' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const { registerHospital, registerDoctor } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const fetchHospitals = useCallback(async () => {
    try {
      setLoadingHospitals(true);
      const response = await authService.getHospitals();
      console.log('✅ Main endpoint response:', response);
      
      // Also test debug endpoint
      try {
        const debugResponse = await fetch('http://localhost:5000/api/auth/hospitals/debug')
          .then(r => r.json());
        console.log('📊 Debug endpoint response:', debugResponse);
      } catch (debugErr) {
        console.log('Debug endpoint error:', debugErr);
      }
      
      if (response.data.success) {
        console.log('📋 Hospitals data:', response.data.data.hospitals);
        setHospitals(response.data.data.hospitals);
      } else {
        console.error('❌ API returned unsuccessful:', response.data);
        setError('Failed to load hospitals. Please try again.');
      }
    } catch (err: any) {
      console.error('❌ Error fetching hospitals:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError(`Failed to load hospitals: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoadingHospitals(false);
    }
  }, []);

  // Fetch hospitals when doctor form is shown
  useEffect(() => {
    if (userType === 'doctor') {
      fetchHospitals();
    }
  }, [userType, fetchHospitals]);

  // Hospital form
  const [hospitalData, setHospitalData] = useState({
    hospitalName: '',
    registrationNumber: '',
    licenseNumber: '',
    hospitalType: 'general',
    hospitalEmail: '',
    hospitalPhone: '',
    address: { street: '', city: '', state: '', zipCode: '', country: 'USA' },
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPassword: '',
    adminPhone: ''
  });

  // Doctor form
  const [doctorData, setDoctorData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    licenseNumber: '',
    licenseState: '',
    licenseExpiry: '',
    specializations: [],
    yearsOfExperience: 0,
    bio: '',
    hospitalId: '',
    applicationNote: '',
    employmentType: 'full_time',
    department: ''
  });

  const handleHospitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await registerHospital(hospitalData);
      router.push('/dashboard/hospital');
    } catch (err: any) {
      // Handle validation errors from backend
      let errorMsg = 'Registration failed';
      
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const firstError = err.response.data.errors[0];
        errorMsg = `${firstError.field}: ${firstError.message}`;
        console.error('❌ Hospital registration validation failed:', err.response.data.errors);
      } else if (err.response?.data?.message) {
        errorMsg = String(err.response.data.message);
      } else if (err.response?.data?.error) {
        errorMsg = String(err.response.data.error);
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await registerDoctor(doctorData);
      router.push('/dashboard/doctor');
    } catch (err: any) {
      let errorMsg = 'Registration failed';
      
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const firstError = err.response.data.errors[0];
        errorMsg = `${firstError.field}: ${firstError.message}`;
        console.error('Doctor registration validation errors:', err.response.data.errors);
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      }
      
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!userType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="mb-8">
              <div className="flex justify-center mb-3">
                <img src="/logo.png" alt="MedChain" className="h-14 w-14 object-contain" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">MedChain</h1>
              <p className="text-gray-600">Register your account</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => setUserType('hospital')}
                className="p-6 border-2 border-gray-300 rounded-lg hover:border-indigo-600 hover:bg-indigo-50 transition text-center"
              >
                <div className="text-3xl mb-3">🏥</div>
                <h3 className="font-bold text-lg text-gray-900">Hospital</h3>
                <p className="text-sm text-gray-600 mt-2">Register your healthcare facility</p>
              </button>

              <button
                onClick={() => setUserType('doctor')}
                className="p-6 border-2 border-gray-300 rounded-lg hover:border-green-600 hover:bg-green-50 transition text-center"
              >
                <div className="text-3xl mb-3">👨‍⚕️</div>
                <h3 className="font-bold text-lg text-gray-900">Doctor</h3>
                <p className="text-sm text-gray-600 mt-2">Join a hospital and get approved</p>
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Already have an account? <Link href="/auth/login" className="text-indigo-600 font-medium">Login</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <button
            onClick={() => setUserType(null)}
            className="text-indigo-600 hover:text-indigo-700 font-medium mb-6"
          >
            ← Back to Selection
          </button>

          <h1 className="text-2xl font-bold text-gray-900 mb-8">
            {userType === 'hospital' ? 'Register Hospital' : 'Register as Doctor'}
          </h1>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <p className="text-sm text-red-700">
                {typeof error === 'string' ? error : (error?.message || JSON.stringify(error))}
              </p>
            </div>
          )}

          {userType === 'hospital' && (
            <form onSubmit={handleHospitalSubmit} className="space-y-6">
              {/* Hospital Information */}
              <div className="border-b pb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Hospital Information</h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Hospital Name *"
                    value={hospitalData.hospitalName}
                    onChange={e => setHospitalData({...hospitalData, hospitalName: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Registration Number *"
                    value={hospitalData.registrationNumber}
                    onChange={e => setHospitalData({...hospitalData, registrationNumber: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="License Number *"
                    value={hospitalData.licenseNumber}
                    onChange={e => setHospitalData({...hospitalData, licenseNumber: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <select
                    value={hospitalData.hospitalType}
                    onChange={e => setHospitalData({...hospitalData, hospitalType: e.target.value})}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="general">General</option>
                    <option value="specialty">Specialty</option>
                    <option value="teaching">Teaching</option>
                    <option value="clinic">Clinic</option>
                  </select>
                  <input
                    type="email"
                    placeholder="Hospital Email *"
                    value={hospitalData.hospitalEmail}
                    onChange={e => setHospitalData({...hospitalData, hospitalEmail: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="tel"
                    placeholder="Hospital Phone *"
                    value={hospitalData.hospitalPhone}
                    onChange={e => setHospitalData({...hospitalData, hospitalPhone: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Address */}
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <input
                    type="text"
                    placeholder="Street *"
                    value={hospitalData.address.street}
                    onChange={e => setHospitalData({...hospitalData, address: {...hospitalData.address, street: e.target.value}})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="City *"
                    value={hospitalData.address.city}
                    onChange={e => setHospitalData({...hospitalData, address: {...hospitalData.address, city: e.target.value}})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="State *"
                    value={hospitalData.address.state}
                    onChange={e => setHospitalData({...hospitalData, address: {...hospitalData.address, state: e.target.value}})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Zip Code *"
                    value={hospitalData.address.zipCode}
                    onChange={e => setHospitalData({...hospitalData, address: {...hospitalData.address, zipCode: e.target.value}})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Admin Information */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Account</h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="First Name *"
                    value={hospitalData.adminFirstName}
                    onChange={e => setHospitalData({...hospitalData, adminFirstName: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Last Name *"
                    value={hospitalData.adminLastName}
                    onChange={e => setHospitalData({...hospitalData, adminLastName: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Email *"
                    value={hospitalData.adminEmail}
                    onChange={e => setHospitalData({...hospitalData, adminEmail: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password (min 8 chars) *"
                      value={hospitalData.adminPassword}
                      onChange={e => setHospitalData({...hospitalData, adminPassword: e.target.value})}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.388 4.235 5.312 7.5 9.966 7.5a10.45 10.45 0 0 0 4.144-.863m2.529-1.923A10.459 10.459 0 0 0 21.066 12c-1.388-4.235-5.312-7.5-9.966-7.5a10.45 10.45 0 0 0-4.144.863L3.98 8.223Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="m15 12-3-3m-3 3 3 3m1.5-6L6.5 17.5" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.413 8.127 7.336 5 12 5c4.663 0 8.587 3.127 9.964 7.356.083.253.083.564 0 .817C20.587 15.873 16.663 19 12 19c-4.663 0-8.587-3.127-9.964-7.356Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={hospitalData.adminPhone}
                    onChange={e => setHospitalData({...hospitalData, adminPhone: e.target.value})}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none md:col-span-2"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition"
              >
                {isLoading ? 'Registering...' : 'Register Hospital'}
              </button>
            </form>
          )}

          {userType === 'doctor' && (
            <form onSubmit={handleDoctorSubmit} className="space-y-6">
              {/* Personal Information */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="First Name *"
                    value={doctorData.firstName}
                    onChange={e => setDoctorData({...doctorData, firstName: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Last Name *"
                    value={doctorData.lastName}
                    onChange={e => setDoctorData({...doctorData, lastName: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Email *"
                    value={doctorData.email}
                    onChange={e => setDoctorData({...doctorData, email: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password (min 8 chars) *"
                      value={doctorData.password}
                      onChange={e => setDoctorData({...doctorData, password: e.target.value})}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.388 4.235 5.312 7.5 9.966 7.5a10.45 10.45 0 0 0 4.144-.863m2.529-1.923A10.459 10.459 0 0 0 21.066 12c-1.388-4.235-5.312-7.5-9.966-7.5a10.45 10.45 0 0 0-4.144.863L3.98 8.223Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="m15 12-3-3m-3 3 3 3m1.5-6L6.5 17.5" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.413 8.127 7.336 5 12 5c4.663 0 8.587 3.127 9.964 7.356.083.253.083.564 0 .817C20.587 15.873 16.663 19 12 19c-4.663 0-8.587-3.127-9.964-7.356Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <input
                    type="tel"
                    placeholder="Phone (e.g., +11234567890)"
                    value={doctorData.phone}
                    onChange={e => setDoctorData({...doctorData, phone: e.target.value})}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Medical Credentials */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Medical Credentials</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Number *</label>
                    <input
                      type="text"
                      placeholder="e.g., MC12345 or 123456"
                      value={doctorData.licenseNumber}
                      onChange={e => setDoctorData({...doctorData, licenseNumber: e.target.value})}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Your medical/registration license number</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License State/Country *</label>
                    <input
                      type="text"
                      placeholder="e.g., Maharashtra, California, Texas"
                      value={doctorData.licenseState}
                      onChange={e => setDoctorData({...doctorData, licenseState: e.target.value})}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">State or country where license was issued</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry Date</label>
                    <input
                      type="date"
                      value={doctorData.licenseExpiry}
                      onChange={e => setDoctorData({...doctorData, licenseExpiry: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">When does your license expire? (optional)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={doctorData.yearsOfExperience}
                      onChange={e => setDoctorData({...doctorData, yearsOfExperience: parseInt(e.target.value) || 0})}
                      min="0"
                      max="70"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">How many years have you been practicing? (e.g., 5, 10, 15)</p>
                  </div>
                </div>

                {/* Specializations */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Specializations * (Select at least one)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {['Cardiology', 'Neurology', 'Oncology', 'Orthopedics', 'Pediatrics', 'Psychiatry', 'Surgery', 'Dermatology', 'ENT', 'Ophthalmology', 'Radiology', 'Pathology'].map(spec => (
                      <label key={spec} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={doctorData.specializations.includes(spec)}
                          onChange={e => {
                            if (e.target.checked) {
                              setDoctorData({
                                ...doctorData,
                                specializations: [...doctorData.specializations, spec]
                              });
                            } else {
                              setDoctorData({
                                ...doctorData,
                                specializations: doctorData.specializations.filter(s => s !== spec)
                              });
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{spec}</span>
                      </label>
                    ))}
                  </div>
                  {doctorData.specializations.length > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      Selected: {doctorData.specializations.join(', ')}
                    </p>
                  )}
                </div>

                {/* Bio */}
                <div className="mt-4">
                  <textarea
                    placeholder="Professional Bio (optional)"
                    value={doctorData.bio}
                    onChange={e => setDoctorData({...doctorData, bio: e.target.value})}
                    rows={3}
                    maxLength={1000}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">{doctorData.bio.length}/1000</p>
                </div>
              </div>

              {/* Employment Details */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Employment Details</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <select
                    value={doctorData.employmentType}
                    onChange={e => setDoctorData({...doctorData, employmentType: e.target.value})}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="full_time">Full-time</option>
                    <option value="part_time">Part-time</option>
                    <option value="visiting">Visiting</option>
                    <option value="consultant">Consultant</option>
                    <option value="resident">Resident</option>
                    <option value="intern">Intern</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Department (optional)"
                    value={doctorData.department}
                    onChange={e => setDoctorData({...doctorData, department: e.target.value})}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Hospital Selection */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Hospital Application</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Hospital *
                  </label>
                  {loadingHospitals ? (
                    <div className="px-4 py-3 border border-gray-300 rounded-lg text-gray-500">
                      Loading hospitals...
                    </div>
                  ) : hospitals.length === 0 ? (
                    <div className="px-4 py-3 border border-red-300 rounded-lg bg-red-50 text-red-700">
                      No hospitals found. Please try again later.
                    </div>
                  ) : (
                    <select
                      value={doctorData.hospitalId}
                      onChange={e => setDoctorData({...doctorData, hospitalId: e.target.value})}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">-- Select a hospital --</option>
                      {hospitals.map(hospital => (
                        <option key={hospital.id} value={hospital.id}>
                          {hospital.name} ({hospital.type}) - {hospital.location}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Choose the hospital you want to apply for</p>
                </div>

                {/* Hospital Details (if selected) */}
                {doctorData.hospitalId && (
                  (() => {
                    const selectedHospital = hospitals.find(h => h.id === doctorData.hospitalId);
                    return selectedHospital ? (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="font-semibold text-gray-900 mb-2">{selectedHospital.name}</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                          <p><strong>Type:</strong> <span className="capitalize">{selectedHospital.type}</span></p>
                          <p><strong>Location:</strong> {selectedHospital.location}</p>
                          <p><strong>Email:</strong> {selectedHospital.email}</p>
                          <p><strong>Phone:</strong> {selectedHospital.phone}</p>
                          {selectedHospital.bedCount && (
                            <p><strong>Beds:</strong> {selectedHospital.bedCount}</p>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()
                )}

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Application Note
                  </label>
                  <textarea
                    placeholder="Tell the hospital why you want to join (optional)"
                    value={doctorData.applicationNote}
                    onChange={e => setDoctorData({...doctorData, applicationNote: e.target.value})}
                    rows={3}
                    maxLength={1000}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">{doctorData.applicationNote.length}/1000</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || doctorData.specializations.length === 0 || !doctorData.hospitalId}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition"
              >
                {isLoading ? 'Registering...' : 'Register as Doctor'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}