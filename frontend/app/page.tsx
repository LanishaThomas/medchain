'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth/login');
      } else {
        // Redirect based on role
        switch (user.role) {
          case 'hospital_admin':
            router.push('/dashboard/hospital');
            break;
          case 'doctor':
            router.push('/dashboard/doctor');
            break;
          case 'patient':
            router.push('/dashboard/patient');
            break;
          case 'caregiver':
            router.push('/dashboard/caregiver');
            break;
          default:
            router.push('/auth/login');
        }
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}
