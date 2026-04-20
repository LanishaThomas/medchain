'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/services/authService';
import QRCode from 'qrcode';

interface ActiveSession {
  _id: string;
  hospital: {
    name: string;
    type: string;
    address?: { city: string };
    logo?: string;
  };
  accessTime: string;
  expiresAt: string;
  accessStatus: string;
}

interface AccessLog {
  _id: string;
  hospital: {
    name: string;
    type: string;
    address?: { city: string };
  };
  accessedByUser?: {
    firstName: string;
    lastName: string;
  };
  accessTime: string;
  expiresAt: string;
  accessStatus: string;
  patientReview?: {
    reviewed: boolean;
    flaggedAsSuspicious: boolean;
  };
}

export default function EmergencyQRPage() {
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'generate' | 'active' | 'history'>('generate');
  
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [accessHistory, setAccessHistory] = useState<AccessLog[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    if (activeTab === 'active') {
      fetchActiveSessions();
    } else if (activeTab === 'history') {
      fetchAccessHistory();
    }
    
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [activeTab, historyPage]);

  useEffect(() => {
    if (expiresAt) {
      countdownRef.current = setInterval(() => {
        const now = new Date();
        const diff = expiresAt.getTime() - now.getTime();
        
        if (diff <= 0) {
          setCountdown('Expired');
          setQrData(null);
          setQrImage(null);
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
  }, [expiresAt]);

  const generateQR = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.post('/emergency/generate-qr', { duration });
      
      if (response.data.success) {
        const data = response.data.data;
        setQrData(data.qrData);
        setExpiresAt(new Date(data.expiresAt));
        
        // Generate QR code image
        const qrImageUrl = await QRCode.toDataURL(data.qrData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#1f2937',
            light: '#ffffff'
          }
        });
        setQrImage(qrImageUrl);
        
        setSuccess('QR code generated successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const response = await api.get('/emergency/active-sessions');
      if (response.data.success) {
        setActiveSessions(response.data.data.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch active sessions:', err);
    }
  };

  const fetchAccessHistory = async () => {
    try {
      const response = await api.get(`/emergency/history?page=${historyPage}&limit=10`);
      if (response.data.success) {
        setAccessHistory(response.data.data.logs);
        setTotalPages(response.data.data.pagination.pages);
      }
    } catch (err) {
      console.error('Failed to fetch access history:', err);
    }
  };

  const revokeAccess = async (logId: string) => {
    if (!confirm('Are you sure you want to revoke this hospital\'s access?')) return;
    
    try {
      await api.post(`/emergency/revoke/${logId}`, { reason: 'Revoked by patient' });
      setSuccess('Access revoked successfully');
      fetchActiveSessions();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to revoke access');
    }
  };

  const invalidateCurrentQR = async () => {
    if (!confirm('This will make your current QR code invalid. Continue?')) return;
    
    try {
      await api.post('/emergency/invalidate-qr');
      setQrData(null);
      setQrImage(null);
      setExpiresAt(null);
      setSuccess('QR code invalidated. Generate a new one when needed.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to invalidate QR');
    }
  };

  const reviewAccessLog = async (logId: string, flagged: boolean) => {
    try {
      await api.patch(`/emergency/review/${logId}`, { flaggedAsSuspicious: flagged });
      fetchAccessHistory();
      setSuccess(flagged ? 'Access flagged for review' : 'Access reviewed');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to review:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      case 'revoked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🚨 Emergency QR Code</h1>
        <p className="text-gray-600">Generate a QR code for emergency access to your critical health information</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex justify-between items-center">
          {error}
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { key: 'generate', label: '📱 Generate QR' },
            { key: 'active', label: '🟢 Active Sessions' },
            { key: 'history', label: '📜 Access History' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Generate QR Tab */}
      {activeTab === 'generate' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="max-w-md mx-auto text-center space-y-6">
            {/* Warning */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ This QR code allows hospitals to access your emergency health data temporarily.
                Only share it with verified healthcare providers.
              </p>
            </div>

            {/* Duration Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Access Duration</label>
              <select
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              >
                <option value="5">5 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes (default)</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
              </select>
            </div>

            {/* QR Display or Generate Button */}
            {qrImage ? (
              <div className="space-y-4">
                <div className="inline-block p-4 bg-white rounded-lg shadow-lg border-2 border-red-200">
                  <img src={qrImage} alt="Emergency QR Code" className="w-72 h-72" />
                </div>
                
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">Time Remaining</p>
                  <p className={`text-3xl font-bold ${
                    countdown === 'Expired' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {countdown}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Expires: {expiresAt?.toLocaleTimeString()}
                  </p>
                </div>

                {/* Download QR */}
                <a
                  href={qrImage}
                  download="emergency-qr.png"
                  className="inline-block px-4 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800"
                >
                  ⬇ Download QR Code
                </a>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={invalidateCurrentQR}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Invalidate QR
                  </button>
                  <button
                    onClick={generateQR}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Generate New
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={generateQR}
                disabled={loading}
                className="w-full py-4 bg-red-600 text-white text-lg font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                    Generating...
                  </>
                ) : (
                  <>🚨 Generate Emergency QR Code</>
                )}
              </button>
            )}

            {/* Info Box */}
            <div className="p-4 bg-gray-50 rounded-lg text-left">
              <h4 className="font-medium text-gray-900 mb-2">What data will be shared?</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ Blood Type</li>
                <li>✓ Allergies & Reactions</li>
                <li>✓ Current Medications</li>
                <li>✓ Emergency Contacts</li>
                <li>✓ Previous Surgeries</li>
                <li>✓ Chronic Conditions</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Active Sessions Tab */}
      {activeTab === 'active' && (
        <div className="bg-white rounded-lg shadow">
          {activeSessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg">No active emergency access sessions</p>
              <p className="text-sm">When a hospital scans your QR, it will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {activeSessions.map(session => (
                <div key={session._id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                      🏥
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{session.hospital.name}</p>
                      <p className="text-sm text-gray-500">{session.hospital.type}</p>
                      <p className="text-sm text-gray-500">
                        Accessed: {formatDate(session.accessTime)} | 
                        Expires: {formatDate(session.expiresAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => revokeAccess(session._id)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    Revoke Access
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow">
          {accessHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg">No emergency access history</p>
              <p className="text-sm">Past QR access sessions will appear here</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-200">
                {accessHistory.map(log => (
                  <div key={log._id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                          🏥
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{log.hospital.name}</p>
                          <p className="text-sm text-gray-500">{log.hospital.type}</p>
                          {log.accessedByUser && (
                            <p className="text-sm text-gray-500">
                              By: {log.accessedByUser.firstName} {log.accessedByUser.lastName}
                            </p>
                          )}
                          <p className="text-sm text-gray-500">
                            {formatDate(log.accessTime)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(log.accessStatus)}`}>
                          {log.accessStatus}
                        </span>
                        
                        {!log.patientReview?.reviewed && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => reviewAccessLog(log._id, false)}
                              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              ✓ OK
                            </button>
                            <button
                              onClick={() => reviewAccessLog(log._id, true)}
                              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              ⚠️ Flag
                            </button>
                          </div>
                        )}
                        
                        {log.patientReview?.reviewed && (
                          <span className={`text-sm ${
                            log.patientReview.flaggedAsSuspicious ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {log.patientReview.flaggedAsSuspicious ? '⚠️ Flagged' : '✓ Reviewed'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-4 border-t flex justify-center gap-2">
                  <button
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="px-4 py-2 bg-gray-100 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2">
                    Page {historyPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                    disabled={historyPage === totalPages}
                    className="px-4 py-2 bg-gray-100 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
