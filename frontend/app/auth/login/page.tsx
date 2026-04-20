'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';

type UserType = 'patient' | 'doctor' | 'hospital' | null;
type Mode = 'login' | 'register';

function LoginPageContent() {
  const [userType, setUserType] = useState<UserType>(null);
  const [mode, setMode] = useState<Mode>('login');
  
  // Common fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Patient fields
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  
  // Doctor fields
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseState, setLicenseState] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [offersOnlineConsultation, setOffersOnlineConsultation] = useState(false);
  const [onlineConsultationFee, setOnlineConsultationFee] = useState('');
  
  // Hospital fields
  const [hospitalName, setHospitalName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [hospitalType, setHospitalType] = useState('');
  const [address, setAddress] = useState({ street: '', city: '', state: '', zipCode: '', country: '' });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // If redirected from dashboard guard with ?reason=unverified, show the wall
  useEffect(() => {
    if (searchParams.get('reason') === 'unverified') {
      const stored = sessionStorage.getItem('user');
      const storedEmail = stored ? JSON.parse(stored).email : '';
      if (storedEmail) setVerificationWall({ email: storedEmail });
    }
  }, [searchParams]);

  // ── Email verification wall ──────────────────────────────────────────────
  // When true, we show the "check your inbox" screen instead of the dashboard
  const [verificationWall, setVerificationWall] = useState<{ email: string } | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll every 4 seconds to detect when user clicks the link in their email
  useEffect(() => {
    if (!verificationWall) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await authService.getVerificationStatus();
        if (res.data?.data?.isEmailVerified) {
          clearInterval(pollRef.current!);
          // Redirect to the right dashboard
          const stored = sessionStorage.getItem('user');
          const role = stored ? JSON.parse(stored).role : null;
          router.push(getDashboardPath(role));
        }
      } catch { /* ignore */ }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [verificationWall, router]);

  const getDashboardPath = (role: string | null) => {
    if (role === 'doctor') return '/dashboard/doctor';
    if (role === 'hospital_admin') return '/dashboard/hospital';
    return '/dashboard/patient';
  };

  const handleResendEmail = async () => {
    setResending(true);
    setResendMsg('');
    try {
      await authService.resendVerificationEmail();
      setResendMsg('Email sent! Check your inbox (and spam folder).');
    } catch {
      setResendMsg('Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const fetchHospitals = async () => {
    try {
      const response = await authService.client.get('/auth/hospitals');
      if (response.data.success) {
        // API returns: { success: true, data: { count, hospitals: [...] } }
        const hospitalsData = response.data.data?.hospitals || [];
        setHospitals(Array.isArray(hospitalsData) ? hospitalsData : []);
      }
    } catch (err) {
      console.error('Failed to fetch hospitals:', err);
      setHospitals([]); // Set empty array on error
    }
  };

  const handleSelectUserType = (type: UserType) => {
    setUserType(type);
    setError('');
    setSuccess('');
    if (type === 'doctor' && mode === 'register') {
      fetchHospitals();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      const stored = sessionStorage.getItem('user');
      const role = stored ? JSON.parse(stored).role : null;
      router.push(getDashboardPath(role));
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.emailVerificationRequired) {
        // Show verification wall — tokens were NOT issued, user must verify first
        setVerificationWall({ email: data.email || email });
        return;
      }
      setError(data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      await authService.registerPatient({
        firstName, lastName, email, password,
        phone: phone || undefined,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined
      });
      setVerificationWall({ email });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDoctorRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !phone || !licenseNumber || !licenseState) {
      setError('All marked fields are required');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (!hospitalId) {
      setError('Please select a hospital');
      setIsLoading(false);
      return;
    }

    try {
      const doctorData = {
        firstName, 
        lastName, 
        email, 
        password, 
        phone,
        licenseNumber,
        licenseState,
        licenseExpiry: licenseExpiry || undefined,
        specializations: specialization ? [specialization] : [],
        hospitalId,
        offersOnlineConsultation,
        onlineConsultationFee: offersOnlineConsultation ? Number(onlineConsultationFee || 0) : 0
      };
      console.log('📤 Doctor registration data:', doctorData);
      await authService.registerDoctor(doctorData);
      setVerificationWall({ email });
    } catch (err: any) {
      const errorData = err.response?.data;
      console.error('❌ Registration error full:', errorData);
      
      let errorMessage = 'Registration failed';
      
      if (errorData?.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
        // Log all validation errors
        console.error('Validation errors:', errorData.errors);
        // Show all field errors
        errorMessage = errorData.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHospitalRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      await authService.registerHospital({
        hospitalName,
        registrationNumber,
        hospitalType: hospitalType || 'general',
        hospitalEmail: email,
        hospitalPhone: phone,
        address,
        adminFirstName: firstName,
        adminLastName: lastName,
        adminEmail: email,
        adminPassword: password
      });
      setVerificationWall({ email });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleColor = (type: UserType) => {
    switch (type) {
      case 'patient': return 'green';
      case 'doctor': return 'blue';
      case 'hospital': return 'purple';
      default: return 'gray';
    }
  };

  const getRoleIcon = (type: UserType) => {
    switch (type) {
      case 'patient': return '🏥';
      case 'doctor': return '👨‍⚕️';
      case 'hospital': return '🏨';
      default: return '';
    }
  };

  // Icons for password visibility
  const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.413 8.127 7.336 5 12 5c4.663 0 8.587 3.127 9.964 7.356.083.253.083.564 0 .817C20.587 15.873 16.663 19 12 19c-4.663 0-8.587-3.127-9.964-7.356Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );

  const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.388 4.235 5.312 7.5 9.966 7.5a10.45 10.45 0 0 0 4.144-.863m2.529-1.923A10.459 10.459 0 0 0 21.066 12c-1.388-4.235-5.312-7.5-9.966-7.5a10.45 10.45 0 0 0-4.144.863L3.98 8.223Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 12-3-3m-3 3 3 3m1.5-6L6.5 17.5" />
    </svg>
  );

  // ── Email Verification Wall ──────────────────────────────────────────────
  if (verificationWall) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your inbox</h2>
          <p className="text-gray-500 mb-1 text-sm">We sent a verification link to</p>
          <p className="font-semibold text-gray-800 mb-6 break-all">{verificationWall.email}</p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left text-sm text-amber-800">
            <p className="font-medium mb-1">Before you can access the dashboard:</p>
            <ol className="list-decimal list-inside space-y-1 text-amber-700">
              <li>Open the email from MedChain / Supabase</li>
              <li>Click the <span className="font-medium">Confirm your email</span> link</li>
              <li>This page will automatically redirect you</li>
            </ol>
          </div>

          {/* Resend */}
          <button
            onClick={handleResendEmail}
            disabled={resending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition-colors mb-3"
          >
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>

          {resendMsg && (
            <p className={`text-sm mb-3 ${resendMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
              {resendMsg}
            </p>
          )}

          <p className="text-xs text-gray-400">
            Waiting for verification
            <span className="inline-flex gap-0.5 ml-1">
              <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
            </span>
          </p>

          <button
            onClick={() => { setVerificationWall(null); setError(''); }}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  // Role Selection Screen
  if (!userType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <img src="/logo.png" alt="MedChain" className="h-16 w-16 object-contain" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">MedChain</h1>
              <p className="text-gray-600">Healthcare Management System</p>
            </div>

            <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
              I am a...
            </h2>

            <div className="space-y-4">
              <button
                onClick={() => handleSelectUserType('patient')}
                className="w-full p-4 border-2 border-green-200 hover:border-green-500 hover:bg-green-50 rounded-xl transition-all flex items-center gap-4"
              >
                <span className="text-4xl">🏥</span>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Patient</p>
                  <p className="text-sm text-gray-500">Book appointments & manage health records</p>
                </div>
              </button>

              <button
                onClick={() => handleSelectUserType('doctor')}
                className="w-full p-4 border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 rounded-xl transition-all flex items-center gap-4"
              >
                <span className="text-4xl">👨‍⚕️</span>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Doctor</p>
                  <p className="text-sm text-gray-500">Manage patients & appointments</p>
                </div>
              </button>

              <button
                onClick={() => handleSelectUserType('hospital')}
                className="w-full p-4 border-2 border-purple-200 hover:border-purple-500 hover:bg-purple-50 rounded-xl transition-all flex items-center gap-4"
              >
                <span className="text-4xl">🏨</span>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">Hospital Administrator</p>
                  <p className="text-sm text-gray-500">Manage hospital & staff</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const color = getRoleColor(userType);
  const colorClasses = {
    green: { bg: 'bg-green-600 hover:bg-green-700', light: 'bg-green-50', border: 'border-green-500', text: 'text-green-600', ring: 'focus:ring-green-500' },
    blue: { bg: 'bg-blue-600 hover:bg-blue-700', light: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-600', ring: 'focus:ring-blue-500' },
    purple: { bg: 'bg-purple-600 hover:bg-purple-700', light: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-600', ring: 'focus:ring-purple-500' },
    gray: { bg: 'bg-gray-600', light: 'bg-gray-50', border: 'border-gray-500', text: 'text-gray-600', ring: 'focus:ring-gray-500' }
  }[color];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-${color}-50 to-${color}-100 flex items-center justify-center p-4`}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Header with back button */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => { setUserType(null); setMode('login'); setError(''); setSuccess(''); }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← 
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {getRoleIcon(userType)} {userType === 'hospital' ? 'Hospital Admin' : userType.charAt(0).toUpperCase() + userType.slice(1)}
              </h1>
              <p className="text-sm text-gray-500">{mode === 'login' ? 'Login to continue' : 'Create your account'}</p>
            </div>
          </div>

          {/* Toggle Login/Register */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'login' ? `bg-white ${colorClasses.text} shadow` : 'text-gray-500'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { 
                setMode('register'); 
                setError(''); 
                setSuccess('');
                if (userType === 'doctor') fetchHospitals();
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'register' ? `bg-white ${colorClasses.text} shadow` : 'text-gray-500'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* LOGIN FORM - Same for all roles */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${colorClasses.ring} focus:border-transparent outline-none`}
                  placeholder="you@example.com"
                />
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${colorClasses.ring} focus:border-transparent outline-none pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full ${colorClasses.bg} disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-lg transition-colors`}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          )}

          {/* PATIENT REGISTER FORM */}
          {mode === 'register' && userType === 'patient' && (
            <form onSubmit={handlePatientRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select value={gender} onChange={e => setGender(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none">
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none pr-10" placeholder="Min. 8 characters" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none pr-10" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-lg">
                {isLoading ? 'Creating Account...' : 'Create Patient Account'}
              </button>
            </form>
          )}

          {/* DOCTOR REGISTER FORM */}
          {mode === 'register' && userType === 'doctor' && (
            <form onSubmit={handleDoctorRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medical License Number *</label>
                <input type="text" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License State/Province *</label>
                  <input type="text" value={licenseState} onChange={e => setLicenseState(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., CA" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry</label>
                  <input type="date" value={licenseExpiry} onChange={e => setLicenseExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                <input type="text" value={specialization} onChange={e => setSpecialization(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g., Cardiology" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Hospital *</label>
                <select value={hospitalId} onChange={e => setHospitalId(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Choose a hospital...</option>
                  {Array.isArray(hospitals) && hospitals.map((h: any) => (
                    <option key={h.id || h._id} value={h.id || h._id}>{h.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">You'll need hospital approval to practice</p>
              </div>

              {/* Online consultation */}
              <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offersOnlineConsultation}
                    onChange={e => setOffersOnlineConsultation(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">💻 I offer online consultations</span>
                </label>
                {offersOnlineConsultation && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Online Consultation Fee (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      value={onlineConsultationFee}
                      onChange={e => setOnlineConsultationFee(e.target.value)}
                      required={offersOnlineConsultation}
                      placeholder="e.g. 500"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Shown to patients when booking online appointments</p>
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-10" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-10" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-lg">
                {isLoading ? 'Submitting...' : 'Submit Application'}
              </button>
            </form>
          )}

          {/* HOSPITAL REGISTER FORM */}
          {mode === 'register' && userType === 'hospital' && (
            <form onSubmit={handleHospitalRegister} className="space-y-4">
              <div className="border-b pb-3 mb-3">
                <p className="text-sm font-medium text-gray-600">Hospital Information</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Name *</label>
                <input type="text" value={hospitalName} onChange={e => setHospitalName(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registration No. *</label>
                  <input type="text" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={hospitalType} onChange={e => setHospitalType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                    <option value="general">General</option>
                    <option value="specialty">Specialty</option>
                    <option value="clinic">Clinic</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                <input type="text" value={address.street} onChange={e => setAddress({...address, street: e.target.value})} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input type="text" value={address.city} onChange={e => setAddress({...address, city: e.target.value})} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <input type="text" value={address.state} onChange={e => setAddress({...address, state: e.target.value})} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="e.g. Maharashtra" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP / PIN Code *</label>
                  <input type="text" value={address.zipCode} onChange={e => setAddress({...address, zipCode: e.target.value})} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="400001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Phone *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="+91..." />
                </div>
              </div>
              
              <div className="border-b pb-3 mb-3 mt-4">
                <p className="text-sm font-medium text-gray-600">Admin Account</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none pr-10" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none pr-10" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-lg">
                {isLoading ? 'Registering...' : 'Register Hospital'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100" />}>
      <LoginPageContent />
    </Suspense>
  );
}
