'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/services/authService';

interface MedicalRecord {
  _id: string;
  verificationStatus?: 'VERIFIED' | 'TAMPERED';
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  recordType: string;
  clinicalData?: {
    testName?: string;
    testDate?: string;
    labName?: string;
    doctorName?: string;
    diagnosis?: string;
    notes?: string;
  };
  uploadedBy: {
    firstName: string;
    lastName: string;
    role: string;
  };
  hospital?: {
    name: string;
  };
  createdAt: string;
  updatedAt?: string;
  formattedSize?: string;
  tags?: string[];
}

interface RecordStats {
  totalRecords: number;
  totalSize: number;
  formattedSize: string;
  byType: { type: string; count: number; size: number }[];
}

const RECORD_TYPES = [
  { value: 'lab_report', label: '🧪 Lab Report' },
  { value: 'prescription', label: '💊 Prescription' },
  { value: 'imaging', label: '📷 Imaging (X-ray, MRI, CT)' },
  { value: 'discharge_summary', label: '🏥 Discharge Summary' },
  { value: 'consultation_notes', label: '📝 Consultation Notes' },
  { value: 'vaccination', label: '💉 Vaccination' },
  { value: 'insurance', label: '📋 Insurance' },
  { value: 'other', label: '📄 Other' }
];

export default function MedicalRecordsComponent() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [stats, setStats] = useState<RecordStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filters
  const [filterType, setFilterType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Upload form
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    recordType: 'other',
    testName: '',
    testDate: '',
    labName: '',
    diagnosis: '',
    notes: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // View record modal
  const [viewingRecord, setViewingRecord] = useState<MedicalRecord | null>(null);

  // Fetch records
  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '10');
      if (filterType) params.append('recordType', filterType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await api.get(`/medical-records/my-records?${params.toString()}`);
      
      if (response.data.success) {
        setRecords(response.data.data.records);
        setTotalPages(response.data.data.pagination.pages);
      }
    } catch (err: any) {
      console.error('Fetch records error:', err);
      setError(err.response?.data?.message || 'Failed to fetch records');
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await api.get('/medical-records/stats/summary');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Fetch stats error:', err);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [page, filterType, startDate, endDate]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  // Handle upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }
    
    if (!uploadData.title.trim()) {
      setError('Please enter a title');
      return;
    }

    try {
      setUploading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', uploadData.title);
      formData.append('description', uploadData.description);
      formData.append('recordType', uploadData.recordType);
      
      // Add clinical data if provided
      const clinicalData: any = {};
      if (uploadData.testName) clinicalData.testName = uploadData.testName;
      if (uploadData.testDate) clinicalData.testDate = uploadData.testDate;
      if (uploadData.labName) clinicalData.labName = uploadData.labName;
      if (uploadData.diagnosis) clinicalData.diagnosis = uploadData.diagnosis;
      if (uploadData.notes) clinicalData.notes = uploadData.notes;
      
      if (Object.keys(clinicalData).length > 0) {
        formData.append('clinicalData', JSON.stringify(clinicalData));
      }

      console.log('📤 Uploading file:', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        title: uploadData.title
      });

      // Use native fetch — axios has issues with FormData Content-Type headers
      const token = sessionStorage.getItem('accessToken');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://medchain-x96u.onrender.com/api';
      
      const res = await fetch(`${API_URL}/medical-records/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          // Do NOT set Content-Type — browser sets it with boundary for FormData
        },
        body: formData
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data?.message || `Upload failed (${res.status})`);
      }

      if (data.success) {
        setSuccess('Record uploaded successfully!');
        setShowUploadForm(false);
        setSelectedFile(null);
        setUploadData({
          title: '',
          description: '',
          recordType: 'other',
          testName: '',
          testDate: '',
          labName: '',
          diagnosis: '',
          notes: ''
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        fetchRecords();
        fetchStats();
        
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload record');
    } finally {
      setUploading(false);
    }
  };

  // Handle delete
  const handleDelete = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    
    try {
      const response = await api.delete(`/medical-records/${recordId}`);
      if (response.data.success) {
        setSuccess('Record deleted successfully');
        fetchRecords();
        fetchStats();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete record');
    }
  };

  // Handle download
  const handleDownload = async (record: MedicalRecord) => {
    try {
      const response = await api.get(`/medical-records/${record._id}/download`);
      if (response.data.success) {
        // Open download URL in new tab
        window.open(response.data.data.downloadUrl, '_blank');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to download record');
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Get record type label
  const getRecordTypeLabel = (type: string) => {
    const found = RECORD_TYPES.find(t => t.value === type);
    return found ? found.label : type;
  };

  // Get file icon
  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image': return '🖼️';
      case 'pdf': return '📄';
      case 'document': return '📝';
      default: return '📎';
    }
  };

  return (
    <div className="space-y-6">
      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError('')} className="float-right text-red-500">&times;</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg">
            <div className="text-sm opacity-80">Total Records</div>
            <div className="text-2xl font-bold">{stats.totalRecords}</div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg">
            <div className="text-sm opacity-80">Total Storage</div>
            <div className="text-2xl font-bold">{stats.formattedSize}</div>
          </div>
          {stats.byType.slice(0, 2).map((item, idx) => (
            <div key={idx} className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-lg">
              <div className="text-sm opacity-80 capitalize">{item.type.replace('_', ' ')}</div>
              <div className="text-2xl font-bold">{item.count}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-lg shadow">
        <div className="flex gap-4 items-center flex-wrap">
          {/* Filter by Type */}
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            {RECORD_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          
          {/* Date Range */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="From"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="To"
          />
          
          {/* Clear Filters */}
          {(filterType || startDate || endDate) && (
            <button
              onClick={() => { setFilterType(''); setStartDate(''); setEndDate(''); setPage(1); }}
              className="text-sm text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
        
        {/* Upload Button */}
        <button
          onClick={() => setShowUploadForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload Record
        </button>
      </div>

      {/* Upload Form Modal */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-semibold">Upload Medical Record</h3>
              <button 
                onClick={() => setShowUploadForm(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File <span className="text-red-500">*</span>
                </label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition ${
                    selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-300'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="text-green-600">
                      <span className="text-3xl">✓</span>
                      <p className="font-medium mt-2">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">{formatSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mt-2">Click to upload or drag and drop</p>
                      <p className="text-sm">PDF, Images, Word docs (max 10MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadData.title}
                  onChange={(e) => setUploadData({...uploadData, title: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Blood Test Report - March 2024"
                  required
                />
              </div>

              {/* Record Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Record Type</label>
                <select
                  value={uploadData.recordType}
                  onChange={(e) => setUploadData({...uploadData, recordType: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {RECORD_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={uploadData.description}
                  onChange={(e) => setUploadData({...uploadData, description: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="Add any notes or description..."
                />
              </div>

              {/* Clinical Data (collapsible) */}
              <details className="border rounded-lg p-4">
                <summary className="cursor-pointer font-medium text-gray-700">
                  Additional Clinical Information (Optional)
                </summary>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Test/Procedure Name</label>
                    <input
                      type="text"
                      value={uploadData.testName}
                      onChange={(e) => setUploadData({...uploadData, testName: e.target.value})}
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="e.g., Complete Blood Count"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Test Date</label>
                    <input
                      type="date"
                      value={uploadData.testDate}
                      onChange={(e) => setUploadData({...uploadData, testDate: e.target.value})}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Lab/Hospital Name</label>
                    <input
                      type="text"
                      value={uploadData.labName}
                      onChange={(e) => setUploadData({...uploadData, labName: e.target.value})}
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="e.g., City Lab"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Diagnosis</label>
                    <input
                      type="text"
                      value={uploadData.diagnosis}
                      onChange={(e) => setUploadData({...uploadData, diagnosis: e.target.value})}
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="e.g., Normal"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Notes</label>
                    <textarea
                      value={uploadData.notes}
                      onChange={(e) => setUploadData({...uploadData, notes: e.target.value})}
                      className="w-full border rounded px-3 py-2 text-sm"
                      rows={2}
                      placeholder="Any additional notes..."
                    />
                  </div>
                </div>
              </details>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploading...
                    </>
                  ) : (
                    'Upload Record'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Records List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <span className="text-6xl">📁</span>
          <h3 className="text-xl font-medium text-gray-900 mt-4">No records yet</h3>
          <p className="text-gray-500 mt-2">Upload your first medical record to get started</p>
          <button
            onClick={() => setShowUploadForm(true)}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
          >
            Upload Record
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Record</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Size</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Uploaded</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((record) => (
                <tr key={record._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getFileIcon(record.fileType)}</span>
                      <div>
                        <div className="font-medium text-gray-900">{record.title}</div>
                        <div className="text-sm text-gray-500">{record.fileName}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getRecordTypeLabel(record.recordType)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(record.verificationStatus || 'TAMPERED') === 'VERIFIED' ? (
                      <span className="text-xs px-2 py-1 rounded font-semibold bg-green-100 text-green-800">✅ Verified</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded font-bold bg-red-600 text-white animate-pulse">🚨 TAMPERED</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatSize(record.fileSize)}
                    <div className="mt-1 text-xs text-gray-500">
                      Last Modified: {new Date(record.updatedAt || record.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {new Date(record.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      by {record.uploadedBy.firstName} {record.uploadedBy.lastName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewingRecord(record)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="View"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDownload(record)}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                        title="Download"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(record._id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Record Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-semibold">Record Details</h3>
              <button 
                onClick={() => setViewingRecord(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6">
              {/* File Preview */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                {viewingRecord.fileType === 'image' ? (
                  <img 
                    src={viewingRecord.fileUrl} 
                    alt={viewingRecord.title}
                    className="max-w-full max-h-96 mx-auto rounded"
                  />
                ) : viewingRecord.fileType === 'pdf' ? (
                  <div className="text-center">
                    <span className="text-6xl">📄</span>
                    <p className="mt-2 text-gray-600">PDF Document</p>
                    <a 
                      href={viewingRecord.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-blue-600 hover:underline"
                    >
                      Open in new tab →
                    </a>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="text-6xl">{getFileIcon(viewingRecord.fileType)}</span>
                    <p className="mt-2 text-gray-600">{viewingRecord.fileName}</p>
                  </div>
                )}
              </div>
              
              {/* Record Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Title</label>
                  <p className="font-medium">{viewingRecord.title}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Type</label>
                  <p className="font-medium">{getRecordTypeLabel(viewingRecord.recordType)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">File Size</label>
                  <p className="font-medium">{formatSize(viewingRecord.fileSize)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Uploaded On</label>
                  <p className="font-medium">{new Date(viewingRecord.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Uploaded By</label>
                  <p className="font-medium">
                    {viewingRecord.uploadedBy.firstName} {viewingRecord.uploadedBy.lastName}
                    <span className="text-gray-500 ml-1">({viewingRecord.uploadedBy.role})</span>
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Verification</label>
                  <p>
                    {(viewingRecord.verificationStatus || 'TAMPERED') === 'VERIFIED' ? (
                      <span className="text-xs px-2 py-1 rounded font-semibold bg-green-100 text-green-800">✅ Verified</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded font-bold bg-red-600 text-white animate-pulse">🚨 TAMPERED</span>
                    )}
                  </p>
                </div>
                {viewingRecord.hospital && (
                  <div>
                    <label className="text-sm text-gray-500">Hospital</label>
                    <p className="font-medium">{viewingRecord.hospital.name}</p>
                  </div>
                )}
                {viewingRecord.description && (
                  <div className="col-span-2">
                    <label className="text-sm text-gray-500">Description</label>
                    <p className="font-medium">{viewingRecord.description}</p>
                  </div>
                )}
              </div>
              
              {/* Clinical Data */}
              {viewingRecord.clinicalData && Object.keys(viewingRecord.clinicalData).length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-4">Clinical Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {viewingRecord.clinicalData.testName && (
                      <div>
                        <label className="text-sm text-gray-500">Test Name</label>
                        <p className="font-medium">{viewingRecord.clinicalData.testName}</p>
                      </div>
                    )}
                    {viewingRecord.clinicalData.testDate && (
                      <div>
                        <label className="text-sm text-gray-500">Test Date</label>
                        <p className="font-medium">{new Date(viewingRecord.clinicalData.testDate).toLocaleDateString()}</p>
                      </div>
                    )}
                    {viewingRecord.clinicalData.labName && (
                      <div>
                        <label className="text-sm text-gray-500">Lab/Hospital</label>
                        <p className="font-medium">{viewingRecord.clinicalData.labName}</p>
                      </div>
                    )}
                    {viewingRecord.clinicalData.diagnosis && (
                      <div>
                        <label className="text-sm text-gray-500">Diagnosis</label>
                        <p className="font-medium">{viewingRecord.clinicalData.diagnosis}</p>
                      </div>
                    )}
                    {viewingRecord.clinicalData.notes && (
                      <div className="col-span-2">
                        <label className="text-sm text-gray-500">Notes</label>
                        <p className="font-medium">{viewingRecord.clinicalData.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="mt-6 pt-6 border-t flex gap-3">
                <button
                  onClick={() => handleDownload(viewingRecord)}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={() => setViewingRecord(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
