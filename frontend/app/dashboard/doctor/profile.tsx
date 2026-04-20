'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/authService';
import QRCode from 'qrcode';

interface Qualification {
  degree: string;
  institution: string;
  year: number;
}

interface Certificate {
  title: string;
  issuingOrganization: string;
  issueDate: string;
  expiryDate?: string;
  certificateUrl?: string;
  verificationUrl?: string;
}

interface Achievement {
  title: string;
  description: string;
  date: string;
  category: 'award' | 'publication' | 'research' | 'fellowship' | 'other';
}

interface ProfileSettings {
  isPublic: boolean;
  showEmail: boolean;
  showPhone: boolean;
  shareableSlug?: string;
}

interface DoctorProfile {
  id: string;
  verificationStatus?: 'VERIFIED' | 'TAMPERED';
  updatedAt?: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  fullName: string;
  profileImage?: string;
  gender?: string;
  doctorProfile: {
    licenseNumber?: string;
    licenseState?: string;
    licenseExpiry?: string;
    specializations: string[];
    qualifications: Qualification[];
    yearsOfExperience?: number;
    bio?: string;
    certificates: Certificate[];
    achievements: Achievement[];
    consultationFee?: number;
    languages: string[];
    profileSettings?: ProfileSettings;
    offersOnlineConsultation?: boolean;
    onlineConsultationFee?: number;
  };
}

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'basic' | 'credentials' | 'achievements' | 'sharing'>('basic');
  const [editMode, setEditMode] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareQrImage, setShareQrImage] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    phone: '',
    licenseNumber: '',
    licenseState: '',
    licenseExpiry: '',
    specializations: [] as string[],
    qualifications: [] as Qualification[],
    yearsOfExperience: 0,
    bio: '',
    certificates: [] as Certificate[],
    achievements: [] as Achievement[],
    consultationFee: 0,
    languages: [] as string[],
    offersOnlineConsultation: false,
    onlineConsultationFee: 0,
    profileSettings: {
      isPublic: true,
      showEmail: false,
      showPhone: false
    }
  });

  // Temp inputs
  const [newSpecialization, setNewSpecialization] = useState('');
  const [newLanguage, setNewLanguage] = useState('');
  const [newQualification, setNewQualification] = useState<Qualification>({ degree: '', institution: '', year: new Date().getFullYear() });
  const [newCertificate, setNewCertificate] = useState<Certificate>({ title: '', issuingOrganization: '', issueDate: '' });
  const [newAchievement, setNewAchievement] = useState<Achievement>({ title: '', description: '', date: '', category: 'award' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching doctor profile...');
      const response = await api.get('/profile/doctor');
      console.log('✅ Profile loaded:', response.data);
      
      if (response.data.success) {
        const p = response.data.data.profile;
        setProfile(p);
        
        setFormData({
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          gender: p.gender || '',
          phone: p.phone || '',
          licenseNumber: p.doctorProfile?.licenseNumber || '',
          licenseState: p.doctorProfile?.licenseState || '',
          licenseExpiry: p.doctorProfile?.licenseExpiry ? p.doctorProfile.licenseExpiry.split('T')[0] : '',
          specializations: p.doctorProfile?.specializations || [],
          qualifications: p.doctorProfile?.qualifications || [],
          yearsOfExperience: p.doctorProfile?.yearsOfExperience || 0,
          bio: p.doctorProfile?.bio || '',
          certificates: p.doctorProfile?.certificates || [],
          achievements: p.doctorProfile?.achievements || [],
          consultationFee: p.doctorProfile?.consultationFee || 0,
          languages: p.doctorProfile?.languages || [],
          offersOnlineConsultation: p.doctorProfile?.offersOnlineConsultation || false,
          onlineConsultationFee: p.doctorProfile?.onlineConsultationFee || 0,
          profileSettings: p.doctorProfile?.profileSettings || { isPublic: true, showEmail: false, showPhone: false }
        });

        // Generate share URL if slug exists
        if (p.doctorProfile?.profileSettings?.shareableSlug) {
          const url = `${window.location.origin}/doctor/${p.doctorProfile.profileSettings.shareableSlug}`;
          setShareUrl(url);
          generateQrForUrl(url);
        }
      }
    } catch (err: any) {
      console.error('❌ Profile fetch error:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });
      setError(err.response?.data?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const generateQrForUrl = async (url: string) => {
    const qr = await QRCode.toDataURL(url, { width: 200 });
    setShareQrImage(qr);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const response = await api.put('/profile/doctor', formData);
      
      if (response.data.success) {
        setProfile(response.data.data.profile);
        setSuccess('Profile saved successfully!');
        setEditMode(false);
        setTimeout(() => setSuccess(''), 3000);

        // Auto-regenerate the shareable link/QR whenever profile is saved
        try {
          const slugRes = await api.post('/profile/doctor/generate-slug');
          if (slugRes.data.success) {
            setShareUrl(slugRes.data.data.shareUrl);
            generateQrForUrl(slugRes.data.data.shareUrl);
          }
        } catch { /* non-fatal */ }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const generateShareableLink = async () => {
    try {
      const response = await api.post('/profile/doctor/generate-slug');
      if (response.data.success) {
        setShareUrl(response.data.data.shareUrl);
        generateQrForUrl(response.data.data.shareUrl);
        setSuccess('Shareable link generated!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate link');
    }
  };

  // Array handlers
  const addSpecialization = () => {
    if (newSpecialization.trim() && !formData.specializations.includes(newSpecialization.trim())) {
      setFormData(prev => ({
        ...prev,
        specializations: [...prev.specializations, newSpecialization.trim()]
      }));
      setNewSpecialization('');
    }
  };

  const removeSpecialization = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.filter((_, i) => i !== index)
    }));
  };

  const addLanguage = () => {
    if (newLanguage.trim() && !formData.languages.includes(newLanguage.trim())) {
      setFormData(prev => ({
        ...prev,
        languages: [...prev.languages, newLanguage.trim()]
      }));
      setNewLanguage('');
    }
  };

  const removeLanguage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index)
    }));
  };

  const addQualification = () => {
    if (newQualification.degree.trim() && newQualification.institution.trim()) {
      setFormData(prev => ({
        ...prev,
        qualifications: [...prev.qualifications, { ...newQualification }]
      }));
      setNewQualification({ degree: '', institution: '', year: new Date().getFullYear() });
    }
  };

  const removeQualification = (index: number) => {
    setFormData(prev => ({
      ...prev,
      qualifications: prev.qualifications.filter((_, i) => i !== index)
    }));
  };

  const addCertificate = () => {
    if (newCertificate.title.trim()) {
      setFormData(prev => ({
        ...prev,
        certificates: [...prev.certificates, { ...newCertificate }]
      }));
      setNewCertificate({ title: '', issuingOrganization: '', issueDate: '' });
    }
  };

  const removeCertificate = (index: number) => {
    setFormData(prev => ({
      ...prev,
      certificates: prev.certificates.filter((_, i) => i !== index)
    }));
  };

  const addAchievement = () => {
    if (newAchievement.title.trim()) {
      setFormData(prev => ({
        ...prev,
        achievements: [...prev.achievements, { ...newAchievement }]
      }));
      setNewAchievement({ title: '', description: '', date: '', category: 'award' });
    }
  };

  const removeAchievement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      achievements: prev.achievements.filter((_, i) => i !== index)
    }));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'award': return '🏆';
      case 'publication': return '📚';
      case 'research': return '🔬';
      case 'fellowship': return '🎓';
      default: return '⭐';
    }
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
          <p className="text-gray-600">Manage your professional profile</p>
          <p className="text-xs text-gray-500 mt-1">
            Last Modified: {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'N/A'}
          </p>
          {profile?.verificationStatus && (
            <span className={`inline-flex mt-2 px-2 py-1 rounded text-xs font-semibold ${
              profile.verificationStatus === 'VERIFIED'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {profile.verificationStatus}
            </span>
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
              onClick={() => { setEditMode(false); fetchProfile(); }}
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
          {[
            { key: 'basic', label: 'Basic Info' },
            { key: 'credentials', label: 'Credentials' },
            { key: 'achievements', label: 'Achievements' },
            { key: 'sharing', label: 'Share Profile' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-3 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
                <input
                  type="number"
                  value={formData.yearsOfExperience}
                  onChange={e => setFormData(prev => ({ ...prev, yearsOfExperience: parseInt(e.target.value) || 0 }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Fee (₹)</label>
                <input
                  type="number"
                  value={formData.consultationFee}
                  onChange={e => setFormData(prev => ({ ...prev, consultationFee: parseInt(e.target.value) || 0 }))}
                  disabled={!editMode}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Online Consultation Settings */}
            <div className="rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Consultation Mode</h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.offersOnlineConsultation}
                  onChange={e => setFormData(prev => ({ ...prev, offersOnlineConsultation: e.target.checked }))}
                  disabled={!editMode}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">💻 I offer online consultations (telemedicine)</span>
              </label>
              {formData.offersOnlineConsultation && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Online Consultation Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.onlineConsultationFee}
                    onChange={e => setFormData(prev => ({ ...prev, onlineConsultationFee: parseInt(e.target.value) || 0 }))}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    placeholder="e.g. 500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Shown to patients when booking online appointments</p>
                </div>
              )}
              {!formData.offersOnlineConsultation && !editMode && (
                <p className="text-xs text-gray-400">Online consultations not offered — only in-person bookings available</p>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={formData.bio}
                onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                disabled={!editMode}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                placeholder="Tell patients about yourself..."
              />
            </div>

            {/* Specializations */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Specializations</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.specializations.map((spec, i) => (
                  <span key={i} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                    {spec}
                    {editMode && (
                      <button onClick={() => removeSpecialization(i)} className="ml-2 text-blue-600">×</button>
                    )}
                  </span>
                ))}
              </div>
              {editMode && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSpecialization}
                    onChange={e => setNewSpecialization(e.target.value)}
                    placeholder="Add specialization"
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button onClick={addSpecialization} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Add</button>
                </div>
              )}
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Languages</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.languages.map((lang, i) => (
                  <span key={i} className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full">
                    {lang}
                    {editMode && (
                      <button onClick={() => removeLanguage(i)} className="ml-2 text-green-600">×</button>
                    )}
                  </span>
                ))}
              </div>
              {editMode && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLanguage}
                    onChange={e => setNewLanguage(e.target.value)}
                    placeholder="Add language"
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button onClick={addLanguage} className="px-4 py-2 bg-green-600 text-white rounded-lg">Add</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credentials Tab */}
        {activeTab === 'credentials' && (
          <div className="space-y-8">
            {/* License Info */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Medical License</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={e => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State/Region</label>
                  <input
                    type="text"
                    value={formData.licenseState}
                    onChange={e => setFormData(prev => ({ ...prev, licenseState: e.target.value }))}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={formData.licenseExpiry}
                    onChange={e => setFormData(prev => ({ ...prev, licenseExpiry: e.target.value }))}
                    disabled={!editMode}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* Qualifications */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Qualifications</h3>
              <div className="space-y-3 mb-4">
                {formData.qualifications.map((qual, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{qual.degree}</p>
                      <p className="text-sm text-gray-600">{qual.institution}, {qual.year}</p>
                    </div>
                    {editMode && (
                      <button onClick={() => removeQualification(i)} className="text-red-600">Remove</button>
                    )}
                  </div>
                ))}
              </div>
              {editMode && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Degree (e.g., MBBS)"
                    value={newQualification.degree}
                    onChange={e => setNewQualification(prev => ({ ...prev, degree: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Institution"
                    value={newQualification.institution}
                    onChange={e => setNewQualification(prev => ({ ...prev, institution: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Year"
                    value={newQualification.year}
                    onChange={e => setNewQualification(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button onClick={addQualification} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Add</button>
                </div>
              )}
            </div>

            {/* Certificates */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4">Certificates</h3>
              <div className="space-y-3 mb-4">
                {formData.certificates.map((cert, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div>
                      <p className="font-medium">📜 {cert.title}</p>
                      <p className="text-sm text-gray-600">
                        {cert.issuingOrganization} • {cert.issueDate && new Date(cert.issueDate).getFullYear()}
                      </p>
                    </div>
                    {editMode && (
                      <button onClick={() => removeCertificate(i)} className="text-red-600">Remove</button>
                    )}
                  </div>
                ))}
              </div>
              {editMode && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Certificate Title"
                    value={newCertificate.title}
                    onChange={e => setNewCertificate(prev => ({ ...prev, title: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Issuing Organization"
                    value={newCertificate.issuingOrganization}
                    onChange={e => setNewCertificate(prev => ({ ...prev, issuingOrganization: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="date"
                    placeholder="Issue Date"
                    value={newCertificate.issueDate}
                    onChange={e => setNewCertificate(prev => ({ ...prev, issueDate: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button onClick={addCertificate} className="px-4 py-2 bg-yellow-600 text-white rounded-lg">Add</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <div className="space-y-6">
            <div className="space-y-3 mb-4">
              {formData.achievements.map((ach, i) => (
                <div key={i} className="flex items-start justify-between p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getCategoryIcon(ach.category)}</span>
                    <div>
                      <p className="font-medium">{ach.title}</p>
                      <p className="text-sm text-gray-600">{ach.description}</p>
                      <p className="text-xs text-purple-600 mt-1">
                        {ach.category} • {ach.date && new Date(ach.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {editMode && (
                    <button onClick={() => removeAchievement(i)} className="text-red-600">Remove</button>
                  )}
                </div>
              ))}
            </div>

            {editMode && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Add Achievement</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Title"
                    value={newAchievement.title}
                    onChange={e => setNewAchievement(prev => ({ ...prev, title: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <select
                    value={newAchievement.category}
                    onChange={e => setNewAchievement(prev => ({ ...prev, category: e.target.value as Achievement['category'] }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="award">Award</option>
                    <option value="publication">Publication</option>
                    <option value="research">Research</option>
                    <option value="fellowship">Fellowship</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="date"
                    value={newAchievement.date}
                    onChange={e => setNewAchievement(prev => ({ ...prev, date: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={newAchievement.description}
                    onChange={e => setNewAchievement(prev => ({ ...prev, description: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button onClick={addAchievement} className="px-4 py-2 bg-purple-600 text-white rounded-lg">Add Achievement</button>
              </div>
            )}

            {formData.achievements.length === 0 && !editMode && (
              <div className="text-center py-8 text-gray-500">
                <p>No achievements added yet.</p>
              </div>
            )}
          </div>
        )}

        {/* Sharing Tab */}
        {activeTab === 'sharing' && (
          <div className="space-y-6">
            {/* Visibility Settings */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-800 mb-3">Profile Visibility</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.profileSettings.isPublic}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      profileSettings: { ...prev.profileSettings, isPublic: e.target.checked }
                    }))}
                    disabled={!editMode}
                    className="w-4 h-4"
                  />
                  <span>Public Profile (anyone with link can view)</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.profileSettings.showEmail}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      profileSettings: { ...prev.profileSettings, showEmail: e.target.checked }
                    }))}
                    disabled={!editMode}
                    className="w-4 h-4"
                  />
                  <span>Show email on public profile</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.profileSettings.showPhone}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      profileSettings: { ...prev.profileSettings, showPhone: e.target.checked }
                    }))}
                    disabled={!editMode}
                    className="w-4 h-4"
                  />
                  <span>Show phone on public profile</span>
                </label>
              </div>
            </div>

            {/* Share Link & QR */}
            <div className="p-6 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-4">Share Your Profile</h3>
              
              {shareUrl ? (
                <div className="space-y-4">
                  {/* Link row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => { navigator.clipboard.writeText(shareUrl); setSuccess('Link copied!'); setTimeout(() => setSuccess(''), 2000); }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap"
                    >
                      Copy Link
                    </button>
                  </div>

                  {/* QR code */}
                  {shareQrImage && (
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-white rounded-lg shadow">
                        <img src={shareQrImage} alt="Profile QR Code" className="w-48 h-48" />
                        <p className="text-center text-sm text-gray-500 mt-2">Scan to view profile</p>
                      </div>
                      <a
                        href={shareQrImage}
                        download="medchain-doctor-profile-qr.png"
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        ⬇ Download QR Code
                      </a>
                    </div>
                  )}

                  {/* Regenerate button — always visible */}
                  <div className="pt-2 border-t border-gray-200 text-center">
                    <p className="text-xs text-gray-500 mb-2">Profile updated? Regenerate to refresh the link.</p>
                    <button
                      onClick={generateShareableLink}
                      className="px-5 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm"
                    >
                      🔄 Regenerate Link & QR
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">Generate a shareable link and QR code for your profile</p>
                  <button
                    onClick={generateShareableLink}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Generate Shareable Link & QR
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
