'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';

/**
 * Landing page after user clicks the Supabase confirmation link.
 * Syncs verification status then redirects to the correct dashboard.
 */
export default function EmailVerifiedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'verified' | 'error'>('checking');

  useEffect(() => {
    const sync = async () => {
      try {
        // Give Supabase a moment to process the confirmation
        await new Promise(r => setTimeout(r, 1500));

        const token = authService.getAccessToken();
        if (!token) {
          // Not logged in — just show success and send to login
          setStatus('verified');
          setTimeout(() => router.replace('/auth/login'), 2500);
          return;
        }

        const res = await authService.getVerificationStatus();
        const verified = res.data?.data?.isEmailVerified;

        if (verified) {
          setStatus('verified');
          const stored = localStorage.getItem('user');
          const role = stored ? JSON.parse(stored).role : null;
          const path =
            role === 'doctor' ? '/dashboard/doctor' :
            role === 'hospital_admin' ? '/dashboard/hospital' :
            '/dashboard/patient';
          setTimeout(() => router.replace(path), 2000);
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };

    sync();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
        {status === 'checking' && (
          <>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verifying your email...</h2>
            <p className="text-gray-500 text-sm">Just a moment</p>
          </>
        )}

        {status === 'verified' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Email verified!</h2>
            <p className="text-gray-500 text-sm">Redirecting you to your dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verification issue</h2>
            <p className="text-gray-500 text-sm mb-4">
              The link may have expired. Please request a new one.
            </p>
            <button
              onClick={() => router.replace('/auth/login')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
            >
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
