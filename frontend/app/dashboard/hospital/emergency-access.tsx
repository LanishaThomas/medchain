'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/services/authService';

interface EmergencyData {
  patient: {
    id: string;
    name: string;
    age: number | null;
    gender: string;
    phone: string;
  };
  bloodType: string;
  allergies: Array<{
    allergen: string;
    severity: string;
    reaction: string;
  }>;
  currentMedications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    prescribedFor: string;
  }>;
  previousSurgeries: Array<{
    name: string;
    date: string;
    hospital: string;
  }>;
  chronicConditions: string[];
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
    isPrimary: boolean;
  }>;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

interface AccessInfo {
  accessLogId: string;
  accessedAt: string;
  expiresAt: string;
  remainingMinutes: number;
  hospitalName: string;
}

export default function EmergencyAccessPage() {
  const [qrInput, setQrInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [emergencyData, setEmergencyData] = useState<EmergencyData | null>(null);
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);
  const [countdown, setCountdown] = useState('');
  
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (accessInfo) {
      countdownRef.current = setInterval(() => {
        const now = new Date();
        const expiresAt = new Date(accessInfo.expiresAt);
        const diff = expiresAt.getTime() - now.getTime();
        
        if (diff <= 0) {
          setCountdown('Expired');
          setEmergencyData(null);
          if (countdownRef.current) clearInterval(countdownRef.current);
          return;
        }
        
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    }
    
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [accessInfo]);

  const handleScanSubmit = async () => {
    if (!qrInput.trim()) {
      setError('Please enter or scan QR code data');
      return;
    }

    try {
      setScanning(true);
      setError('');
      
      const response = await api.post('/emergency/access', {
        qrData: qrInput.trim(),
        location: {} // Could add geolocation here
      });

      if (response.data.success) {
        setEmergencyData(response.data.data.emergencyData);
        setAccessInfo(response.data.data.accessInfo);
        setQrInput('');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to access emergency data. The QR code may be invalid or expired.');
    } finally {
      setScanning(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'life-threatening': return 'bg-red-600 text-white';
      case 'severe': return 'bg-red-500 text-white';
      case 'moderate': return 'bg-orange-500 text-white';
      case 'mild': return 'bg-yellow-400 text-gray-800';
      default: return 'bg-gray-400 text-white';
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-red-600 text-white py-4 px-6">
        <h1 className="text-2xl font-bold">🚨 Emergency Access Portal</h1>
        <p className="text-red-100">Scan patient QR code for emergency health information</p>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
            {error}
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        {!emergencyData ? (
          /* QR Input Section */
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-xl mx-auto">
            <div className="text-center space-y-6">
              <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-5xl">📱</span>
              </div>
              
              <div>
                <h2 className="text-xl font-bold text-gray-900">Scan Emergency QR Code</h2>
                <p className="text-gray-600 mt-2">
                  Use a QR scanner or paste the QR code data below
                </p>
              </div>

              <div className="space-y-4">
                <textarea
                  value={qrInput}
                  onChange={e => setQrInput(e.target.value)}
                  placeholder="Paste QR code data here..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 min-h-[100px] font-mono text-sm"
                />
                
                <button
                  onClick={handleScanSubmit}
                  disabled={scanning || !qrInput.trim()}
                  className="w-full py-4 bg-red-600 text-white text-lg font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {scanning ? (
                    <>
                      <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                      Accessing...
                    </>
                  ) : (
                    <>🔓 Access Emergency Data</>
                  )}
                </button>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Important:</strong> Only access patient data in genuine emergency situations. 
                  All access is logged and monitored. Misuse may result in legal action.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Emergency Data Display */
          <div className="space-y-6">
            {/* Access Timer */}
            <div className="bg-red-600 text-white rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">Emergency Access Active</p>
                <p className="text-red-100">Hospital: {accessInfo?.hospitalName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-red-100">Time Remaining</p>
                <p className={`text-3xl font-bold ${countdown === 'Expired' ? 'text-yellow-300' : ''}`}>
                  {countdown}
                </p>
              </div>
            </div>

            {/* Patient Info Card */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-start justify-between border-b pb-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
                    👤
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{emergencyData.patient.name}</h2>
                    <p className="text-gray-600">
                      {emergencyData.patient.age ? `${emergencyData.patient.age} years old` : ''} 
                      {emergencyData.patient.gender && ` • ${emergencyData.patient.gender}`}
                    </p>
                    {emergencyData.patient.phone && (
                      <p className="text-gray-600">📞 {emergencyData.patient.phone}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-red-600">{emergencyData.bloodType}</p>
                  <p className="text-sm text-gray-500">Blood Type</p>
                </div>
              </div>

              {/* Critical Info Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Allergies */}
                <div className="bg-red-50 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-red-800 mb-3 flex items-center gap-2">
                    ⚠️ Allergies
                  </h3>
                  {emergencyData.allergies.length === 0 ? (
                    <p className="text-gray-600">No known allergies</p>
                  ) : (
                    <div className="space-y-2">
                      {emergencyData.allergies.map((allergy, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(allergy.severity)}`}>
                            {allergy.severity}
                          </span>
                          <div>
                            <p className="font-medium text-red-900">{allergy.allergen}</p>
                            {allergy.reaction && (
                              <p className="text-sm text-red-700">Reaction: {allergy.reaction}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Current Medications */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-blue-800 mb-3 flex items-center gap-2">
                    💊 Current Medications
                  </h3>
                  {emergencyData.currentMedications.length === 0 ? (
                    <p className="text-gray-600">No current medications</p>
                  ) : (
                    <div className="space-y-2">
                      {emergencyData.currentMedications.map((med, i) => (
                        <div key={i} className="bg-white bg-opacity-50 rounded p-2">
                          <p className="font-medium text-blue-900">{med.name}</p>
                          <p className="text-sm text-blue-700">
                            {med.dosage} {med.frequency && `• ${med.frequency}`}
                          </p>
                          {med.prescribedFor && (
                            <p className="text-xs text-blue-600">For: {med.prescribedFor}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Previous Surgeries */}
                <div className="bg-amber-50 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-amber-800 mb-3 flex items-center gap-2">
                    🏥 Previous Surgeries
                  </h3>
                  {emergencyData.previousSurgeries.length === 0 ? (
                    <p className="text-gray-600">No previous surgeries</p>
                  ) : (
                    <div className="space-y-2">
                      {emergencyData.previousSurgeries.map((surgery, i) => (
                        <div key={i} className="bg-white bg-opacity-50 rounded p-2">
                          <p className="font-medium text-amber-900">{surgery.name}</p>
                          <p className="text-sm text-amber-700">
                            {formatDate(surgery.date)} {surgery.hospital && `at ${surgery.hospital}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chronic Conditions */}
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-purple-800 mb-3 flex items-center gap-2">
                    🩺 Chronic Conditions
                  </h3>
                  {emergencyData.chronicConditions.length === 0 ? (
                    <p className="text-gray-600">No chronic conditions</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {emergencyData.chronicConditions.map((condition, i) => (
                        <span key={i} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                          {condition}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Emergency Contacts */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                📞 Emergency Contacts
              </h3>
              
              {emergencyData.emergencyContacts.length === 0 ? (
                <p className="text-gray-600">No emergency contacts listed</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {emergencyData.emergencyContacts.map((contact, i) => (
                    <div 
                      key={i} 
                      className={`p-4 rounded-lg border-2 ${
                        contact.isPrimary ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-gray-900">{contact.name}</p>
                        {contact.isPrimary && (
                          <span className="px-2 py-0.5 text-xs bg-green-600 text-white rounded">Primary</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{contact.relationship}</p>
                      <a 
                        href={`tel:${contact.phone}`}
                        className="text-lg font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-2 mt-2"
                      >
                        📱 {contact.phone}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Address */}
            {emergencyData.address && (emergencyData.address.city || emergencyData.address.street) && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">📍 Patient Address</h3>
                <p className="text-gray-700">
                  {[
                    emergencyData.address.street,
                    emergencyData.address.city,
                    emergencyData.address.state,
                    emergencyData.address.zipCode
                  ].filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            {/* Clear / New Scan */}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  setEmergencyData(null);
                  setAccessInfo(null);
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Clear & Scan New QR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
