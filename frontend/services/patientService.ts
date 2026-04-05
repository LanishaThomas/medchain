import api from '../app/api';

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
  status: 'new' | 'viewed' | 'archived';
  onChain: boolean;
  blockchainHash?: string;
  sharedWith: Array<{
    user: string;
    accessLevel: 'view' | 'edit';
    grantedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Appointment {
  _id: string;
  patient: string;
  doctor: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  hospital?: {
    _id: string;
    name: string;
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

export interface Prescription {
  _id: string;
  patient: string;
  doctor: {
    _id: string;
    firstName: string;
    lastName: string;
  };
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
  onChain: boolean;
  blockchainHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessControl {
  _id: string;
  patient: string;
  grantedTo: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  grantedToType: 'doctor' | 'hospital_admin' | 'caregiver';
  hospital?: {
    _id: string;
    name: string;
  };
  accessLevel: 'full' | 'partial' | 'emergency' | 'limited';
  specificRecords?: string[];
  grantedDate: Date;
  expiryDate?: Date;
  status: 'pending' | 'active' | 'revoked' | 'expired';
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaregiverData {
  _id: string;
  patient: string;
  caregiver: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  relationship: string;
  accessLevel: 'full' | 'medical' | 'limited';
  status: 'pending' | 'active' | 'revoked';
  permissions: {
    viewRecords: boolean;
    scheduleAppointments: boolean;
    manageMedications: boolean;
    emergencyAccess: boolean;
  };
  addedDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  totalRecords: number;
  upcomingAppointments: number;
  activePrescriptions: number;
  caregivers: number;
}

export const patientService = {
  // Dashboard stats
  async getDashboardStats(): Promise<{ success: boolean; data: DashboardStats }> {
    const response = await api.get('/patients/stats');
    return response.data;
  },

  // Medical Records
  async getMyRecords(): Promise<{ success: boolean; count: number; data: MedicalRecord[] }> {
    const response = await api.get('/patients/records');
    return response.data;
  },

  // Appointments
  async getMyAppointments(status?: string): Promise<{ success: boolean; count: number; data: Appointment[] }> {
    const response = await api.get('/patients/appointments', {
      params: { status },
    });
    return response.data;
  },

  async createAppointment(data: Partial<Appointment>): Promise<{ success: boolean; message: string; data: Appointment }> {
    const response = await api.post('/patients/appointments', data);
    return response.data;
  },

  // Prescriptions
  async getMyPrescriptions(status?: string): Promise<{ success: boolean; count: number; data: Prescription[] }> {
    const response = await api.get('/patients/prescriptions', {
      params: { status },
    });
    return response.data;
  },

  // Access Control
  async getAccessControl(): Promise<{ success: boolean; count: number; data: AccessControl[] }> {
    const response = await api.get('/patients/access');
    return response.data;
  },

  async grantAccess(data: Partial<AccessControl>): Promise<{ success: boolean; message: string; data: AccessControl }> {
    const response = await api.post('/patients/access', data);
    return response.data;
  },

  async revokeAccess(id: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const response = await api.put(`/patients/access/${id}/revoke`, { reason });
    return response.data;
  },

  // Caregivers
  async getCaregivers(): Promise<{ success: boolean; count: number; data: CaregiverData[] }> {
    const response = await api.get('/patients/caregivers');
    return response.data;
  },

  async addCaregiver(data: Partial<CaregiverData>): Promise<{ success: boolean; message: string; data: CaregiverData }> {
    const response = await api.post('/patients/caregivers', data);
    return response.data;
  },

  async removeCaregiver(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/patients/caregivers/${id}`);
    return response.data;
  },
};
