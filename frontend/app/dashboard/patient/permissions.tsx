'use client';

import { useState, useEffect } from 'react';

interface PendingRequest {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorEmail: string;
  accessType: string;
  requestReason: string;
  requestedAt: string;
  expiryDate: string;
  daysRequested: number;
}

interface Permission {
  id: string;
  doctorId: string;
  doctor: string;
  hospital?: string;
  accessType: string;
  status: 'approved' | 'revoked' | 'rejected' | 'expired';
  requestedAt: string;
  approvedAt?: string;
  revokedAt?: string;
  expiryDate?: string;
  daysRemaining?: number;
  isActive?: boolean;
}

// Helper function to display access types nicely
const getAccessTypeDisplay = (accessType: string) => {
  const types: { [key: string]: { icon: string; label: string; description: string } } = {
    medical_records: { icon: '📋', label: 'Medical Records', description: 'Patient health history & diagnoses' },
    prescriptions: { icon: '💊', label: 'Prescriptions', description: 'Current & past prescriptions' },
    appointments: { icon: '📅', label: 'Appointments', description: 'Appointment history & schedule' },
    test_results: { icon: '🧪', label: 'Test Results', description: 'Lab tests & diagnostics' },
    full_access: { icon: '🔓', label: 'Full Access', description: 'All medical data & records' }
  };
  return types[accessType] || { icon: '📄', label: accessType, description: 'Access to medical data' };
};

export default function PatientPermissionsComponent() {
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history'>('pending');
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch pending requests
  useEffect(() => {
    fetchPendingRequests();
    fetchPermissions();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/permissions/pending', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data.data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching pending requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/permissions', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPermissions(data.data.permissions || []);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  };

  const approveRequest = async (permissionId: string) => {
    try {
      setProcessingId(permissionId);
      const response = await fetch(
        `http://localhost:5000/api/permissions/${permissionId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ notes: 'Approved by patient' })
        }
      );

      if (response.ok) {
        alert('✅ Access approved!');
        fetchPendingRequests();
        fetchPermissions();
      } else {
        const err = await response.json();
        alert('❌ ' + (err.message || 'Failed to approve'));
      }
    } catch (err) {
      alert('Error approving request');
    } finally {
      setProcessingId(null);
    }
  };

  const rejectRequest = async (permissionId: string) => {
    const reason = prompt('Why are you rejecting this request? (optional)');
    try {
      setProcessingId(permissionId);
      const response = await fetch(
        `http://localhost:5000/api/permissions/${permissionId}/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: reason || 'Rejected by patient' })
        }
      );

      if (response.ok) {
        alert('✅ Request rejected!');
        fetchPendingRequests();
        fetchPermissions();
      } else {
        alert('❌ Failed to reject');
      }
    } catch (err) {
      alert('Error rejecting request');
    } finally {
      setProcessingId(null);
    }
  };

  const revokeAccess = async (permissionId: string) => {
    const reason = prompt('Why are you revoking this access?');
    if (!reason) return;

    try {
      setProcessingId(permissionId);
      const response = await fetch(
        `http://localhost:5000/api/permissions/${permissionId}/revoke`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason })
        }
      );

      if (response.ok) {
        alert('✅ Access revoked!');
        fetchPermissions();
      } else {
        alert('❌ Failed to revoke');
      }
    } catch (err) {
      alert('Error revoking access');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === 'pending'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            ⏳ Pending Requests ({pendingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === 'active'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            ✅ Active Permissions ({permissions.filter(p => p.isActive).length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 History
          </button>
        </div>
      </div>

      {/* Pending Requests Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No pending requests</p>
            </div>
          ) : (
            pendingRequests.map(req => (
              <div key={req.id} className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-400">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Dr. {req.doctorName}</h3>
                    <p className="text-sm text-gray-600">{req.doctorEmail}</p>
                  </div>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    ⏳ PENDING
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">ACCESS TYPE</p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getAccessTypeDisplay(req.accessType).icon}</span>
                      <p className="font-semibold text-gray-900">{getAccessTypeDisplay(req.accessType).label}</p>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{getAccessTypeDisplay(req.accessType).description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">DURATION</p>
                    <p className="font-semibold text-gray-900">{req.daysRequested} days</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">REQUESTED</p>
                    <p className="font-semibold text-gray-900">{new Date(req.requestedAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">EXPIRES</p>
                    <p className="font-semibold text-gray-900">{new Date(req.expiryDate).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">REASON</p>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded">{req.requestReason}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => approveRequest(req.id)}
                    disabled={processingId === req.id}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium transition"
                  >
                    {processingId === req.id ? '⏳ Processing...' : '✅ Approve'}
                  </button>
                  <button
                    onClick={() => rejectRequest(req.id)}
                    disabled={processingId === req.id}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium transition"
                  >
                    {processingId === req.id ? '⏳ Processing...' : '❌ Reject'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Active Permissions Tab */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {permissions.filter(p => p.isActive).length === 0 ? (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No active permissions</p>
            </div>
          ) : (
            permissions
              .filter(p => p.isActive)
              .map(perm => (
                <div key={perm.id} className="bg-white p-6 rounded-lg shadow border-l-4 border-green-400">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{perm.doctor}</h3>
                      {perm.hospital && <p className="text-sm text-gray-600">🏥 {perm.hospital}</p>}
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-2">
                        ✅ ACTIVE
                      </span>
                      {perm.daysRemaining !== undefined && (
                        <p className="text-sm text-gray-600">
                          {perm.daysRemaining} days remaining
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">ACCESS TYPE</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getAccessTypeDisplay(perm.accessType).icon}</span>
                        <div>
                          <p className="font-semibold text-gray-900">{getAccessTypeDisplay(perm.accessType).label}</p>
                          <p className="text-xs text-gray-600">{getAccessTypeDisplay(perm.accessType).description}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">APPROVED</p>
                      <p className="font-semibold text-gray-900">
                        {perm.approvedAt ? new Date(perm.approvedAt).toLocaleDateString() : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">EXPIRES</p>
                      <p className="font-semibold text-gray-900">
                        {perm.expiryDate ? new Date(perm.expiryDate).toLocaleDateString() : '-'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => revokeAccess(perm.id)}
                    disabled={processingId === perm.id}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium transition"
                  >
                    {processingId === perm.id ? '⏳ Processing...' : '🔒 Revoke Access'}
                  </button>
                </div>
              ))
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {permissions.filter(p => !p.isActive && p.status !== 'pending').length === 0 ? (
            <div className="text-center p-8 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No history</p>
            </div>
          ) : (
            permissions
              .filter(p => !p.isActive && p.status !== 'pending')
              .map(perm => (
                <div
                  key={perm.id}
                  className={`bg-white p-6 rounded-lg shadow border-l-4 ${
                    perm.status === 'revoked'
                      ? 'border-orange-400'
                      : perm.status === 'rejected'
                      ? 'border-red-400'
                      : !perm.isActive && perm.status === 'approved'
                      ? 'border-gray-400'
                      : 'border-gray-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{perm.doctor}</h3>
                      {perm.hospital && <p className="text-sm text-gray-600">🏥 {perm.hospital}</p>}
                    </div>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        perm.status === 'revoked'
                          ? 'bg-orange-100 text-orange-800'
                          : perm.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : (!perm.isActive && perm.status === 'approved')
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {perm.status === 'revoked' && '🔒 REVOKED'}
                      {perm.status === 'rejected' && '❌ REJECTED'}
                      {(!perm.isActive && perm.status === 'approved') && '⏰ EXPIRED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">ACCESS TYPE</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getAccessTypeDisplay(perm.accessType).icon}</span>
                        <div>
                          <p className="font-semibold text-gray-900">{getAccessTypeDisplay(perm.accessType).label}</p>
                          <p className="text-xs text-gray-600">{getAccessTypeDisplay(perm.accessType).description}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">REQUESTED</p>
                      <p className="font-semibold text-gray-900">{new Date(perm.requestedAt).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        {(!perm.isActive && perm.status === 'approved') 
                          ? 'EXPIRED' 
                          : perm.status === 'revoked' ? 'REVOKED' : 'REJECTED'}
                      </p>
                      <p className="font-semibold text-gray-900">
                        {(!perm.isActive && perm.status === 'approved')
                          ? new Date(perm.expiryDate as string).toLocaleDateString()
                          : perm.revokedAt 
                            ? new Date(perm.revokedAt).toLocaleDateString() 
                            : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
