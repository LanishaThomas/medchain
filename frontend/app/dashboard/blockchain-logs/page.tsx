'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';

type BlockchainLog = {
  _id: string;
  dataHash: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actionType: string;
  verificationStatus?: 'VERIFIED' | 'TAMPERED';
  metadata: Record<string, unknown>;
  timestamp: string;
  blockchainTxHash: string;
  blockNumber: number;
  chainId: number;
  contractAddress: string;
};

const amoyExplorer = 'https://amoy.polygonscan.com/tx/';

export default function BlockchainLogsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [logs, setLogs] = useState<BlockchainLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actionType, setActionType] = useState('');
  const [actorId, setActorId] = useState('');

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [isLoading, user, router]);

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      setError('');

      const response = await authService.getBlockchainLogs({
        entityType: entityType || undefined,
        actionType: actionType || undefined,
        actorId: actorId || undefined,
        limit: 100,
        page: 1
      });

      const fetched = response.data?.data?.logs || [];
      setLogs(fetched);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load blockchain logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  const uniqueEntityTypes = useMemo(() => {
    const values = new Set(logs.map((l) => l.entityType));
    return Array.from(values).sort();
  }, [logs]);

  const uniqueActionTypes = useMemo(() => {
    const values = new Set(logs.map((l) => l.actionType));
    return Array.from(values).sort();
  }, [logs]);

  const copyTxHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Blockchain Audit Logs</h1>
          <p className="text-gray-600 mt-2">Immutable Polygon Amoy transaction ledger for critical MedChain events.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All entity types</option>
              {uniqueEntityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All action types</option>
              {uniqueActionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <input
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              placeholder="Filter by actor ID"
              className="border border-gray-300 rounded-md px-3 py-2"
            />

            <button
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="bg-blue-600 text-white rounded-md px-4 py-2 font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loadingLogs ? 'Loading...' : 'Apply Filters'}
            </button>
          </div>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3">Entity</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actor</th>
                <th className="text-left px-4 py-3">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-t border-gray-200">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{log.entityType}</div>
                    <div className="text-gray-500">{log.entityId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-semibold">
                      {log.actionType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(log.verificationStatus || 'TAMPERED') === 'VERIFIED' ? (
                      <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                        ✅ VERIFIED
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 rounded text-xs font-bold bg-red-600 text-white animate-pulse">
                        🚨 TAMPERED
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{log.actorId}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900 break-all">{log.blockchainTxHash}</div>
                    <div className="flex gap-3 mt-2">
                      <button
                        onClick={() => copyTxHash(log.blockchainTxHash)}
                        className="text-blue-700 hover:underline"
                      >
                        Copy hash
                      </button>
                      <a
                        href={`${amoyExplorer}${log.blockchainTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline"
                      >
                        View on PolygonScan
                      </a>
                    </div>
                  </td>
                </tr>
              ))}

              {!loadingLogs && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No blockchain logs found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
