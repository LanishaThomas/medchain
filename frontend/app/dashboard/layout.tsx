'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { authService } from '@/services/authService';

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tampered, setTampered] = useState(false);

  useEffect(() => {
    const guard = async () => {
      const token = authService.getAccessToken();
      if (!token || authService.isTokenExpired()) {
        router.replace('/auth/login');
        return;
      }

      // Fetch fresh user from backend — ensures firstName/lastName are in sessionStorage
      try {
        await authService.getCurrentUser();
        window.dispatchEvent(new Event('storage'));
      } catch {
        authService.clearTokens();
        router.replace('/auth/login');
        return;
      }

      // Check email verification — non-blocking, never redirect on error
      try {
        const res = await authService.getVerificationStatus();
        const data = res.data?.data;
        if (data?.supabaseLinked === true && data?.isEmailVerified === false) {
          authService.clearTokens();
          router.replace('/auth/login?reason=unverified');
          return;
        }
      } catch { /* allow through */ }

      // ── Blockchain tamper check on every dashboard load ────────────────
      try {
        const stored = sessionStorage.getItem('user');
        const userId = stored ? JSON.parse(stored).id : null;
        if (userId) {
          const res = await authService.verifyIntegrity('USER_PROFILE', userId);
          const status = res.data?.data?.verificationStatus;
          if (status === 'TAMPERED') setTampered(true);
        }
      } catch { /* non-fatal — blockchain may be slow */ }

      setReady(true);
    };

    guard();
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {tampered && (
        <div
          role="alert"
          className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-2.5 px-4 text-sm font-semibold shadow-lg"
        >
          🚨 BLOCKCHAIN INTEGRITY ALERT — Your profile data has been tampered with outside the system.
          The data no longer matches the immutable record on Polygon blockchain.
        </div>
      )}
      <div className={tampered ? 'pt-10' : ''}>
        <DashboardLayout>{children}</DashboardLayout>
      </div>
    </>
  );
}
