'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, User } from '@/services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  registerHospital: (data: any) => Promise<void>;
  registerDoctor: (data: any) => Promise<void>;
  requestOTP: (phone: string) => Promise<any>;
  verifyOTP: (phone: string, otp: string, isNewUser?: boolean, userData?: any) => Promise<void>;
  refreshUser: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = authService.getAccessToken();
        if (token && !authService.isTokenExpired()) {
          const userData = localStorage.getItem('user');
          if (userData) {
            setUser(JSON.parse(userData));
          }
        } else if (token) {
          authService.clearTokens();
        }
      } catch (err) {
        console.error('Auth init error:', err);
        authService.clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Re-read user from localStorage when dashboard layout refreshes it
    const onStorage = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        try { setUser(JSON.parse(userData)); } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      await authService.login(email, password);
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await authService.logout();
      setUser(null);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Logout failed';
      setError(message);
      throw err;
    }
  };

  const registerHospital = async (data: any) => {
    try {
      setError(null);
      setIsLoading(true);
      await authService.registerHospital(data);
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const registerDoctor = async (data: any) => {
    try {
      setError(null);
      setIsLoading(true);
      await authService.registerDoctor(data);
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const requestOTP = async (phone: string) => {
    try {
      setError(null);
      const response = await authService.requestOTP(phone);
      return response;
    } catch (err: any) {
      const message = err.response?.data?.message || 'OTP request failed';
      setError(message);
      throw err;
    }
  };

  const verifyOTP = async (phone: string, otp: string, isNewUser?: boolean, userData?: any) => {
    try {
      setError(null);
      setIsLoading(true);
      await authService.verifyOTP(phone, otp, isNewUser, userData);
      const userDataFromStorage = localStorage.getItem('user');
      if (userDataFromStorage) {
        setUser(JSON.parse(userDataFromStorage));
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'OTP verification failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      setError(null);
      await authService.getCurrentUser();
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Refresh failed';
      setError(message);
      throw err;
    }
  };

  const clearError = () => setError(null);

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    registerHospital,
    registerDoctor,
    requestOTP,
    verifyOTP,
    refreshUser,
    error,
    clearError
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
