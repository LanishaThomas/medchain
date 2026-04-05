import api from '../app/api';

// TypeScript Interfaces
export interface HospitalStats {
  totalDoctors: number;
  totalStaff: number;
  totalDepartments: number;
  todayAppointments: number;
}

export interface Doctor {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  specialization?: string;
  qualifications?: string[];
  experience?: number;
  verificationStatus: string;
  department?: {
    _id: string;
    name: string;
  };
  createdAt: Date;
}

export interface Staff {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department?: {
    _id: string;
    name: string;
  };
  createdAt: Date;
}

export interface Department {
  _id: string;
  hospital: string;
  name: string;
  description?: string;
  departmentHead?: {
    _id: string;
    firstName: string;
    lastName: string;
    specialization?: string;
  };
  doctors: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    specialization?: string;
  }>;
  specializations?: string[];
  status: string;
  createdAt: Date;
}

export interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  createdAt: Date;
}

export interface MedicalRecord {
  _id: string;
  patient: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  doctor?: {
    _id: string;
    firstName: string;
    lastName: string;
    specialization?: string;
  };
  type: string;
  title: string;
  description?: string;
  fileUrl?: string;
  status: string;
  createdAt: Date;
}

export const hospitalService = {
  // Dashboard Stats
  async getDashboardStats(): Promise<{ success: boolean; data: HospitalStats }> {
    const response = await api.get('/hospitals/stats');
    return response.data;
  },

  // Doctors
  async getDoctors(filters?: { status?: string; department?: string }): Promise<{ success: boolean; count: number; data: Doctor[] }> {
    const response = await api.get('/hospitals/doctors', {
      params: filters,
    });
    return response.data;
  },

  async addDoctor(userId: string): Promise<{ success: boolean; message: string; data: Doctor }> {
    const response = await api.post('/hospitals/doctors', { userId });
    return response.data;
  },

  async verifyDoctor(id: string): Promise<{ success: boolean; message: string; data: Doctor }> {
    const response = await api.put(`/hospitals/doctors/${id}/verify`);
    return response.data;
  },

  // Staff
  async getStaff(filters?: { role?: string; department?: string }): Promise<{ success: boolean; count: number; data: Staff[] }> {
    const response = await api.get('/hospitals/staff', {
      params: filters,
    });
    return response.data;
  },

  // Patients
  async getPatients(): Promise<{ success: boolean; count: number; data: Patient[] }> {
    const response = await api.get('/hospitals/patients');
    return response.data;
  },

  // Departments
  async getDepartments(): Promise<{ success: boolean; count: number; data: Department[] }> {
    const response = await api.get('/hospitals/departments');
    return response.data;
  },

  async createDepartment(data: Partial<Department>): Promise<{ success: boolean; message: string; data: Department }> {
    const response = await api.post('/hospitals/departments', data);
    return response.data;
  },

  async updateDepartment(id: string, data: Partial<Department>): Promise<{ success: boolean; message: string; data: Department }> {
    const response = await api.put(`/hospitals/departments/${id}`, data);
    return response.data;
  },

  // Records & Reports
  async getRecords(filters?: { patientId?: string; doctorId?: string; type?: string }): Promise<{ success: boolean; count: number; data: MedicalRecord[] }> {
    const response = await api.get('/hospitals/records', {
      params: filters,
    });
    return response.data;
  },

  async uploadReport(data: Partial<MedicalRecord>): Promise<{ success: boolean; message: string; data: MedicalRecord }> {
    const response = await api.post('/hospitals/records', data);
    return response.data;
  },

  // Profile & Settings
  async getProfile(): Promise<{ success: boolean; data: any }> {
    const response = await api.get('/hospitals/profile');
    return response.data;
  },

  async updateSettings(data: any): Promise<{ success: boolean; message: string; data: any }> {
    const response = await api.put('/hospitals/settings', data);
    return response.data;
  },
};
