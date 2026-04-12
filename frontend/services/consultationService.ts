import { authService } from '@/services/authService';

interface JoinResponse {
  consultationId: string;
  roomId: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  startTime: string;
  token: string;
  provider: 'agora' | 'demo';
  appId?: string;
  rtcUid?: number;
  role: 'doctor' | 'patient';
  expiresAt: string;
  ttlSeconds: number;
}

interface ConsultationContext {
  consultation: {
    id: string;
    roomId: string;
    status: 'scheduled' | 'ongoing' | 'completed';
    startTime: string | null;
    endTime: string | null;
  } | null;
  appointment: {
    id: string;
    status: string;
    appointmentType: string;
    requestedDate: string;
    requestedTime: string;
    approvedDate?: string;
    approvedTime?: string;
    duration: number;
    hospital: {
      id: string;
      name: string;
    } | null;
    patient: {
      id: string;
      name: string;
      email?: string;
      phone?: string;
      dateOfBirth?: string;
      gender?: string;
    };
    doctor: {
      id: string;
      name: string;
      specialization?: string;
      email?: string;
    };
  };
  access: {
    medicalRecords: boolean;
    prescriptions: boolean;
  };
}

export const consultationService = {
  async getContext(appointmentId: string): Promise<ConsultationContext> {
    const response = await authService.client.get(`/consultations/${appointmentId}`);
    return response.data.data as ConsultationContext;
  },

  async joinAsDoctor(appointmentId: string): Promise<JoinResponse> {
    const response = await authService.client.post(`/consultations/${appointmentId}/doctor/join`);
    return response.data.data as JoinResponse;
  },

  async joinAsPatient(appointmentId: string): Promise<JoinResponse> {
    const response = await authService.client.post(`/consultations/${appointmentId}/patient/join`);
    return response.data.data as JoinResponse;
  },

  async endConsultation(appointmentId: string): Promise<void> {
    await authService.client.post(`/consultations/${appointmentId}/end`);
  },

  // Reuses existing permission API. Doctor requests access tied to this consultation session.
  async requestConsultationAccess(params: {
    patientId: string;
    appointmentId: string;
  }): Promise<void> {
    const expiryDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    try {
      await authService.client.post('/permissions/request-access', {
        patientId: params.patientId,
        accessType: 'full_access',
        expiryDate,
        reason: `Consultation session access for appointment ${params.appointmentId}`
      });
    } catch (error: any) {
      const message = error?.response?.data?.message || '';
      if (!message.toLowerCase().includes('already have')) {
        throw error;
      }
    }
  },

  // Reuses existing patient permission endpoints to approve the consultation request.
  async grantConsultationAccess(params: {
    doctorId: string;
    appointmentId: string;
  }): Promise<boolean> {
    const pending = await authService.client.get('/permissions/pending');
    const requests = pending?.data?.data?.requests || [];

    const request = requests.find((item: any) => {
      const doctorMatch = String(item.doctorId) === String(params.doctorId);
      const reasonText = String(item.requestReason || '').toLowerCase();
      const apptMatch = reasonText.includes(String(params.appointmentId).toLowerCase());
      return doctorMatch && apptMatch;
    });

    if (!request?.id) {
      return false;
    }

    await authService.client.post(`/permissions/${request.id}/approve`, {
      notes: 'Approved for active consultation session'
    });

    return true;
  }
};

export type { ConsultationContext, JoinResponse };
