import api from '../app/api';

// TypeScript Interfaces
export interface DoctorStats {
  todayAppointments: number;
  totalPatients: number;
  activePrescriptions: number;
  pendingRecords: number;
}

export interface PatientAccess {
  _id: string;
  patient: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dateOfBirth?: string;
  };
  hospital?: {
    _id: string;
    name: string;
  };
  accessLevel: string;
  grantedDate: Date;
  status: string;
}

export interface Appointment {
  _id: string;
  patient: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  doctor: string;
  hospital?: {
    _id: string;
    name: string;
    address?: string;
  };
  appointmentDate: Date;
  appointmentTime: string;
  duration: number;
  type: 'in-person' | 'video' | 'phone';
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  reason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicalRecord {
  _id: string;
  patient: string;
  type: string;
  title: string;
  description?: string;
  doctor?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  hospital?: {
    _id: string;
    name: string;
  };
  fileUrl?: string;
  status: string;
  onChain: boolean;
  blockchainHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Diagnosis {
  _id: string;
  patient: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  doctor: string;
  hospital?: {
    _id: string;
    name: string;
  };
  chiefComplaint: string;
  symptoms: Array<{
    symptom: string;
    severity: 'mild' | 'moderate' | 'severe';
    duration: string;
  }>;
  primaryDiagnosis: string;
  secondaryDiagnoses?: string[];
  treatmentPlan: string;
  medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  followUpRequired: boolean;
  followUpDate?: Date;
  status: 'active' | 'resolved' | 'ongoing' | 'referred';
  createdAt: Date;
  updatedAt: Date;
}

export interface Prescription {
  _id: string;
  patient: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  doctor: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  refills: number;
  refillsUsed: number;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'cancelled' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

export const doctorService = {
  // Dashboard Stats
  async getDashboardStats(): Promise<{ success: boolean; data: DoctorStats }> {
    const response = await api.get('/doctors/stats');
    return response.data;
  },

  // Patients
  async getMyPatients(status = 'active'): Promise<{ success: boolean; count: number; data: PatientAccess[] }> {
    const response = await api.get('/doctors/patients', {
      params: { status },
    });
    return response.data;
  },

  async getPatientRecords(patientId: string): Promise<{ success: boolean; count: number; data: MedicalRecord[] }> {
    const response = await api.get(`/doctors/records/${patientId}`);
    return response.data;
  },

  // Appointments
  async getMyAppointments(filters?: { status?: string; date?: string }): Promise<{ success: boolean; count: number; data: Appointment[] }> {
    const response = await api.get('/doctors/appointments', {
      params: filters,
    });
    return response.data;
  },

  async updateAppointment(id: string, data: { status?: string; notes?: string }): Promise<{ success: boolean; message: string; data: Appointment }> {
    const response = await api.put(`/doctors/appointments/${id}`, data);
    return response.data;
  },

  // Diagnoses
  async getMyDiagnoses(filters?: { patientId?: string; status?: string }): Promise<{ success: boolean; count: number; data: Diagnosis[] }> {
    const response = await api.get('/doctors/diagnoses', {
      params: filters,
    });
    return response.data;
  },

  async createDiagnosis(data: Partial<Diagnosis>): Promise<{ success: boolean; message: string; data: Diagnosis }> {
    const response = await api.post('/doctors/diagnoses', data);
    return response.data;
  },

  // Prescriptions
  async getMyPrescriptions(filters?: { patientId?: string; status?: string }): Promise<{ success: boolean; count: number; data: Prescription[] }> {
    const response = await api.get('/doctors/prescriptions', {
      params: filters,
    });
    return response.data;
  },

  async createPrescription(data: Partial<Prescription>): Promise<{ success: boolean; message: string; data: Prescription }> {
    const response = await api.post('/doctors/prescriptions', data);
    return response.data;
  },

  // Medical Records
  async uploadRecord(data: Partial<MedicalRecord>): Promise<{ success: boolean; message: string; data: MedicalRecord }> {
    const response = await api.post('/doctors/records', data);
    return response.data;
  },

  // Profile
  async getProfile(): Promise<{ success: boolean; data: any }> {
    const response = await api.get('/doctors/profile');
    return response.data;
  },

  async updateProfile(data: any): Promise<{ success: boolean; message: string; data: any }> {
    const response = await api.put('/doctors/profile', data);
    return response.data;
  },
};
