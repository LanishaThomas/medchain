import { api } from './authService';

// TypeScript Interfaces
export interface CaregiverStats {
  totalPatients: number;
  upcomingAppointments: number;
  activeMedications: number;
}

export interface PatientRelation {
  _id: string;
  patient: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dateOfBirth?: string;
  };
  relationship: string;
  accessLevel: 'full' | 'medical' | 'limited';
  status: string;
  permissions: {
    viewRecords: boolean;
    scheduleAppointments: boolean;
    manageMedications: boolean;
    emergencyAccess: boolean;
  };
  addedDate: Date;
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
  hospital?: {
    _id: string;
    name: string;
  };
  type: string;
  title: string;
  description?: string;
  status: string;
  createdAt: Date;
}

export interface Appointment {
  _id: string;
  patient: string;
  doctor: {
    _id: string;
    firstName: string;
    lastName: string;
    specialization?: string;
  };
  hospital?: {
    _id: string;
    name: string;
    address?: string;
  };
  appointmentDate: Date;
  appointmentTime: string;
  type: string;
  status: string;
  notes?: string;
  createdAt: Date;
}

export interface Medication {
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
  instructions?: string;
  status: string;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
}

export const caregiverService = {
  // Dashboard Stats
  async getDashboardStats(): Promise<{ success: boolean; data: CaregiverStats }> {
    const response = await api.get('/caregivers/stats');
    return response.data;
  },

  // Patients
  async getMyPatients(): Promise<{ success: boolean; count: number; data: PatientRelation[] }> {
    const response = await api.get('/caregivers/patients');
    return response.data;
  },

  // Patient Records
  async getPatientRecords(patientId: string): Promise<{ success: boolean; count: number; data: MedicalRecord[] }> {
    const response = await api.get(`/caregivers/records/${patientId}`);
    return response.data;
  },

  // Patient Appointments
  async getPatientAppointments(patientId: string): Promise<{ success: boolean; count: number; data: Appointment[] }> {
    const response = await api.get(`/caregivers/appointments/${patientId}`);
    return response.data;
  },

  // Patient Medications
  async getPatientMedications(patientId: string): Promise<{ success: boolean; count: number; data: Medication[] }> {
    const response = await api.get(`/caregivers/medications/${patientId}`);
    return response.data;
  },

  // Emergency Info
  async getEmergencyInfo(patientId: string): Promise<{ success: boolean; data: { emergencyRecords: MedicalRecord[]; activePrescriptions: Medication[] } }> {
    const response = await api.get(`/caregivers/emergency/${patientId}`);
    return response.data;
  },

  // Schedule Appointment
  async scheduleAppointment(data: Partial<Appointment>): Promise<{ success: boolean; message: string; data: Appointment }> {
    const response = await api.post('/caregivers/appointments', data);
    return response.data;
  },

  // Profile
  async getProfile(): Promise<{ success: boolean; data: any }> {
    const response = await api.get('/caregivers/profile');
    return response.data;
  },
};
