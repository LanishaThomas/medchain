'use client';

import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

interface VerificationStatus {
  isEmailVerified: boolean;
  supabaseLinked: boolean;
  email: string;
}

export default function EmailVerificationBanner() {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    authService.getVerificationStatus()
      .then(res => setStatus(res.data?.data))
      .catch(() => {/* silently ignore — banner is non-critical */});
  }, []);

  // Don't render if verified, not linked to Supabase, or status unknown
  if (!status || status.isEmailVerified || !status.supabaseLinked) return null;

  const handleResend = async () => {
    setResending(true);
    setResendMessage('');
    try {
      await authService.resendVerificationEmail();
      setResendMessage('Verification email sent. Please check your inbox.');
    } catch {
      setResendMessage('Failed to resend. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-300 text-amber-800 px-4 py-3 rounded-lg text-sm"
    >
      <span>
        Please verify your email address <strong>{status.email}</strong> to unlock full access.
      </span>
      <div className="flex items-center gap-3 shrink-0">
        {resendMessage && <span className="text-xs">{resendMessage}</span>}
        <button
          onClick={handleResend}
          disabled={resending}
          className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
        >
          {resending ? 'Sending...' : 'Resend Email'}
        </button>
      </div>
    </div>
  );
}
