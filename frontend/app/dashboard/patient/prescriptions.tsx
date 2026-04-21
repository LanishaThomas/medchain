'use client';

import { useEffect, useState } from 'react';
import { authService } from '@/services/authService';

interface MedicineInfo {
  resolvedName: string;
  genericName: string;
  brandNames: string[];
  manufacturer: string | null;
  drugClass: string[];
  indicationsAndUsage: string | null;
  mechanismOfAction: string | null;
  adverseReactions: string | null;
  warnings: string | null;
  contraindications: string | null;
  source: string;
}

interface PrescriptionItem {
  id: string;
  verificationStatus?: 'VERIFIED' | 'TAMPERED';
  prescriptionNumber: string;
  doctorName: string;
  hospitalName: string;
  medicines: Array<{ name: string; dosage: string; notes?: string }>;
  notes: string;
  hash: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

function InfoSection({ title, content, accent }: { title: string; content: string | null; accent?: 'yellow' | 'red' }) {
  if (!content) return null;
  const bg = accent === 'red' ? 'bg-red-50 border-red-200' : accent === 'yellow' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200';
  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      <p className="text-xs font-semibold text-gray-700 mb-1">{title}</p>
      <p className="text-sm text-gray-700 leading-relaxed">{content}</p>
    </div>
  );
}

function MedicineInfoModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [info, setInfo] = useState<MedicineInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    authService.client
      .get(`/ai/medicine-info/${encodeURIComponent(name)}`)
      .then((res) => setInfo(res.data?.data || null))
      .catch((err: any) => setError(err.response?.data?.message || 'Could not load medicine information.'))
      .finally(() => setLoading(false));
  }, [name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">{name}</h2>
            {info && info.resolvedName.toLowerCase() !== name.toLowerCase() && (
              <p className="text-xs text-gray-500 mt-0.5">Resolved as: {info.resolvedName}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="p-4 space-y-3">
          {loading && <div className="text-center py-8 text-gray-500 text-sm">Looking up medicine information...</div>}
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}
          {info && (
            <>
              <div className="flex flex-wrap gap-2">
                {info.genericName && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">Generic: {info.genericName}</span>
                )}
                {info.drugClass.slice(0, 2).map((dc, i) => (
                  <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">{dc}</span>
                ))}
                {info.manufacturer && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{info.manufacturer}</span>
                )}
              </div>
              <InfoSection title="What it's used for" content={info.indicationsAndUsage} />
              <InfoSection title="How it works" content={info.mechanismOfAction} />
              <InfoSection title="Side effects" content={info.adverseReactions} accent="yellow" />
              <InfoSection title="Warnings" content={info.warnings} accent="red" />
              <InfoSection title="Do not use if" content={info.contraindications} accent="red" />
              <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">Source: {info.source}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientPrescriptionsComponent() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState<string | null>(null);

  useEffect(() => {
    authService.client
      .get('/prescriptions/patient')
      .then((res) => setPrescriptions((res.data?.data || []) as PrescriptionItem[]))
      .catch((err: any) => setError(err.response?.data?.message || 'Failed to load prescriptions'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Loading prescriptions...</div>;
  if (error) return <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded">{error}</div>;
  if (prescriptions.length === 0) return <div className="text-gray-500">No prescriptions received yet.</div>;

  return (
    <>
      {selectedMedicine && (
        <MedicineInfoModal name={selectedMedicine} onClose={() => setSelectedMedicine(null)} />
      )}

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
                {(item.verificationStatus || 'TAMPERED') === 'VERIFIED' ? (
                  <span className="text-xs px-2 py-1 rounded font-semibold bg-green-100 text-green-800">✅ Verified</span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded font-bold bg-red-600 text-white animate-pulse">🚨 TAMPERED</span>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-700">Doctor: {item.doctorName}</p>
            <p className="text-sm text-gray-700">Hospital: {item.hospitalName}</p>

            <div className="text-sm text-gray-700 mt-2">
              <p className="mb-1">Medicines:</p>
              <ul className="space-y-1">
                {item.medicines.map((medicine, idx) => (
                  <li key={idx} className="flex items-center gap-2 flex-wrap">
                    <span>
                      {medicine.name} | Dosage: {medicine.dosage}
                      {medicine.notes ? ` | Notes: ${medicine.notes}` : ''}
                    </span>
                    <button
                      onClick={() => setSelectedMedicine(medicine.name)}
                      title={`Learn about ${medicine.name}`}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors"
                    >
                      ℹ️ Info
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {item.notes && <p className="text-sm text-gray-700 mt-2">Notes: {item.notes}</p>}

            <div className="mt-2 text-xs text-gray-500">
              <p>Issued: {new Date(item.createdAt).toLocaleString()}</p>
              <p>Integrity Hash: {item.hash}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
