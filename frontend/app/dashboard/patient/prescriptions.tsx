'use client';

import { useEffect, useState } from 'react';
import { authService } from '@/services/authService';

interface PrescriptionItem {
  id: string;
  verificationStatus?: 'VERIFIED' | 'TAMPERED';
  prescriptionNumber: string;
  doctorName: string;
  hospitalName: string;
  medicines: Array<{
    name: string;
    dosage: string;
    notes?: string;
  }>;
  notes: string;
  hash: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export default function PatientPrescriptionsComponent() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await authService.client.get('/prescriptions/patient');
      setPrescriptions((response.data?.data || []) as PrescriptionItem[]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  if (loading) {
    return <div className="text-gray-500">Loading prescriptions...</div>;
  }

  if (error) {
    return <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded">{error}</div>;
  }

  if (prescriptions.length === 0) {
    return <div className="text-gray-500">No prescriptions received yet.</div>;
  }

  return (
    <div className="space-y-4">
      {prescriptions.map((item) => (
        <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="font-semibold text-gray-900">{item.prescriptionNumber}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                Last Modified: {new Date(item.updatedAt || item.createdAt).toLocaleString()}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 capitalize">{item.status}</span>
              <span className={`text-xs px-2 py-1 rounded font-semibold ${
                item.verificationStatus === 'VERIFIED'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {item.verificationStatus || 'TAMPERED'}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-700">Doctor: {item.doctorName}</p>
          <p className="text-sm text-gray-700">Hospital: {item.hospitalName}</p>
          <div className="text-sm text-gray-700">
            Medicines:
            <ul className="list-disc list-inside">
              {item.medicines.map((medicine, idx) => (
                <li key={idx}>
                  {medicine.name} | Dosage: {medicine.dosage}{medicine.notes ? ` | Notes: ${medicine.notes}` : ''}
                </li>
              ))}
            </ul>
          </div>
          {item.notes && <p className="text-sm text-gray-700">Notes: {item.notes}</p>}

          <div className="mt-2 text-xs text-gray-500">
            <p>Issued: {new Date(item.createdAt).toLocaleString()}</p>
            <p>Integrity Hash: {item.hash}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
