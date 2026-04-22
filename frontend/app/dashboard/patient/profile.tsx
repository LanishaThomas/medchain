'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/authService';

interface Allergy {
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  reaction: string;
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  prescribedFor: string;
  startDate: string;
}

interface Surgery {
  name: string;
  date: string;
  hospital: string;
  notes: string;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface PatientProfile {
  id: string;
  verificationStatus?: 'VERIFIED' | 'TAMPERED';
  blockchainHash?: string;
  updatedAt?: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  fullName: string;
  profileImage?: string;
  dateOfBirth?: string;
  gender?: string;
  patientProfile: {
    bloodType?: string;
    allergies?: Allergy[];
    currentMedications?: Medication[];
    previousSurgeries?: Surgery[];
    chronicConditions?: string[];
    address?: Address;
    emergencyContacts?: EmergencyContact[];
    insuranceProvider?: string;
    insurancePolicyNumber?: string;
    emergencySettings?: {
      accessDuration: number;
    };
  };
}

interface CompletionStatus {
  percentage: number;
  completed: string[];
  missing: string[];
  isComplete: boolean;
}

export default function PatientProfilePage() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'basic' | 'health' | 'emergency' | 'settings'>('basic');
  const [editMode, setEditMode] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    bloodType: '',
    chronicConditions: [] as string[],
    allergies: [] as Allergy[],
    currentMedications: [] as Medication[],
    previousSurgeries: [] as Surgery[],
    emergencyContacts: [] as EmergencyContact[],
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'India'
    },
    insuranceProvider: '',
    insurancePolicyNumber: ''
  });

  // Temp inputs for array fields
  const [newCondition, setNewCondition] = useState('');
  const [newAllergy, setNewAllergy] = useState<Allergy>({ allergen: '', severity: 'mild', reaction: '' });
  const [newMedication, setNewMedication] = useState<Medication>({ name: '', dosage: '', frequency: '', prescribedFor: '', startDate: '' });
  const [newSurgery, setNewSurgery] = useState<Surgery>({ name: '', date: '', hospital: '', notes: '' });
  const [newContact, setNewContact] = useState<EmergencyContact>({ name: '', relationship: '', phone: '', isPrimary: false });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/profile/patient');
      if (response.data.success) {
        setProfile(response.data.data.profile);
        setCompletionStatus(response.data.data.completionStatus);
        
        // Populate form data
        const p = response.data.data.profile;
        setFormData({
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          dateOfBirth: p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '',
          gender: p.gender || '',
          phone: p.phone || '',
          bloodType: p.patientProfile?.bloodType || '',
          chronicConditions: p.patientProfile?.chronicConditions || [],
          allergies: p.patientProfile?.allergies || [],
          currentMedications: p.patientProfile?.currentMedications || [],
          previousSurgeries: p.patientProfile?.previousSurgeries || [],
          emergencyContacts: p.patientProfile?.emergencyContacts || [],
          address: p.patientProfile?.address || { street: '', city: '', state: '', zipCode: '', country: 'India' },
          insuranceProvider: p.patientProfile?.insuranceProvider || '',
          insurancePolicyNumber: p.patientProfile?.insurancePolicyNumber || ''
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      const response = await api.put('/profile/patient', formData);
      
      if (response.data.success) {
        setProfile(response.data.data.profile);
        setCompletionStatus(response.data.data.completionStatus);
        setSuccess('Profile saved successfully!');
        setEditMode(false);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Array field handlers
  const addCondition = () => {
    if (newCondition.trim()) {
      setFormData(prev => ({
        ...prev,
        chronicConditions: [...prev.chronicConditions, newCondition.trim()]
      }));
      setNewCondition('');
    }
  };

  const removeCondition = (index: number) => {
    setFormData(prev => ({
      ...prev,
      chronicConditions: prev.chronicConditions.filter((_, i) => i !== index)
    }));
  };

  const addAllergy = () => {
    if (newAllergy.allergen.trim()) {
      setFormData(prev => ({
        ...prev,
        allergies: [...prev.allergies, { ...newAllergy }]
      }));
      setNewAllergy({ allergen: '', severity: 'mild', reaction: '' });
    }
  };

  const removeAllergy = (index: number) => {
    setFormData(prev => ({
      ...prev,
      allergies: prev.allergies.filter((_, i) => i !== index)
    }));
  };

  const addMedication = () => {
    if (newMedication.name.trim()) {
      setFormData(prev => ({
        ...prev,
        currentMedications: [...prev.currentMedications, { ...newMedication }]
      }));
      setNewMedication({ name: '', dosage: '', frequency: '', prescribedFor: '', startDate: '' });
    }
  };

  const removeMedication = (index: number) => {
    setFormData(prev => ({
      ...prev,
      currentMedications: prev.currentMedications.filter((_, i) => i !== index)
    }));
  };

  const addSurgery = () => {
    if (newSurgery.name.trim()) {
      setFormData(prev => ({
        ...prev,
        previousSurgeries: [...prev.previousSurgeries, { ...newSurgery }]
      }));
      setNewSurgery({ name: '', date: '', hospital: '', notes: '' });
    }
  };

  const removeSurgery = (index: number) => {
    setFormData(prev => ({
      ...prev,
      previousSurgeries: prev.previousSurgeries.filter((_, i) => i !== index)
    }));
  };

  const addContact = () => {
    if (newContact.name.trim() && newContact.phone.trim()) {
      setFormData(prev => ({
        ...prev,
        emergencyContacts: [...prev.emergencyContacts, { ...newContact }]
      }));
      setNewContact({ name: '', relationship: '', phone: '', isPrimary: false });
    }
  };

  const removeContact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.filter((_, i) => i !== index)
    }));
  };

  const setPrimaryContact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map((c, i) => ({
        ...c,
        isPrimary: i === index
      }))
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600">Manage your personal and health information</p>
          <p className="text-xs text-gray-500 mt-1">
            Last Modified: {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'N/A'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono select-all">
            User ID: {profile?.id || '—'}
          </p>
          {profile?.verificationStatus && (
            profile.verificationStatus === 'VERIFIED' ? (
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                ✅ Blockchain Verified
              </span>
            ) : (
              <div className="mt-2 p-3 bg-red-50 border border-red-300 rounded-lg">
                <p className="text-sm font-bold text-red-700 flex items-center gap-1">
                  🚨 TAMPERED — Blockchain Integrity Violation
                </p>
                <p className="text-xs text-red-600 mt-1">
                  The following fields no longer match the immutable record on Polygon blockchain:
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {['Name', 'Email', 'Phone', 'Date of Birth', 'Gender', 'Blood Type', 'Allergies', 'Medications', 'Conditions'].map(f => (
                    <span key={f} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium border border-red-200">
                      ⚠ {f}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-red-500 mt-2">
                  Chain hash: <code className="font-mono">{profile.blockchainHash?.slice(0, 20)}...</code>
                </p>
              </div>
            )
          )}
        </div>
        {!editMode ? (
          <button
            onClick={() => setEditMode(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditMode(false);
                fetchProfile(); // Reset changes
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Profile Completion */}
      {completionStatus && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Profile Completion</span>
            <span className={`font-bold ${completionStatus.percentage >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
              {completionStatus.percentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${completionStatus.percentage >= 80 ? 'bg-green-600' : 'bg-orange-600'}`}
              style={{ width: `${completionStatus.percentage}%` }}
            ></div>
          </div>
          {completionStatus.missing.length > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Missing: {completionStatus.missing.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
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
          {(['basic', 'health', 'emergency', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'basic' ? 'Basic Info' : tab === 'health' ? 'Health Info' : tab === 'emergency' ? 'Emergency Contacts' : 'Settings'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={e => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                <select
                  value={formData.gender}
                  onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type *</label>
                <select
                  value={formData.bloodType}
                  onChange={e => setFormData(prev => ({ ...prev, bloodType: e.target.value }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select blood type</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Address *</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <input
                    type="text"
                    placeholder="Street Address"
                    value={formData.address.street}
                    onChange={e => setFormData(prev => ({ 
                      ...prev, 
                      address: { ...prev.address, street: e.target.value }
                    }))}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
                <input
                  type="text"
                  placeholder="City"
                  value={formData.address.city}
                  onChange={e => setFormData(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, city: e.target.value }
                  }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={formData.address.state}
                  onChange={e => setFormData(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, state: e.target.value }
                  }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <input
                  type="text"
                  placeholder="ZIP Code"
                  value={formData.address.zipCode}
                  onChange={e => setFormData(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, zipCode: e.target.value }
                  }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <input
                  type="text"
                  placeholder="Country"
                  value={formData.address.country}
                  onChange={e => setFormData(prev => ({ 
                    ...prev, 
                    address: { ...prev.address, country: e.target.value }
                  }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Insurance */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Insurance (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Insurance Provider"
                  value={formData.insuranceProvider}
                  onChange={e => setFormData(prev => ({ ...prev, insuranceProvider: e.target.value }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <input
                  type="text"
                  placeholder="Policy Number"
                  value={formData.insurancePolicyNumber}
                  onChange={e => setFormData(prev => ({ ...prev, insurancePolicyNumber: e.target.value }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>
          </div>
        )}

        {/* Health Info Tab */}
        {activeTab === 'health' && (
          <div className="space-y-8">
            {/* Chronic Conditions */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Chronic Conditions</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.chronicConditions.map((condition, i) => (
                  <span key={i} className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                    {condition}
                    {editMode && (
                      <button onClick={() => removeCondition(i)} className="ml-2 text-purple-600 hover:text-purple-800">×</button>
                    )}
                  </span>
                ))}
              </div>
              {editMode && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add condition (e.g., Diabetes, Hypertension)"
                    value={newCondition}
                    onChange={e => setNewCondition(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addCondition())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={addCondition} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Add</button>
                </div>
              )}
            </div>

            {/* Allergies */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Allergies</h3>
              <div className="space-y-2 mb-3">
                {formData.allergies.map((allergy, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div>
                      <span className="font-medium text-red-800">{allergy.allergen}</span>
                      <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                        allergy.severity === 'life-threatening' ? 'bg-red-600 text-white' :
                        allergy.severity === 'severe' ? 'bg-red-500 text-white' :
                        allergy.severity === 'moderate' ? 'bg-orange-500 text-white' :
                        'bg-yellow-400 text-gray-800'
                      }`}>
                        {allergy.severity}
                      </span>
                      {allergy.reaction && <p className="text-sm text-red-600 mt-1">Reaction: {allergy.reaction}</p>}
                    </div>
                    {editMode && (
                      <button onClick={() => removeAllergy(i)} className="text-red-600 hover:text-red-800">Remove</button>
                    )}
                  </div>
                ))}
              </div>
              {editMode && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Allergen"
                    value={newAllergy.allergen}
                    onChange={e => setNewAllergy(prev => ({ ...prev, allergen: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <select
                    value={newAllergy.severity}
                    onChange={e => setNewAllergy(prev => ({ ...prev, severity: e.target.value as Allergy['severity'] }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                    <option value="life-threatening">Life-threatening</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Reaction"
                    value={newAllergy.reaction}
                    onChange={e => setNewAllergy(prev => ({ ...prev, reaction: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button onClick={addAllergy} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Add</button>
                </div>
              )}
            </div>

            {/* Current Medications */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Current Medications</h3>
              <div className="space-y-2 mb-3">
                {formData.currentMedications.map((med, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <span className="font-medium text-blue-800">{med.name}</span>
                      {med.dosage && <span className="text-blue-600 ml-2">{med.dosage}</span>}
                      {med.frequency && <span className="text-blue-600 ml-2">({med.frequency})</span>}
                      {med.prescribedFor && <p className="text-sm text-blue-600 mt-1">For: {med.prescribedFor}</p>}
                    </div>
                    {editMode && (
                      <button onClick={() => removeMedication(i)} className="text-blue-600 hover:text-blue-800">Remove</button>
                    )}
                  </div>
                ))}
              </div>
              {editMode && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <input
                    type="text"
                    placeholder="Medication name"
                    value={newMedication.name}
                    onChange={e => setNewMedication(prev => ({ ...prev, name: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Dosage"
                    value={newMedication.dosage}
                    onChange={e => setNewMedication(prev => ({ ...prev, dosage: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Frequency"
                    value={newMedication.frequency}
                    onChange={e => setNewMedication(prev => ({ ...prev, frequency: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Prescribed for"
                    value={newMedication.prescribedFor}
                    onChange={e => setNewMedication(prev => ({ ...prev, prescribedFor: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button onClick={addMedication} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add</button>
                </div>
              )}
            </div>

            {/* Previous Surgeries */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Previous Surgeries</h3>
              <div className="space-y-2 mb-3">
                {formData.previousSurgeries.map((surgery, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div>
                      <span className="font-medium text-amber-800">{surgery.name}</span>
                      {surgery.date && <span className="text-amber-600 ml-2">({new Date(surgery.date).toLocaleDateString()})</span>}
                      {surgery.hospital && <p className="text-sm text-amber-600 mt-1">At: {surgery.hospital}</p>}
                      {surgery.notes && <p className="text-sm text-amber-600">{surgery.notes}</p>}
                    </div>
                    {editMode && (
                      <button onClick={() => removeSurgery(i)} className="text-amber-600 hover:text-amber-800">Remove</button>
                    )}
                  </div>
                ))}
              </div>
              {editMode && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <input
                    type="text"
                    placeholder="Surgery name"
                    value={newSurgery.name}
                    onChange={e => setNewSurgery(prev => ({ ...prev, name: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="date"
                    value={newSurgery.date}
                    onChange={e => setNewSurgery(prev => ({ ...prev, date: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Hospital"
                    value={newSurgery.hospital}
                    onChange={e => setNewSurgery(prev => ({ ...prev, hospital: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Notes"
                    value={newSurgery.notes}
                    onChange={e => setNewSurgery(prev => ({ ...prev, notes: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button onClick={addSurgery} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700">Add</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Emergency Contacts Tab */}
        {activeTab === 'emergency' && (
          <div className="space-y-6">
            <p className="text-gray-600 mb-4">
              Add emergency contacts who can be reached in case of a medical emergency.
            </p>
            
            <div className="space-y-3">
              {formData.emergencyContacts.map((contact, i) => (
                <div key={i} className={`flex items-center justify-between p-4 rounded-lg border ${
                  contact.isPrimary ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center text-xl font-bold text-gray-600">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{contact.name}</span>
                        {contact.isPrimary && (
                          <span className="px-2 py-0.5 text-xs bg-green-600 text-white rounded">Primary</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{contact.relationship}</p>
                      <p className="text-sm text-gray-800">{contact.phone}</p>
                    </div>
                  </div>
                  {editMode && (
                    <div className="flex gap-2">
                      {!contact.isPrimary && (
                        <button 
                          onClick={() => setPrimaryContact(i)}
                          className="text-sm text-green-600 hover:text-green-800"
                        >
                          Set Primary
                        </button>
                      )}
                      <button onClick={() => removeContact(i)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {editMode && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Add Emergency Contact</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newContact.name}
                    onChange={e => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Relationship (e.g., Spouse, Parent)"
                    value={newContact.relationship}
                    onChange={e => setNewContact(prev => ({ ...prev, relationship: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={newContact.phone}
                    onChange={e => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button onClick={addContact} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    Add Contact
                  </button>
                </div>
              </div>
            )}

            {formData.emergencyContacts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No emergency contacts added yet.</p>
                <p className="text-sm">Add at least one emergency contact for safety.</p>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-2">Emergency QR Access</h3>
              <p className="text-sm text-blue-600 mb-3">
                Configure how long hospitals can access your emergency data after scanning your QR code.
              </p>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Access Duration:</label>
                <select
                  value={profile?.patientProfile?.emergencySettings?.accessDuration || 30}
                  disabled={!editMode}
                  onChange={async (e) => {
                    try {
                      await api.patch('/emergency/settings', { accessDuration: parseInt(e.target.value) });
                      fetchProfile();
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                >
                  <option value="5">5 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-800 mb-2">Data Sharing</h3>
              <p className="text-sm text-gray-600">
                Control what information is shared during emergency access. Currently all critical health
                data (blood type, allergies, medications, emergency contacts) is shared.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
