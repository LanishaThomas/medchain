'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://medchain-x96u.onrender.com/api';

interface EmergencyData {
  patient: {
    name: string;
    dateOfBirth?: string;
    gender?: string;
    bloodType?: string;
    allergies: Array<{ allergen: string; severity?: string; reaction?: string }>;
    currentMedications: Array<{ name: string; dosage?: string; frequency?: string }>;
    previousSurgeries: Array<{ name: string; date?: string; hospital?: string }>;
    chronicConditions: string[];
    emergencyContacts: Array<{ name: string; relationship: string; phone: string; isPrimary?: boolean }>;
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
  };
  expiresAt: string;
  accessedAt: string;
}

function EmergencyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [data, setData] = useState<EmergencyData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('No emergency token provided.');
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/emergency/view?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setData(res.data);
        else setError(res.message || 'Failed to load emergency data');
      })
      .catch(() => setError('Network error. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={s.center}>
      <div style={s.spinner} />
      <p style={{ color: '#666', marginTop: 16 }}>Loading emergency data...</p>
    </div>
  );

  if (error) return (
    <div style={s.center}>
      <div style={s.errorCard}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚨</div>
        <h2 style={{ color: '#dc2626', marginBottom: 8 }}>Access Error</h2>
        <p style={{ color: '#555' }}>{error}</p>
      </div>
    </div>
  );

  if (!data) return null;

  const p = data.patient;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerInner}>
          <span style={{ fontSize: 32 }}>🚨</span>
          <div>
            <h1 style={s.headerTitle}>EMERGENCY MEDICAL INFORMATION</h1>
            <p style={s.headerSub}>MedChain · Verified Patient Data</p>
          </div>
        </div>
        <div style={s.expiry}>
          Expires: {new Date(data.expiresAt).toLocaleTimeString()}
        </div>
      </div>

      <div style={s.body}>
        {/* Patient identity */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>👤 Patient</h2>
          <div style={s.grid2}>
            <Row label="Name" value={p.name} />
            {p.dateOfBirth && <Row label="Date of Birth" value={new Date(p.dateOfBirth).toLocaleDateString()} />}
            {p.gender && <Row label="Gender" value={p.gender} />}
            <Row label="Blood Type" value={p.bloodType || 'Not recorded'} highlight={!!p.bloodType} />
          </div>
        </div>

        {/* Allergies */}
        {p.allergies.length > 0 && (
          <div style={{ ...s.card, borderLeft: '4px solid #dc2626' }}>
            <h2 style={s.cardTitle}>⚠️ Allergies</h2>
            {p.allergies.map((a, i) => (
              <div key={i} style={s.listItem}>
                <strong>{a.allergen}</strong>
                {a.severity && <span style={s.badge(a.severity)}>{a.severity}</span>}
                {a.reaction && <span style={{ color: '#555', fontSize: 13 }}> — {a.reaction}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Medications */}
        {p.currentMedications.length > 0 && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>💊 Current Medications</h2>
            {p.currentMedications.map((m, i) => (
              <div key={i} style={s.listItem}>
                <strong>{m.name}</strong>
                {m.dosage && <span style={{ color: '#555', fontSize: 13 }}> · {m.dosage}</span>}
                {m.frequency && <span style={{ color: '#888', fontSize: 13 }}> · {m.frequency}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Chronic Conditions */}
        {p.chronicConditions.length > 0 && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>🏥 Chronic Conditions</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {p.chronicConditions.map((c, i) => (
                <span key={i} style={s.tag}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Previous Surgeries */}
        {p.previousSurgeries.length > 0 && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>🔪 Previous Surgeries</h2>
            {p.previousSurgeries.map((sv, i) => (
              <div key={i} style={s.listItem}>
                <strong>{sv.name}</strong>
                {sv.date && <span style={{ color: '#555', fontSize: 13 }}> · {new Date(sv.date).toLocaleDateString()}</span>}
                {sv.hospital && <span style={{ color: '#888', fontSize: 13 }}> · {sv.hospital}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Emergency Contacts */}
        {p.emergencyContacts.length > 0 && (
          <div style={{ ...s.card, borderLeft: '4px solid #2563eb' }}>
            <h2 style={s.cardTitle}>📞 Emergency Contacts</h2>
            {p.emergencyContacts
              .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
              .map((c, i) => (
                <div key={i} style={s.listItem}>
                  <strong>{c.name}</strong>
                  <span style={{ color: '#555', fontSize: 13 }}> · {c.relationship}</span>
                  {c.isPrimary && <span style={{ ...s.tag, background: '#dbeafe', color: '#1d4ed8', marginLeft: 8 }}>Primary</span>}
                  <br />
                  <a href={`tel:${c.phone}`} style={{ color: '#2563eb', fontWeight: 600, fontSize: 15 }}>{c.phone}</a>
                </div>
              ))}
          </div>
        )}

        {/* Insurance */}
        {(p.insuranceProvider || p.insurancePolicyNumber) && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>🛡️ Insurance</h2>
            <div style={s.grid2}>
              {p.insuranceProvider && <Row label="Provider" value={p.insuranceProvider} />}
              {p.insurancePolicyNumber && <Row label="Policy No." value={p.insurancePolicyNumber} />}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={s.footer}>
          <p>🏥 MedChain Healthcare Platform · Data accessed at {new Date(data.accessedAt).toLocaleString()}</p>
          <p style={{ color: '#dc2626', fontWeight: 600, marginTop: 4 }}>
            FOR EMERGENCY USE ONLY — This link expires at {new Date(data.expiresAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: highlight ? 22 : 15, fontWeight: highlight ? 700 : 500, color: highlight ? '#dc2626' : '#222' }}>{value}</div>
    </div>
  );
}

const s: Record<string, any> = {
  page: { minHeight: '100vh', background: '#f8fafc', fontFamily: 'Arial, sans-serif' },
  center: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 40, height: 40, border: '4px solid #e5e7eb', borderTop: '4px solid #dc2626', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  errorCard: { background: '#fff', borderRadius: 12, padding: '2rem', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: 400 },
  header: { background: 'linear-gradient(135deg, #dc2626, #991b1b)', color: '#fff', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  headerInner: { display: 'flex', alignItems: 'center', gap: 16 },
  headerTitle: { margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: 1 },
  headerSub: { margin: '4px 0 0', fontSize: 13, opacity: 0.85 },
  expiry: { background: 'rgba(255,255,255,0.2)', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  body: { maxWidth: 800, margin: '0 auto', padding: '1.5rem 1rem' },
  card: { background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  cardTitle: { margin: '0 0 1rem', fontSize: 16, fontWeight: 700, color: '#1f2937' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' },
  listItem: { padding: '8px 0', borderBottom: '1px solid #f3f4f6', lineHeight: 1.6 },
  tag: { display: 'inline-block', background: '#f3f4f6', color: '#374151', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 500 },
  badge: (severity: string) => ({
    display: 'inline-block',
    marginLeft: 8,
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    background: severity === 'life-threatening' ? '#fee2e2' : severity === 'severe' ? '#fef3c7' : '#f3f4f6',
    color: severity === 'life-threatening' ? '#dc2626' : severity === 'severe' ? '#92400e' : '#374151',
  }),
  footer: { textAlign: 'center', padding: '1.5rem', color: '#888', fontSize: 12, borderTop: '1px solid #e5e7eb', marginTop: '1rem' },
};

export default function EmergencyPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <EmergencyContent />
    </Suspense>
  );
}
