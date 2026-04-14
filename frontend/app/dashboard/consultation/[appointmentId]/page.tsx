'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { consultationService, type ConsultationContext, type JoinResponse } from '@/services/consultationService';
import { authService } from '@/services/authService';

interface MedicineEntry {
  name: string;
  dosage: string;
  notes: string;
}

function deriveAgoraUid(userId: string, appointmentId: string) {
  const numericUserId = Number(userId);
  if (Number.isInteger(numericUserId) && numericUserId > 0) {
    return numericUserId;
  }

  const combined = `${userId}:${appointmentId}`;
  let hash = 0;

  for (let index = 0; index < combined.length; index += 1) {
    hash = (hash * 31 + combined.charCodeAt(index)) >>> 0;
  }

  return Math.max(1, hash % 2147483647);
}

type AgoraClientLike = {
  join: (appId: string, channel: string, token: string, uid: string | number) => Promise<any>;
  leave: () => Promise<void>;
  publish: (tracks: any[]) => Promise<void>;
  subscribe: (user: any, mediaType: 'video' | 'audio') => Promise<void>;
  on: (event: string, handler: (...args: any[]) => void) => void;
};

export default function ConsultationRoomPage() {
  const params = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const appointmentId = String(params?.appointmentId || '');

  const [contextData, setContextData] = useState<ConsultationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  // Removed showAccessPrompt state
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [medicines, setMedicines] = useState<MedicineEntry[]>([{ name: '', dosage: '', notes: '' }]);
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [submittingPrescription, setSubmittingPrescription] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);

  const [agoraClient, setAgoraClient] = useState<AgoraClientLike | null>(null);
  const [localTracks, setLocalTracks] = useState<any[]>([]);

  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const agoraClientRef = useRef<AgoraClientLike | null>(null);
  const localTracksRef = useRef<any[]>([]);
  const localAgoraUidRef = useRef<string | number | null>(null);
  const sessionActiveRef = useRef(false);

  const isDoctor = user?.role === 'doctor';
  const isPatient = user?.role === 'patient';

  const loadContext = async () => {
    if (!appointmentId) return;

    try {
      setLoading(true);
      setError('');
      const data = await consultationService.getContext(appointmentId);
      setContextData(data);

      // No access prompt for patient
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load consultation');
    } finally {
      setLoading(false);
    }
  };

  const LOCAL_VIDEO_ID = 'agora-local-video';

  const renderLocalPreview = async (videoTrack: any) => {
    if (!videoTrack?.play) {
      setHasLocalVideo(false);
      return;
    }
    // Target the static div by ID — Agora owns this node entirely, React never touches it.
    const container = document.getElementById(LOCAL_VIDEO_ID);
    if (!container) {
      setHasLocalVideo(false);
      return;
    }
    try {
      await videoTrack.play(container);
      setTimeout(() => setHasLocalVideo(Boolean(container.querySelector('video'))), 150);
    } catch (err) {
      setHasLocalVideo(false);
      console.warn('Could not render local camera preview:', err);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    loadContext();
  }, [user, appointmentId]);

  useEffect(() => {
    return () => {
      leaveSession(false);
    };
  }, []);

  const startAgoraSession = async (joinData: JoinResponse) => {
    if (joinData.provider === 'demo') {
      setDemoMode(true);
      setJoined(true);
      setHasLocalVideo(false);
      setHasRemoteVideo(false);
      setInfo('Demo consultation mode active. Connect valid Agora credentials to enable live video.');
      return;
    }

    const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    sessionActiveRef.current = true;

    client.on('user-published', async (remoteUser: any, mediaType: 'video' | 'audio') => {
      if (!sessionActiveRef.current) {
        return;
      }

      if (String(remoteUser?.uid) === String(localAgoraUidRef.current)) {
        return;
      }

      if (mediaType === 'video' && remoteUser?.hasVideo === false) {
        return;
      }
      if (mediaType === 'audio' && remoteUser?.hasAudio === false) {
        return;
      }

      try {
        await client.subscribe(remoteUser, mediaType);
      } catch (subscribeError: any) {
        // Ignore transient Agora race conditions from stale publish events.
        return;
      }

      if (mediaType === 'video' && remoteVideoRef.current) {
        try {
          remoteUser.videoTrack?.play(remoteVideoRef.current);
          setHasRemoteVideo(true);
        } catch {
          return;
        }
      }

      if (mediaType === 'audio') {
        try {
          remoteUser.audioTrack?.play();
        } catch {
          return;
        }
      }
    });

    client.on('user-unpublished', () => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.innerHTML = '';
      }
      setHasRemoteVideo(false);
    });

    client.on('user-left', () => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.innerHTML = '';
      }
      setHasRemoteVideo(false);
    });

    const agoraUid = joinData.rtcUid ?? deriveAgoraUid(String(user?.id || ''), appointmentId);
    localAgoraUidRef.current = agoraUid;

    try {
      await client.join(joinData.appId!, joinData.roomId!, joinData.token!, agoraUid);
    } catch (joinErr: any) {
      sessionActiveRef.current = false;
      const msg = joinErr?.message || String(joinErr);
      // WS_ABORT / network errors from Agora — surface cleanly
      throw new Error(`Failed to connect to video session: ${msg}`);
    }

    let tracks: any[];
    try {
      tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
    } catch (mediaErr: any) {
      sessionActiveRef.current = false;
      await client.leave().catch(() => {});
      throw new Error(`Camera/microphone access denied: ${mediaErr?.message || mediaErr}`);
    }
    const audioTrack = tracks[0];
    const videoTrack = tracks[1];

    await client.publish(tracks);

    try {
      await videoTrack.setEnabled(true);
      await renderLocalPreview(videoTrack);
    } catch {
      setHasLocalVideo(false);
      setInfo('Could not render local camera preview. Check camera permission and retry.');
    }

    agoraClientRef.current = client as unknown as AgoraClientLike;
    localTracksRef.current = [audioTrack, videoTrack];
    setAgoraClient(client as unknown as AgoraClientLike);
    setLocalTracks([audioTrack, videoTrack]);
  };

  const joinSession = async () => {
    if (!contextData || joining || joined) return;

    try {
      setJoining(true);
      setError('');
      setInfo('');
      setDemoMode(false);
      setMicMuted(false);
      setCameraOff(false);
      setHasRemoteVideo(false);
      setHasLocalVideo(false);

      let joinData: JoinResponse;

      if (isDoctor) {
        await consultationService.requestConsultationAccess({
          patientId: contextData.appointment.patient.id,
          appointmentId
        });
        joinData = await consultationService.joinAsDoctor(appointmentId);
      } else {
        joinData = await consultationService.joinAsPatient(appointmentId);
      }

      await startAgoraSession(joinData);
      setJoined(true);
      await loadContext();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to join consultation');
    } finally {
      setJoining(false);
    }
  };

  const leaveSession = async (endOnServer: boolean) => {
    try {
      sessionActiveRef.current = false;
      localTracksRef.current.forEach((track: any) => {
        track.stop?.();
        track.close?.();
      });

      if (agoraClientRef.current) {
        await agoraClientRef.current.leave();
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.innerHTML = '';
      }
      // Clear Agora's local video container by ID
      const localEl = document.getElementById('agora-local-video');
      if (localEl) localEl.innerHTML = '';

      setJoined(false);
      setAgoraClient(null);
      setLocalTracks([]);
      setMicMuted(false);
      setCameraOff(false);
      setHasRemoteVideo(false);
      setHasLocalVideo(false);
      localTracksRef.current = [];
      agoraClientRef.current = null;
      localAgoraUidRef.current = null;

      if (endOnServer) {
        await consultationService.endConsultation(appointmentId);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to end consultation');
    }
  };

  const updateMedicine = (index: number, key: keyof MedicineEntry, value: string) => {
    setMedicines((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const addMedicine = () => {
    setMedicines((prev) => [...prev, { name: '', dosage: '', notes: '' }]);
  };

  const removeMedicine = (index: number) => {
    setMedicines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const toggleMic = async () => {
    try {
      const audioTrack = localTracksRef.current[0];
      if (!audioTrack?.setEnabled) {
        setError('Microphone track is not ready yet.');
        return;
      }

      const nextMuted = !micMuted;
      await audioTrack.setEnabled(!nextMuted);
      setMicMuted(nextMuted);
    } catch (toggleError: any) {
      setError(toggleError?.message || 'Unable to toggle microphone');
    }
  };

  const toggleCamera = async () => {
    try {
      const videoTrack = localTracksRef.current[1];
      if (!videoTrack?.setEnabled) {
        setError('Camera track is not ready yet.');
        return;
      }

      const nextOff = !cameraOff;
      await videoTrack.setEnabled(!nextOff);
      setCameraOff(nextOff);

      if (!nextOff) {
        await renderLocalPreview(videoTrack);
      }

      if (nextOff) {
        setHasLocalVideo(false);
      }
    } catch (toggleError: any) {
      setError(toggleError?.message || 'Unable to toggle camera');
    }
  };

  const submitPrescription = async () => {
    if (!contextData) return;

    const normalized = medicines
      .map((item) => ({
        name: item.name.trim(),
        dosage: item.dosage.trim(),
        notes: item.notes.trim()
      }))
      .filter((item) => item.name || item.dosage || item.notes);

    if (normalized.length === 0 || normalized.some((item) => !item.name || !item.dosage)) {
      setError('Each prescription row must include medicine name and dosage.');
      return;
    }

    if (!contextData.appointment.hospital?.id) {
      setError('This appointment has no hospital context required for prescriptions.');
      return;
    }

    try {
      setSubmittingPrescription(true);
      setError('');
      setInfo('');

      await authService.client.post('/prescriptions', {
        patientId: contextData.appointment.patient.id,
        doctorId: contextData.appointment.doctor.id,
        appointmentId,
        hospitalId: contextData.appointment.hospital.id,
        medicines: normalized,
        notes: prescriptionNotes.trim()
      });

      setInfo('Prescription submitted during consultation.');
      setMedicines([{ name: '', dosage: '', notes: '' }]);
      setPrescriptionNotes('');
      await loadContext();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit prescription');
    } finally {
      setSubmittingPrescription(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-600">Loading consultation...</div>;
  }

  if (!contextData) {
    return <div className="p-6 text-red-600">Consultation unavailable.</div>;
  }

  const canSeePatientInfo = contextData.access.medicalRecords || isPatient;

  const sessionBadgeLabel = demoMode ? 'Demo mode' : joined ? 'Live video' : 'Ready';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4 md:p-6">
        <header className="rounded-3xl border border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold md:text-2xl">Consultation Room</h1>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {sessionBadgeLabel}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {contextData.appointment.doctor.name} with {contextData.appointment.patient.name} · Appointment #{contextData.appointment.id.slice(-6)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await leaveSession(true);
                  router.back();
                }}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
              >
                End call
              </button>
            </div>
          </div>
        </header>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{error}</div>}
        {info && <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-700">{info}</div>}



        {!joined && (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={joinSession}
              disabled={joining}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {joining ? 'Joining...' : 'Join call'}
            </button>
          </section>
        )}

        <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="flex min-h-[640px] flex-col gap-4 rounded-[32px] border border-slate-200 bg-[#1f1f1f] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between text-white/80">
              <p className="text-sm">Live session</p>
              <div className="flex items-center gap-2 text-xs">
                <span className={`h-2.5 w-2.5 rounded-full ${joined ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{joined ? 'Connected' : 'Waiting to join'}</span>
              </div>
            </div>

            <div className="relative flex-1 overflow-hidden rounded-[28px] bg-[#111111] ring-1 ring-white/10">
              <div className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                Remote / You
              </div>

              <div className="h-full w-full flex">
                <div className="flex-1 relative bg-[radial-gradient(circle_at_top,rgba(72,187,120,0.14),transparent_40%),linear-gradient(135deg,#101010,#1c1c1c)]">
                  {/* Agora writes remote <video> directly into this div */}
                  <div ref={remoteVideoRef} className="absolute inset-0" />
                  {(!joined || (!demoMode && !hasRemoteVideo) || demoMode) && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/60 pointer-events-none">
                      {!joined && <div className="text-center text-sm">Your call will appear here after joining.</div>}
                      {joined && !demoMode && !hasRemoteVideo && <div className="text-center text-sm">Waiting for the other participant to join.</div>}
                      {joined && demoMode && <div className="text-center text-sm">Demo mode does not stream live video.</div>}
                    </div>
                  )}
                </div>

                <div className="w-1/3 min-w-[260px] flex flex-col gap-2 p-2">
                  <div className="relative h-full rounded-lg bg-[#161616] overflow-hidden">
                    {/* Agora writes its <video> directly into this div — no React children inside */}
                    <div id="agora-local-video" className="absolute inset-0" />
                    {!hasLocalVideo && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-sm text-white/50">Camera preview unavailable</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-white/60 text-right">You</div>
                </div>
              </div>

              {joined && !demoMode && (
                <div className="absolute inset-x-0 bottom-4 flex justify-center">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-2 text-white shadow-2xl backdrop-blur">
                    <button
                      type="button"
                      onClick={toggleMic}
                      disabled={!joined || demoMode || localTracks.length === 0}
                      className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20"
                    >
                      {micMuted ? 'Unmute mic' : 'Mute mic'}
                    </button>
                    <button
                      type="button"
                      onClick={toggleCamera}
                      disabled={!joined || demoMode || localTracks.length < 2}
                      className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white hover:bg-white/20"
                    >
                      {cameraOff ? 'Turn camera on' : 'Turn camera off'}
                    </button>
                  </div>
                </div>
              )}

              {!joined && (
                <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/45 px-5 py-4 text-sm text-white/75 backdrop-blur">
                  Join to start the consultation.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-3xl bg-white px-4 py-3 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Appointment</p>
                <p className="mt-1 font-medium">#{contextData.appointment.id.slice(-6)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Mode</p>
                <p className="mt-1 font-medium">{contextData.appointment.appointmentType}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">State</p>
                <p className="mt-1 font-medium">{joined ? 'In call' : 'Not joined'}</p>
              </div>
            </div>
          </main>

          <aside className="flex flex-col gap-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Patient info</h3>
              {canSeePatientInfo ? (
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><span className="text-slate-500">Name:</span> {contextData.appointment.patient.name}</p>
                  <p><span className="text-slate-500">Email:</span> {contextData.appointment.patient.email || 'N/A'}</p>
                  <p><span className="text-slate-500">Phone:</span> {contextData.appointment.patient.phone || 'N/A'}</p>
                  <p><span className="text-slate-500">Gender:</span> {contextData.appointment.patient.gender || 'N/A'}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-amber-700">
                  Access not granted for patient medical details in this session.
                </p>
              )}
            </section>

            {isDoctor && joined && (
              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Prescription</h3>
                <div className="mt-3 space-y-3">
                  {medicines.map((item, index) => (
                    <div key={index} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <input
                        value={item.name}
                        onChange={(e) => updateMedicine(index, 'name', e.target.value)}
                        placeholder="Medicine name"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                      />
                      <input
                        value={item.dosage}
                        onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                        placeholder="Dosage"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                      />
                      <div className="flex gap-2">
                        <input
                          value={item.notes}
                          onChange={(e) => updateMedicine(index, 'notes', e.target.value)}
                          placeholder="Notes"
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={() => removeMedicine(index)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addMedicine}
                    className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Add medicine
                  </button>

                  <input
                    value={prescriptionNotes}
                    onChange={(e) => setPrescriptionNotes(e.target.value)}
                    placeholder="Prescription notes"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  />

                  <button
                    type="button"
                    onClick={submitPrescription}
                    disabled={submittingPrescription}
                    className="w-full rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {submittingPrescription ? 'Submitting...' : 'Submit prescription'}
                  </button>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
