'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { authService } from '@/services/authService';

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const guard = async () => {
      const token = authService.getAccessToken();
      if (!token || authService.isTokenExpired()) {
        router.replace('/auth/login');
        return;
      }

      // Fetch fresh user from backend — ensures firstName/lastName are in localStorage
      try {
        await authService.getCurrentUser();
        // Notify AuthContext to re-read from localStorage
        window.dispatchEvent(new Event('storage'));
      } catch {
        // token invalid — clear and redirect
        authService.clearTokens();
        router.replace('/auth/login');
        return;
      }

      // Check email verification
      try {
        const res = await authService.getVerificationStatus();
        const { isEmailVerified } = res.data?.data ?? {};
        if (isEmailVerified === false) {
          // Only block if we got a definitive false — not on error/timeout
          authService.clearTokens();
          router.replace('/auth/login?reason=unverified');
          return;
        }
      } catch {
        // Verification check failed (network/Supabase down) — allow through
        console.warn('[DashboardGuard] Verification check failed, allowing through');
      }

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

  return <DashboardLayout>{children}</DashboardLayout>;
}
