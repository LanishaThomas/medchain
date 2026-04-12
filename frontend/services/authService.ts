import axios, { AxiosInstance } from 'axios';
import { jwtDecode } from 'jwt-decode';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface User {
  id: string;
  email?: string;
  phone?: string;
  fullName: string;
  firstName: string;
  lastName: string;
  role: 'patient' | 'doctor' | 'caregiver' | 'hospital_admin';
  hospitals?: any[];
  hospital?: any;
}

class AuthService {
  public client: AxiosInstance;  // Make public so components can use it
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Initialize auth header if token exists
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        console.log('✅ Token found on init:', token.substring(0, 20) + '...');
        this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
      } else {
        console.warn('⚠️ No token found on init');
      }
    }

    // Request interceptor to add token to all requests
    this.client.interceptors.request.use(
      config => {
        const token = this.getAccessToken();
        
        // CRITICAL: If sending FormData, delete Content-Type header
        // Let axios/browser set it automatically with boundary
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type'];
        }
        
        console.log('📤 Request interceptor:', {
          url: config.url,
          hasToken: !!token,
          tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
          isFormData: config.data instanceof FormData,
          contentType: config.headers['Content-Type']
        });
        
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      error => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      response => response,
      error => this.handleResponseError(error)
    );
  }

  private handleResponseError = async (error: any) => {
    const originalRequest = error.config;

    // Don't attempt token refresh for auth endpoints — they don't need a token
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (this.isRefreshing) {
        return new Promise((resolve, reject) => {
          this.failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.client(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      this.isRefreshing = true;

      try {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const response = await this.client.post('/auth/refresh', { refreshToken });
        const { tokens } = response.data.data;

        this.setTokens(tokens);
        this.failedQueue.forEach(prom => prom.resolve(tokens.accessToken));
        this.failedQueue = [];

        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return this.client(originalRequest);
      } catch (err) {
        this.failedQueue.forEach(prom => prom.reject(err));
        this.failedQueue = [];
        this.clearTokens();
        window.location.href = '/auth/login';
        return Promise.reject(err);
      } finally {
        this.isRefreshing = false;
      }
    }

    return Promise.reject(error);
  };

  private getAuthHeader() {
    const token = this.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Token Management
  setTokens(tokens: Tokens) {
    console.log('🔑 Setting tokens...', {
      accessToken: tokens.accessToken.substring(0, 20) + '...',
      expiresAt: tokens.expiresAt
    });
    
    // Decode and log the token payload
    try {
      const decoded = jwtDecode(tokens.accessToken) as any;
      console.log('📋 Token decoded:', {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        exp: decoded.exp
      });
    } catch (e) {
      console.error('❌ Failed to decode token:', e);
    }
    
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('tokenExpiry', tokens.expiresAt);
    this.updateAuthHeader();
  }

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  }

  isTokenExpired(): boolean {
    const expiry = localStorage.getItem('tokenExpiry');
    if (!expiry) return true;
    return new Date() >= new Date(expiry);
  }

  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('user');
    this.updateAuthHeader();
  }

  private updateAuthHeader() {
    const token = this.getAccessToken();
    if (token) {
      this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common.Authorization;
    }
  }

  // Auth Endpoints

  async registerHospital(data: any) {
    const response = await this.client.post('/auth/hospital/register', data);
    const { tokens, admin, hospital } = response.data.data;
    console.log('✅ Hospital registered. Admin object:', admin);
    this.clearTokens();
    this.setTokens(tokens);
    localStorage.setItem('user', JSON.stringify({ ...admin, hospitalId: hospital.id }));
    return response.data;
  }

  async registerDoctor(data: any) {
    const response = await this.client.post('/auth/doctor/register', data);
    const { tokens, user } = response.data.data;
    console.log('✅ Doctor registered. User object:', user);
    // Clear any existing tokens before setting new ones
    this.clearTokens();
    this.setTokens(tokens);
    localStorage.setItem('user', JSON.stringify(user));
    return response.data;
  }

  async registerPatient(data: any) {
    const response = await this.client.post('/auth/patient/register', data);
    const { tokens, user } = response.data.data || response.data;
    console.log('✅ Patient registered. User object:', user);
    this.clearTokens();
    this.setTokens(tokens);
    localStorage.setItem('user', JSON.stringify(user));
    return response.data;
  }

  async requestOTP(phone: string) {
    const response = await this.client.post('/auth/patient/request-otp', { phone });
    return response.data.data;
  }

  async verifyOTP(phone: string, otp: string, isNewUser?: boolean, userData?: any) {
    const payload: any = { phone, otp };
    if (isNewUser && userData) {
      Object.assign(payload, userData);
    }
    const response = await this.client.post('/auth/patient/verify-otp', payload);
    const { tokens, user } = response.data.data;
    this.setTokens(tokens);
    localStorage.setItem('user', JSON.stringify(user));
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    const { tokens, user } = response.data.data;
    this.setTokens(tokens);
    localStorage.setItem('user', JSON.stringify(user));
    return response.data;
  }

  async logout(refreshToken?: string | null) {
    try {
      await this.client.post(
        '/auth/logout',
        { refreshToken: refreshToken || this.getRefreshToken() },
        { headers: this.getAuthHeader() }
      );
    } finally {
      this.clearTokens();
    }
  }

  async logoutAll() {
    try {
      await this.client.post('/auth/logout-all', {}, { headers: this.getAuthHeader() });
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me', { headers: this.getAuthHeader() });
    const user = response.data.data.user;
    localStorage.setItem('user', JSON.stringify(user));
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.client.post(
      '/auth/change-password',
      { currentPassword, newPassword },
      { headers: this.getAuthHeader() }
    );
  }

  async forgotPassword(email: string) {
    return this.client.post('/auth/forgot-password', { email });
  }

  async resetPassword(token: string, password: string) {
    return this.client.post('/auth/reset-password', { token, password });
  }

  async inviteCaregiver(data: any) {
    return this.client.post('/auth/caregiver/invite', data, {
      headers: this.getAuthHeader()
    });
  }

  async acceptCaregiverInvite(inviteToken: string, password: string, phone?: string) {
    const payload: any = { inviteToken, password };
    if (phone) payload.phone = phone;
    const response = await this.client.post('/auth/caregiver/accept', payload);
    const { tokens, user } = response.data.data;
    this.setTokens(tokens);
    localStorage.setItem('user', JSON.stringify(user));
    return response.data;
  }

  // Hospital Endpoints

  async getPendingApplications() {
    return this.client.get('/hospital/applications/pending', {
      headers: this.getAuthHeader()
    });
  }

  async getAllApplications(status?: string, page?: number) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (page) params.append('page', page.toString());

    return this.client.get(`/hospital/applications?${params.toString()}`, {
      headers: this.getAuthHeader()
    });
  }

  async approveDoctorApplication(applicationId: string, data: any) {
    return this.client.post(`/hospital/applications/${applicationId}/approve`, data, {
      headers: this.getAuthHeader()
    });
  }

  async rejectDoctorApplication(applicationId: string, reason: string) {
    return this.client.post(
      `/hospital/applications/${applicationId}/reject`,
      { reason },
      { headers: this.getAuthHeader() }
    );
  }

  async getHospitalDoctors(status?: string, page?: number) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (page) params.append('page', page.toString());

    return this.client.get(`/hospital/doctors?${params.toString()}`, {
      headers: this.getAuthHeader()
    });
  }

  async suspendDoctor(doctorId: string, reason: string) {
    return this.client.post(
      `/hospital/doctors/${doctorId}/suspend`,
      { reason },
      { headers: this.getAuthHeader() }
    );
  }

  async reactivateDoctor(doctorId: string, notes?: string) {
    return this.client.post(
      `/hospital/doctors/${doctorId}/reactivate`,
      { notes },
      { headers: this.getAuthHeader() }
    );
  }

  async getHospitalProfile() {
    return this.client.get('/hospital/profile', { headers: this.getAuthHeader() });
  }

  async updateHospitalProfile(data: any) {
    return this.client.put('/hospital/profile', data, { headers: this.getAuthHeader() });
  }

  // Doctor Endpoints

  async getDoctorApprovalStatus() {
    return this.client.get('/doctor/approval-status', { headers: this.getAuthHeader() });
  }

  async getDoctorHospitals() {
    return this.client.get('/doctor/hospitals', { headers: this.getAuthHeader() });
  }

  // Public endpoints

  async getHospitals() {
    return this.client.get('/auth/hospitals');
  }

  async getBlockchainLogs(params?: {
    entityType?: string;
    actionType?: string;
    actorId?: string;
    entityId?: string;
    page?: number;
    limit?: number;
  }) {
    return this.client.get('/blockchain/logs', {
      headers: this.getAuthHeader(),
      params
    });
  }

  async verifyIntegrity(entityType: string, entityId: string) {
    return this.client.get(`/blockchain/verify/${entityType}/${entityId}`, {
      headers: this.getAuthHeader()
    });
  }

  async verifyHistory(entityId: string) {
    return this.client.get(`/blockchain/verify-history/${entityId}`, {
      headers: this.getAuthHeader()
    });
  }
}

export const authService = new AuthService();
export const api = authService.client; // Export the axios client for direct API calls
export type { User, Tokens };
