'use client';

import { useEffect, useMemo, useState } from 'react';
import { authService } from '@/services/authService';

interface HospitalOption {
  id: string;
  name: string;
}

interface PatientOption {
  id: string;
  name: string;
  email?: string;
  accessType?: string;
}

interface MedicineEntry {
  name: string;
  dosage: string;
  notes: string;
}

interface PrescriptionItem {
  id: string;
  verificationStatus?: 'VERIFIED' | 'TAMPERED';
  prescriptionNumber: string;
  patientId: string;
  patientName: string;
  hospitalName: string;
  medicines: MedicineEntry[];
  notes: string;
  hash: string;
  createdAt: string;
  updatedAt?: string;
}

export default function DoctorPrescriptionsComponent() {
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);

  const [patientId, setPatientId] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [medicines, setMedicines] = useState<MedicineEntry[]>([{ name: '', dosage: '', notes: '' }]);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const parsedMedicines = useMemo(
    () => medicines
      .map((item) => ({ name: item.name.trim(), dosage: item.dosage.trim(), notes: item.notes.trim() }))
      .filter((item) => item.name || item.dosage || item.notes),
    [medicines]
  );

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      const [hospitalsRes, permissionsRes, prescriptionsRes] = await Promise.all([
        authService.getDoctorHospitals(),
        authService.client.get('/permissions/doctor/approved'),
        authService.client.get('/prescriptions/doctor')
      ]);

      const hospitalRows = (hospitalsRes.data?.data?.hospitals || []) as Array<{
        hospital?: { id?: string; name?: string };
      }>;

      const normalizedHospitals = hospitalRows
        .map((row) => ({
          id: row.hospital?.id || '',
          name: row.hospital?.name || ''
        }))
        .filter((item) => item.id && item.name);

      setHospitals(normalizedHospitals);
      if (normalizedHospitals.length > 0) {
        setHospitalId((prev) => prev || normalizedHospitals[0].id);
      }

      const permissionRows = (permissionsRes.data?.data?.permissions || []) as Array<{
        patient?: { _id?: string; firstName?: string; lastName?: string; email?: string };
        accessType?: string;
      }>;

      const patientMap = new Map<string, PatientOption>();
      permissionRows.forEach((row) => {
        const p = row.patient;
        const patientKey = p?._id;
        const canPrescribe = row.accessType === 'full_access' || row.accessType === 'prescriptions';
        if (patientKey && canPrescribe && !patientMap.has(patientKey)) {
          patientMap.set(patientKey, {
            id: patientKey,
            name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
            email: p.email,
            accessType: row.accessType
          });
        }
      });
      setPatients(Array.from(patientMap.values()));

      setPrescriptions((prescriptionsRes.data?.data || []) as PrescriptionItem[]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load prescription data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrescriptions = async () => {
    try {
      const response = await authService.client.get('/prescriptions/doctor');
      setPrescriptions((response.data?.data || []) as PrescriptionItem[]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to refresh prescriptions');
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!patientId || !hospitalId || parsedMedicines.length === 0) {
      setError('Select patient + hospital and provide medicines');
      return;
    }

    if (parsedMedicines.some((item) => !item.name || !item.dosage)) {
      setError('Each medicine row must include medicine name and dosage');
      return;
    }

    try {
      setSubmitting(true);
      const response = await authService.client.post('/prescriptions', {
        patientId,
        hospitalId,
        medicines: parsedMedicines,
        notes: notes.trim()
      });

      if (response.data?.success) {
        setSuccess('Prescription created and delivered to patient');
        setMedicines([{ name: '', dosage: '', notes: '' }]);
        setNotes('');
        await fetchPrescriptions();
      } else {
        setError(response.data?.message || 'Failed to create prescription');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create prescription');
    } finally {
      setSubmitting(false);
    }
  };

  const updateMedicine = (index: number, key: keyof MedicineEntry, value: string) => {
    setMedicines((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addMedicineRow = () => {
    setMedicines((prev) => [...prev, { name: '', dosage: '', notes: '' }]);
  };

  const removeMedicineRow = (index: number) => {
    setMedicines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded">{error}</div>}
      {success && <div className="p-3 bg-green-100 border border-green-200 text-green-700 rounded">{success}</div>}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Prescription</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              <option value="">Select patient</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}{patient.email ? ` - ${patient.email}` : ''}
                </option>
              ))}
            </select>
            {patients.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                No patients available. Patient must approve prescriptions/full access first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hospital</label>
            <select
              value={hospitalId}
              onChange={(e) => setHospitalId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            >
              <option value="">Select hospital</option>
              {hospitals.map((hospital) => (
                <option key={hospital.id} value={hospital.id}>
                  {hospital.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">Medicines</label>
              <button
                type="button"
                onClick={addMedicineRow}
                className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-100"
              >
                + Add Medicine
              </button>
            </div>

            {medicines.map((row, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
                <input
                  value={row.name}
                  onChange={(e) => updateMedicine(index, 'name', e.target.value)}
                  placeholder="Medicine name"
                  className="border border-gray-300 rounded-lg px-3 py-2"
                />
                <input
                  value={row.dosage}
                  onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                  placeholder="Dosage"
                  className="border border-gray-300 rounded-lg px-3 py-2"
                />
                <div className="flex gap-2">
                  <input
                    value={row.notes}
                    onChange={(e) => updateMedicine(index, 'notes', e.target.value)}
                    placeholder="Medicine notes"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedicineRow(index)}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                  >
                    -
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="7 days course"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Prescription'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Issued Prescriptions</h3>
          <span className="text-sm text-gray-500">{prescriptions.length} total</span>
        </div>

        {loading ? (
          <div className="p-6 text-gray-500">Loading...</div>
        ) : prescriptions.length === 0 ? (
          <div className="p-6 text-gray-500">No prescriptions yet.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {prescriptions.map((item) => (
              <div key={item.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="font-semibold text-gray-900">{item.prescriptionNumber}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">Last Modified: {new Date(item.updatedAt || item.createdAt).toLocaleString()}</p>
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${
                      item.verificationStatus === 'VERIFIED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {item.verificationStatus || 'TAMPERED'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-700">Patient: {item.patientName}</p>
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
                <p className="text-xs text-gray-500 mt-2">Integrity Hash: {item.hash}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
