'use client';

import { useState, useRef, useEffect } from 'react';
import emailjs from '@emailjs/browser';
import { useAuth } from '@/contexts/AuthContext';

// ── EmailJS config ─────────────────────────────────────────────────────────
// Set these in frontend/.env.local:
//   NEXT_PUBLIC_EMAILJS_SERVICE_ID=service_xxxxxxx
//   NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=template_xxxxxxx
//   NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxx
const SERVICE_ID  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID  || '';
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '';
const PUBLIC_KEY  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY  || '';

type FormType = 'feedback' | 'complaint' | 'tamper_report' | 'other';

interface FormData {
  type: FormType;
  subject: string;
  senderName: string;
  senderEmail: string;
  senderRole: string;
  userId: string;
  affectedEntity: string;
  affectedEntityId: string;
  description: string;
  expectedBehavior: string;
  screenshot: string; // base64 data URL
  screenshotName: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  browserInfo: string;
  timestamp: string;
}

const TYPE_LABELS: Record<FormType, string> = {
  feedback:      '💬 General Feedback',
  complaint:     '⚠️ Complaint',
  tamper_report: '🚨 Data Tamper Report',
  other:         '📝 Other'
};

const ENTITY_TYPES = [
  'User Profile', 'Medical Record', 'Prescription', 'Appointment',
  'Consultation', 'Emergency QR', 'Hospital Profile', 'Doctor Registry', 'Other'
];

export default function SupportPage() {
  const { user } = useAuth();

  const [form, setForm] = useState<FormData>({
    type: 'feedback',
    subject: '',
    senderName: '',
    senderEmail: '',
    senderRole: '',
    userId: '',
    affectedEntity: '',
    affectedEntityId: '',
    description: '',
    expectedBehavior: '',
    screenshot: '',
    screenshotName: '',
    priority: 'medium',
    browserInfo: typeof window !== 'undefined'
      ? `${navigator.userAgent.split(') ')[0]})` : '',
    timestamp: new Date().toISOString()
  });

  // Autofill from auth context whenever user loads
  useEffect(() => {
    if (!user) return;
    setForm(prev => ({
      ...prev,
      senderName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || prev.senderName,
      senderEmail: user.email || prev.senderEmail,
      senderRole: user.role || prev.senderRole,
      userId: user.id || prev.userId,
    }));
  }, [user]);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Convert screenshot to base64
  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Screenshot must be under 5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set('screenshot', reader.result as string);
      set('screenshotName', file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.senderName || !form.senderEmail || !form.description) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
      setError('EmailJS is not configured. Please add NEXT_PUBLIC_EMAILJS_* env vars.');
      return;
    }

    setSending(true);
    try {
      // Upload screenshot via backend (uses existing Cloudinary credentials)
      let screenshotUrl = 'No screenshot attached';
      if (form.screenshot && form.screenshotName) {
        try {
          const API = process.env.NEXT_PUBLIC_API_URL || 'https://medchain-x96u.onrender.com/api';
          // Convert base64 back to blob
          const res = await fetch(form.screenshot);
          const blob = await res.blob();
          const fd = new FormData();
          fd.append('screenshot', blob, form.screenshotName);

          const token = sessionStorage.getItem('accessToken');
          const uploadRes = await fetch(`${API}/support/upload-screenshot`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd
          });
          const data = await uploadRes.json();
          if (data.success && data.url) screenshotUrl = data.url;
        } catch {
          screenshotUrl = 'Screenshot upload failed';
        }
      }

      await emailjs.send(
        SERVICE_ID,
        TEMPLATE_ID,
        {
          form_type:           TYPE_LABELS[form.type],
          subject:             form.subject || `[${TYPE_LABELS[form.type]}] from ${form.senderName}`,
          sender_name:         form.senderName,
          sender_email:        form.senderEmail,
          sender_role:         form.senderRole || 'Not specified',
          user_id:             form.userId || 'Not provided',
          affected_entity:     form.affectedEntity || 'N/A',
          affected_entity_id:  form.affectedEntityId || 'N/A',
          description:         form.description,
          expected_behavior:   form.expectedBehavior || 'N/A',
          priority:            form.priority.toUpperCase(),
          browser_info:        form.browserInfo,
          timestamp:           new Date().toLocaleString(),
          screenshot_name:     form.screenshotName || 'No screenshot attached',
          screenshot_url:      screenshotUrl || 'No screenshot attached',
        },
        PUBLIC_KEY
      );
      setSent(true);
    } catch (err: any) {
      setError(err?.text || err?.message || 'Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitted Successfully</h2>
        <p className="text-gray-600 mb-2">Your {TYPE_LABELS[form.type].toLowerCase()} has been sent to the MedChain team.</p>
        <p className="text-sm text-gray-500 mb-6">We will respond to <strong>{form.senderEmail}</strong> within 24–48 hours.</p>
        <button
          onClick={() => { setSent(false); setForm(f => ({ ...f, description: '', subject: '', screenshot: '', screenshotName: '', affectedEntityId: '' })); }}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold"
        >
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support & Feedback</h1>
        <p className="text-gray-500 mt-1">
          Report a data integrity issue, lodge a complaint, or send feedback to the MedChain team.
        </p>
      </div>

      {/* Tamper alert banner */}
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
        <p className="font-semibold mb-1">🚨 Detected a TAMPERED record?</p>
        <p>Select <strong>Data Tamper Report</strong> below, fill in the affected entity details, attach a screenshot of the tampered badge, and submit. The MedChain security team will investigate immediately.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">

        {/* Report type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Report Type *</label>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(TYPE_LABELS) as FormType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('type', t)}
                className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                  form.type === t
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Priority *</label>
          <div className="flex gap-3">
            {(['low', 'medium', 'high', 'critical'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => set('priority', p)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium capitalize transition-all ${
                  form.priority === p
                    ? p === 'critical' ? 'border-red-600 bg-red-600 text-white'
                      : p === 'high' ? 'border-orange-500 bg-orange-500 text-white'
                      : p === 'medium' ? 'border-yellow-500 bg-yellow-500 text-white'
                      : 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Sender info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Your Name *</label>
            <input
              type="text"
              value={form.senderName}
              onChange={e => set('senderName', e.target.value)}
              required
              placeholder="Full name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Your Email *</label>
            <input
              type="email"
              value={form.senderEmail}
              onChange={e => set('senderEmail', e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Your Role</label>
            <input
              type="text"
              value={form.senderRole}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Your User ID</label>
            <input
              type="text"
              value={form.userId}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 font-mono text-xs cursor-not-allowed"
            />
          </div>
        </div>

        {/* Affected entity (shown for tamper/complaint) */}
        {(form.type === 'tamper_report' || form.type === 'complaint') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-red-50 rounded-xl border border-red-200">
            <div>
              <label className="block text-sm font-semibold text-red-700 mb-1">Affected Entity Type *</label>
              <select
                value={form.affectedEntity}
                onChange={e => set('affectedEntity', e.target.value)}
                className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white"
              >
                <option value="">Select entity...</option>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-red-700 mb-1">Entity ID / Record ID</label>
              <input
                type="text"
                value={form.affectedEntityId}
                onChange={e => set('affectedEntityId', e.target.value)}
                placeholder="MongoDB _id or record number"
                className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white"
              />
            </div>
          </div>
        )}

        {/* Subject */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Subject</label>
          <input
            type="text"
            value={form.subject}
            onChange={e => set('subject', e.target.value)}
            placeholder="Brief summary of the issue"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Description *
            <span className="text-gray-400 font-normal ml-1">(be as detailed as possible)</span>
          </label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            required
            rows={5}
            placeholder={
              form.type === 'tamper_report'
                ? 'Describe what data was tampered, when you noticed it, what the original value should be, and any other relevant details...'
                : form.type === 'complaint'
                ? 'Describe your complaint in detail, including what happened, when, and who was involved...'
                : 'Describe your feedback or issue...'
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>

        {/* Expected behavior */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            What should have happened? <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={form.expectedBehavior}
            onChange={e => set('expectedBehavior', e.target.value)}
            rows={2}
            placeholder="Describe the expected correct behavior or data..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>

        {/* Screenshot */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Screenshot <span className="text-gray-400 font-normal">(optional, max 5 MB)</span>
          </label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
          >
            {form.screenshot ? (
              <div className="space-y-2">
                <img src={form.screenshot} alt="Screenshot preview" className="max-h-48 mx-auto rounded-lg shadow" />
                <p className="text-sm text-gray-600">{form.screenshotName}</p>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); set('screenshot', ''); set('screenshotName', ''); }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="text-gray-400">
                <svg className="w-10 h-10 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Click to attach a screenshot</p>
                <p className="text-xs mt-1">PNG, JPG, WEBP up to 5 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleScreenshot}
            className="hidden"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={sending}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {sending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Sending...
            </>
          ) : (
            `Submit ${TYPE_LABELS[form.type]}`
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Submissions are sent directly to the MedChain security team at lanishathomas7606@gmail.com
        </p>
      </form>
    </div>
  );
}
