'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PatientSearchResult {
  id: string;
  name: string;
  email: string;
  phone: string;
  permissionStatus: 'none' | 'pending' | 'approved' | 'revoked';
}

export default function RequestAccessComponent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
  const [accessType, setAccessType] = useState('medical_records');
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const searchPatients = async (query: string) => {
    if (!query || query.length < 3) return;

    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:5000/api/permissions/search-patients?query=${encodeURIComponent(query)}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data.patients);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchPatients(query);
  };

  const requestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    try {
      setSubmitting(true);
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + parseInt(duration));

      const response = await fetch('http://localhost:5000/api/permissions/request-access', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          accessType,
          expiryDate: expiryDate.toISOString(),
          reason: reason || `Medical consultation - ${accessType.replace('_', ' ')}`
        })
      });

      if (response.ok) {
        alert('Access request sent to patient!');
        setSelectedPatient(null);
        setSearchResults([]);
        setSearchQuery('');
        setReason('');
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to send request');
      }
    } catch (err) {
      alert('Failed to send access request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Request Patient Access</h2>

        {/* Search Patient */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search Patient</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Search by name, email, or phone... (min 3 characters)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {loading && <div className="absolute right-3 top-3 text-gray-400">Searching...</div>}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-2 border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
              {searchResults.map(patient => (
                <button
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setSearchResults([]);
                    setSearchQuery('');
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-200 ${
                    patient.permissionStatus === 'approved' ? 'bg-green-50' :
                    patient.permissionStatus === 'pending' ? 'bg-yellow-50' :
                    'bg-white'
                  }`}
                >
                  <div className="font-medium text-gray-900">{patient.name}</div>
                  <div className="text-sm text-gray-600">{patient.email} • {patient.phone}</div>
                  {patient.permissionStatus !== 'none' && (
                    <div className={`text-xs mt-1 ${
                      patient.permissionStatus === 'approved' ? 'text-green-700' :
                      patient.permissionStatus === 'pending' ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {patient.permissionStatus === 'approved' && '✓ Access Approved'}
                      {patient.permissionStatus === 'pending' && '⏳ Pending'}
                      {patient.permissionStatus === 'revoked' && '🔒 Revoked'}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Patient */}
        {selectedPatient && (
          <form onSubmit={requestAccess} className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-600"><strong>Selected:</strong> {selectedPatient.name}</p>
            </div>

            {/* Access Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type of Access Needed</label>
              <select
                value={accessType}
                onChange={e => setAccessType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <optgroup label="Specific Data">
                  <option value="medical_records">📋 Medical Records Only</option>
                  <option value="prescriptions">💊 Prescriptions Only</option>
                  <option value="appointments">📅 Appointments Only</option>
                  <option value="test_results">🧪 Test Results Only</option>
                </optgroup>
                <optgroup label="Comprehensive Access">
                  <option value="full_access">🔓 Full Access (ALL Data)</option>
                </optgroup>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select specific data type OR Full Access for all records
              </p>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Access Duration</label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={duration}
                  onChange={e => setDuration(parseInt(e.target.value))}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <span className="text-gray-600">days</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Expires on: {new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </p>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Request</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain why you need access to this patient's data..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">{reason.length}/500</p>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting || !reason}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
              >
                {submitting ? 'Sending...' : '📧 Send Request'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
