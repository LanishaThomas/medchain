#!/usr/bin/env node

/**
 * Setup Frontend Auth Pages
 * Creates all necessary directories and files for auth flows
 */

const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'frontend', 'app');

// Create directories
const dirs = [
  'auth/login',
  'auth/register',
  'auth/patient-login',
  'auth/caregiver-accept',
  'dashboard/hospital',
  'dashboard/doctor',
  'dashboard/patient',
  'dashboard/caregiver'
];

console.log('Creating directories...\n');
dirs.forEach(dir => {
  const fullPath = path.join(baseDir, dir);
  try {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log('✓', dir);
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.error('✗', dir, ':', err.message);
    }
  }
});

// Create pages
const pages = [
  {
    path: 'auth/login/page.tsx',
    content: `'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">MedChain</h1>
            <p className="text-gray-600">For Doctors & Hospital Admins</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-3 text-gray-500 text-sm">OR</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          <div className="space-y-3">
            <Link href="/auth/patient-login" className="block w-full text-center bg-green-50 hover:bg-green-100 text-green-700 font-medium py-2 rounded-lg">
              Patient Login (OTP)
            </Link>
            <p className="text-center text-sm text-gray-600">
              New user? <Link href="/auth/register" className="text-indigo-600 font-medium">Register here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}`
  },
  {
    path: 'auth/patient-login/page.tsx',
    content: `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function PatientLoginPage() {
  const [step, setStep] = useState<'phone' | 'otp' | 'register'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { requestOTP, verifyOTP } = useAuth();
  const router = useRouter();

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await requestOTP(phone);
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to request OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isNewUser) {
        if (!firstName || !lastName) {
          setError('First name and last name are required');
          setIsLoading(false);
          return;
        }
        setStep('register');
        setIsLoading(false);
      } else {
        await verifyOTP(phone, otp, false);
        router.push('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'OTP verification failed');
      setIsLoading(false);
    }
  };

  const handleRegisterNewPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await verifyOTP(phone, otp, true, {
        firstName,
        lastName,
        email: email || undefined
      });
      router.push('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">MedChain</h1>
            <p className="text-gray-600">Patient Login</p>
          </div>

          {step === 'phone' && (
            <form onSubmit={handleRequestOTP} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="+1 (555) 000-0000"
                />
                <p className="text-xs text-gray-500 mt-1">Include country code</p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg"
              >
                {isLoading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600 mb-4">
                  OTP sent to <strong>{phone}</strong>
                </p>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                  Enter OTP
                </label>
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-center text-2xl tracking-widest"
                  placeholder="000000"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg"
              >
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                type="button"
                onClick={() => setStep('phone')}
                className="w-full text-green-600 font-medium py-2 hover:text-green-700"
              >
                Change Phone Number
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
              Not a patient? <Link href="/auth/login" className="text-indigo-600 font-medium">Doctor/Admin Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}`
  },
  {
    path: 'auth/register/page.tsx',
    content: `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterPage() {
  const [userType, setUserType] = useState<'hospital' | 'doctor' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { registerHospital, registerDoctor } = useAuth();
  const router = useRouter();

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
    specializations: [],
    yearsOfExperience: 0,
    hospitalId: ''
  });

  const handleHospitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await registerHospital(hospitalData);
      router.push('/dashboard/hospital');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
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
      setError(err.response?.data?.message || 'Registration failed');
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
              <p className="text-sm text-red-700">{error}</p>
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
                  <input
                    type="password"
                    placeholder="Password (min 8 chars) *"
                    value={hospitalData.adminPassword}
                    onChange={e => setHospitalData({...hospitalData, adminPassword: e.target.value})}
                    required
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
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
                <input
                  type="password"
                  placeholder="Password (min 8 chars) *"
                  value={doctorData.password}
                  onChange={e => setDoctorData({...doctorData, password: e.target.value})}
                  required
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="License Number *"
                  value={doctorData.licenseNumber}
                  onChange={e => setDoctorData({...doctorData, licenseNumber: e.target.value})}
                  required
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="License State *"
                  value={doctorData.licenseState}
                  onChange={e => setDoctorData({...doctorData, licenseState: e.target.value})}
                  required
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
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
}`
  }
];

console.log('\nCreating pages...\n');
pages.forEach(({ path: filePath, content }) => {
  const fullPath = path.join(baseDir, filePath);
  try {
    fs.writeFileSync(fullPath, content);
    console.log('✓', filePath);
  } catch (err) {
    console.error('✗', filePath, ':', err.message);
  }
});

console.log('\n✓ Frontend setup complete!');
console.log('\nNext steps:');
console.log('  1. cd frontend');
console.log('  2. npm run dev');
console.log('  3. Open http://localhost:3000');
