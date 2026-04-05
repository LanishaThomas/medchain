'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';

/* ───────── Types ───────── */
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  language?: string;
  isFallback?: boolean;
}

type Language = 'en' | 'hi' | 'ta' | 'mr';

/* ───────── Constants ───────── */
const LANGUAGES: Record<Language, { name: string; code: string; flag: string; voiceCode: string }> = {
  en: { name: 'English', code: 'en-US', flag: '🇺🇸', voiceCode: 'en-US' },
  hi: { name: 'हिंदी', code: 'hi-IN', flag: '🇮🇳', voiceCode: 'hi-IN' },
  ta: { name: 'தமிழ்', code: 'ta-IN', flag: '🇮🇳', voiceCode: 'ta-IN' },
  mr: { name: 'मराठी', code: 'mr-IN', flag: '🇮🇳', voiceCode: 'mr-IN' },
};

const QUICK_PROMPTS: Record<Language, Array<{ icon: string; text: string; category: string }>> = {
  en: [
    { icon: '💭', text: "I'm feeling anxious today", category: 'Mental' },
    { icon: '😴', text: "I'm having trouble sleeping", category: 'Sleep' },
    { icon: '🤕', text: 'I have a headache', category: 'Physical' },
    { icon: '🧘', text: 'How can I manage stress?', category: 'Wellness' },
    { icon: '🥗', text: 'Give me healthy diet tips', category: 'Nutrition' },
    { icon: '💪', text: 'Quick home exercises?', category: 'Fitness' },
  ],
  hi: [
    { icon: '💭', text: 'मैं आज चिंतित महसूस कर रहा हूँ', category: 'मानसिक' },
    { icon: '😴', text: 'मुझे नींद आने में परेशानी हो रही है', category: 'नींद' },
    { icon: '🤕', text: 'मुझे सिरदर्द है', category: 'शारीरिक' },
    { icon: '🧘', text: 'तनाव कैसे कम करें?', category: 'कल्याण' },
  ],
  ta: [
    { icon: '💭', text: 'இன்று நான் கவலையாக உணர்கிறேன்', category: 'மனம்' },
    { icon: '😴', text: 'எனக்கு தூங்குவதில் சிரமம்', category: 'தூக்கம்' },
    { icon: '🤕', text: 'எனக்கு தலைவலி உள்ளது', category: 'உடல்' },
    { icon: '🧘', text: 'மன அழுத்தத்தை எப்படி கையாள்வது?', category: 'நலம்' },
  ],
  mr: [
    { icon: '💭', text: 'आज मला चिंता वाटत आहे', category: 'मानसिक' },
    { icon: '😴', text: 'मला झोपायला त्रास होत आहे', category: 'झोप' },
    { icon: '🤕', text: 'मला डोकेदुखी आहे', category: 'शारीरिक' },
    { icon: '🧘', text: 'तणाव कसा कमी करावा?', category: 'कल्याण' },
  ],
};

const WELCOME_MESSAGES: Record<Language, (name: string) => string> = {
  en: (name) =>
    `Hello ${name}! 👋\n\nI'm your **MedChain Health Assistant** — here to support both your physical and mental well-being.\n\nWhether you're dealing with stress, have questions about your health, or just need someone to talk to — I'm here to listen and help.\n\nHow are you feeling today?`,
  hi: (name) =>
    `नमस्ते ${name}! 👋\n\nमैं आपका **मेडचेन स्वास्थ्य सहायक** हूँ। मैं आपकी शारीरिक और मानसिक दोनों तरह की मदद के लिए यहाँ हूँ।\n\nआज आप कैसा महसूस कर रहे हैं?`,
  ta: (name) =>
    `வணக்கம் ${name}! 👋\n\nநான் உங்கள் **MedChain சுகாதார உதவியாளர்**. உடல் மற்றும் மன ஆரோக்கியம் இரண்டிலும் உதவ இங்கே இருக்கிறேன்.\n\nஇன்று நீங்கள் எப்படி உணர்கிறீர்கள்?`,
  mr: (name) =>
    `नमस्कार ${name}! 👋\n\nमी तुमचा **MedChain आरोग्य सहाय्यक** आहे. शारीरिक आणि मानसिक दोन्ही आरोग्यासाठी मदत करण्यासाठी मी इथे आहे.\n\nआज तुम्हाला कसे वाटते?`,
};

/* ───────── Helpers ───────── */
function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function renderContent(text: string) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} style={{ fontWeight: 600, color: '#6d28d9' }}>{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        });

        if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().match(/^\* /)) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginLeft: 4, margin: '3px 0' }}>
              <span style={{ color: '#a78bfa', marginTop: 1, flexShrink: 0 }}>•</span>
              <span>{parts}</span>
            </div>
          );
        }
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        return <div key={i} style={{ margin: '2px 0' }}>{parts}</div>;
      })}
    </>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function ChatbotPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [isClient, setIsClient] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [history, setHistory] = useState<Array<{ role: string; text: string }>>([]);

  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const busyRef = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const scroll = useCallback(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), []);
  useEffect(() => { scroll(); }, [messages, scroll]);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') synthRef.current = window.speechSynthesis;
    return () => { synthRef.current?.cancel(); };
  }, []);

  useEffect(() => {
    const name = user?.firstName || user?.fullName?.split(' ')[0] || 'there';
    setMessages([{ id: genId(), role: 'assistant', content: WELCOME_MESSAGES[lang](name), timestamp: new Date() }]);
    setHistory([]);
  }, [lang, user?.firstName, user?.fullName]);

  useEffect(() => { if (isClient && !isAuthenticated) router.push('/auth/login'); }, [isClient, isAuthenticated, router]);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  /* Voice */
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const r = new SR();
    r.lang = LANGUAGES[lang].code; r.continuous = false; r.interimResults = false;
    r.onstart = () => setIsListening(true);
    r.onresult = (e: any) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    recRef.current = r; r.start();
  };
  const stopListening = () => { recRef.current?.stop(); setIsListening(false); };

  const toggleSpeak = (text: string, id: string) => {
    if (!synthRef.current) return;
    if (speakingId === id) { synthRef.current.cancel(); setSpeakingId(null); return; }
    synthRef.current.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ''));
    u.lang = LANGUAGES[lang].voiceCode; u.rate = 0.9;
    u.onstart = () => setSpeakingId(id);
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    synthRef.current.speak(u);
  };

  /* Send */
  const sendMessage = async (msgText?: string) => {
    const text = (msgText || input).trim();
    if (!text || isLoading || busyRef.current) return;
    busyRef.current = true;

    const userMsg: Message = { id: genId(), role: 'user', content: text, timestamp: new Date() };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setIsLoading(true);

    const newHist = [...history, { role: 'user', text }];
    setHistory(newHist);

    try {
      const res = await authService.client.post('/ai/chat', {
        message: text, language: lang, conversationHistory: newHist.slice(-6),
      });
      const aiText = res.data?.data?.message || res.data?.message;
      if (!aiText) throw new Error('Empty response');

      const aiMsg: Message = { id: genId(), role: 'assistant', content: aiText, timestamp: new Date(), isFallback: res.data?.data?.fallback };
      setMessages(p => [...p, aiMsg]);
      setHistory(p => [...p, { role: 'assistant', text: aiText }]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const fallback: Message = {
        id: genId(), role: 'assistant', isFallback: true, timestamp: new Date(),
        content: lang === 'en'
          ? "I'm having trouble connecting right now. Here are some quick tips:\n\n• Take deep breaths — inhale 4s, hold 4s, exhale 4s\n• Stay hydrated and take regular breaks\n• For urgent help, call **911** or crisis line **988**\n\nPlease try again in a moment!"
          : 'कनेक्शन में समस्या है। कृपया कुछ देर बाद पुनः प्रयास करें।\n\n🆘 आपातकालीन: 112',
      };
      setMessages(p => [...p, fallback]);
    } finally { setIsLoading(false); busyRef.current = false; }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    const name = user?.firstName || user?.fullName?.split(' ')[0] || 'there';
    setMessages([{ id: genId(), role: 'assistant', content: WELCOME_MESSAGES[lang](name), timestamp: new Date() }]);
    setHistory([]);
  };

  /* ━━━ Gates ━━━ */
  if (!isClient) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 50%, #eff6ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e9d5ff', borderTopColor: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#7c3aed', marginTop: 16, fontSize: 14, fontFamily: "'Inter', sans-serif" }}>Loading MedChain Assistant…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 50%, #eff6ff 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ textAlign: 'center', background: '#fff', borderRadius: 24, padding: '48px 36px', maxWidth: 400, boxShadow: '0 8px 40px rgba(139,92,246,.12)', border: '1px solid #f3e8ff' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#4c1d95', marginBottom: 8 }}>Login Required</h2>
          <p style={{ color: '#7c3aed', marginBottom: 28, fontSize: 14 }}>Sign in to access MedChain Health Assistant</p>
          <button
            onClick={() => router.push('/auth/login')}
            style={{ width: '100%', padding: '14px 24px', background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 600, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 16px rgba(139,92,246,.3)' }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  /* ━━━ Main Render ━━━ */
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: 'linear-gradient(135deg, #faf5ff 0%, #fdf2f8 40%, #f0f9ff 70%, #faf5ff 100%)', color: '#1e1b4b', position: 'relative', overflow: 'hidden' }}>

      {/* Decorative soft blobs */}
      <div style={{ position: 'fixed', top: -80, left: -60, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,181,253,.3) 0%, transparent 70%)', animation: 'float1 20s ease-in-out infinite', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -100, right: -80, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,207,232,.25) 0%, transparent 70%)', animation: 'float2 25s ease-in-out infinite', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '35%', right: '15%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(191,219,254,.2) 0%, transparent 70%)', animation: 'float3 18s ease-in-out infinite', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── Header ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(139,92,246,.08)', boxShadow: '0 1px 12px rgba(139,92,246,.06)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.1)', borderRadius: 12, padding: '8px 14px', color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
            Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,.4)' }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg, #7c3aed, #db2777)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              MedChain Health Assistant
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.1)', borderRadius: 10, padding: '8px 10px', color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Toggle sidebar">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <button onClick={clearChat} style={{ background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.1)', borderRadius: 10, padding: '8px 10px', color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="New chat">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div style={{ display: 'flex', maxWidth: 1400, margin: '0 auto', height: 'calc(100vh - 57px)', position: 'relative', zIndex: 1 }}>

        {/* Sidebar */}
        {sidebarOpen && (
          <aside style={{
            width: 280, flexShrink: 0, borderRight: '1px solid rgba(139,92,246,.06)',
            background: 'rgba(255,255,255,.55)', backdropFilter: 'blur(12px)',
            overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14
          }}>
            {/* Language */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f3e8ff', padding: 14, boxShadow: '0 2px 12px rgba(139,92,246,.05)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#6d28d9', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 10px 0' }}>
                🌐 Language
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(Object.keys(LANGUAGES) as Language[]).map(code => (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    style={{
                      padding: '9px 10px', borderRadius: 10,
                      border: lang === code ? '1.5px solid #8b5cf6' : '1px solid #e9d5ff',
                      background: lang === code ? 'linear-gradient(135deg, rgba(139,92,246,.1), rgba(236,72,153,.06))' : '#faf5ff',
                      color: lang === code ? '#6d28d9' : '#7c3aed',
                      fontSize: 12, fontWeight: lang === code ? 600 : 500,
                      cursor: 'pointer', textAlign: 'center', transition: 'all .2s',
                    }}
                  >
                    {LANGUAGES[code].flag} {LANGUAGES[code].name}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Topics */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f3e8ff', padding: 14, boxShadow: '0 2px 12px rgba(139,92,246,.05)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#6d28d9', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 10px 0' }}>
                ⚡ Quick Topics
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {QUICK_PROMPTS[lang].map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p.text)}
                    disabled={isLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 12px', borderRadius: 12,
                      border: '1px solid #f3e8ff', background: '#faf5ff',
                      color: '#4c1d95', fontSize: 12, cursor: 'pointer',
                      textAlign: 'left', transition: 'all .2s',
                      opacity: isLoading ? 0.5 : 1,
                    }}
                    onMouseEnter={e => { if (!isLoading) { (e.currentTarget as HTMLElement).style.background = '#f3e8ff'; (e.currentTarget as HTMLElement).style.borderColor = '#c4b5fd'; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#faf5ff'; (e.currentTarget as HTMLElement).style.borderColor = '#f3e8ff'; }}
                  >
                    <span style={{ fontSize: 18 }}>{p.icon}</span>
                    <span style={{ flex: 1 }}>{p.text}</span>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: 'rgba(139,92,246,.08)', color: '#7c3aed', fontWeight: 600 }}>{p.category}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Crisis */}
            <div style={{ background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)', borderRadius: 16, border: '1px solid #fecdd3', padding: 14 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#be123c', margin: '0 0 8px 0' }}>🆘 Crisis Support</h4>
              <p style={{ fontSize: 12, color: '#9f1239', margin: '5px 0', lineHeight: 1.5 }}>📞 Crisis Lifeline: <strong>988</strong></p>
              <p style={{ fontSize: 12, color: '#9f1239', margin: '5px 0', lineHeight: 1.5 }}>💬 Text HOME → <strong>741741</strong></p>
              <p style={{ fontSize: 12, color: '#9f1239', margin: '5px 0', lineHeight: 1.5 }}>🚑 Emergency: <strong>911</strong></p>
            </div>
          </aside>
        )}

        {/* ── Chat Area ── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', animation: 'slideUp .3s ease-out' }}>

                  {msg.role === 'assistant' && (
                    <div style={{
                      width: 38, height: 38, borderRadius: 14, flexShrink: 0,
                      background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#fff',
                      boxShadow: '0 3px 12px rgba(139,92,246,.25)',
                    }}>AI</div>
                  )}

                  <div style={{ maxWidth: '75%' }}>
                    <div style={msg.role === 'user' ? {
                      background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                      borderRadius: '20px 6px 20px 20px', padding: '14px 20px',
                      color: '#fff', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                      boxShadow: '0 4px 16px rgba(139,92,246,.2)',
                    } : {
                      background: '#fff',
                      border: '1px solid #f3e8ff',
                      borderRadius: '6px 20px 20px 20px', padding: '14px 20px',
                      color: '#1e1b4b', fontSize: 14, lineHeight: 1.7,
                      boxShadow: '0 2px 12px rgba(139,92,246,.06)',
                    }}>
                      {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <span style={{ fontSize: 11, color: '#a78bfa' }} suppressHydrationWarning>{formatTime(msg.timestamp)}</span>
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => toggleSpeak(msg.content, msg.id)}
                          style={{
                            border: '1px solid #e9d5ff', borderRadius: 8,
                            padding: '3px 10px', fontSize: 11, cursor: 'pointer', transition: 'all .2s',
                            background: speakingId === msg.id ? 'rgba(139,92,246,.1)' : '#faf5ff',
                            color: speakingId === msg.id ? '#7c3aed' : '#a78bfa',
                          }}
                        >
                          {speakingId === msg.id ? '🔊 Stop' : '🔊'}
                        </button>
                      )}
                      {msg.isFallback && (
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: '#fff7ed', color: '#ea580c', fontWeight: 600, border: '1px solid #fed7aa', textTransform: 'uppercase', letterSpacing: 0.5 }}>offline</span>
                      )}
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div style={{
                      width: 38, height: 38, borderRadius: 14, flexShrink: 0,
                      background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 700, color: '#fff',
                      boxShadow: '0 3px 12px rgba(99,102,241,.2)',
                    }}>
                      {user?.firstName?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
              ))}

              {/* Typing dots */}
              {isLoading && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'slideUp .3s ease-out' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 14, flexShrink: 0,
                    background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#fff',
                    boxShadow: '0 3px 12px rgba(139,92,246,.25)',
                  }}>AI</div>
                  <div style={{ background: '#fff', border: '1px solid #f3e8ff', borderRadius: '6px 20px 20px 20px', padding: '16px 26px', boxShadow: '0 2px 12px rgba(139,92,246,.06)' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="chatDot" style={{ width: 9, height: 9, borderRadius: '50%', background: '#a78bfa', display: 'inline-block', animation: 'bounceDot .6s ease-in-out infinite', animationDelay: '0s' }} />
                      <span className="chatDot" style={{ width: 9, height: 9, borderRadius: '50%', background: '#c084fc', display: 'inline-block', animation: 'bounceDot .6s ease-in-out infinite', animationDelay: '0.15s' }} />
                      <span className="chatDot" style={{ width: 9, height: 9, borderRadius: '50%', background: '#e879f9', display: 'inline-block', animation: 'bounceDot .6s ease-in-out infinite', animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* ── Input Bar ── */}
            <div style={{ borderTop: '1px solid rgba(139,92,246,.06)', background: 'rgba(255,255,255,.7)', backdropFilter: 'blur(12px)', padding: '16px 28px 12px' }}>
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 10,
                background: '#fff', border: '1.5px solid #e9d5ff', borderRadius: 18,
                padding: '8px 14px', boxShadow: '0 2px 16px rgba(139,92,246,.06)',
                transition: 'border-color .2s',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#a78bfa'}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#e9d5ff'}
              >
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isLoading}
                  style={{
                    width: 42, height: 42, borderRadius: 12, border: 'none', flexShrink: 0,
                    background: isListening ? '#ef4444' : 'rgba(139,92,246,.08)',
                    color: isListening ? '#fff' : '#7c3aed', fontSize: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .2s',
                    animation: isListening ? 'pulseRing 1s infinite' : 'none',
                  }}
                  title="Voice input"
                >🎤</button>

                <textarea
                  ref={taRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    lang === 'en' ? 'Ask about your health…  (Enter to send)'
                    : lang === 'hi' ? 'अपना सवाल पूछें…'
                    : lang === 'ta' ? 'உங்கள் கேள்வியை கேளுங்கள்…'
                    : 'तुमचा प्रश्न विचारा…'
                  }
                  disabled={isLoading}
                  rows={1}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: '#1e1b4b', fontSize: 14, lineHeight: 1.5, resize: 'none',
                    padding: '10px 0', fontFamily: "'Inter', system-ui, sans-serif",
                    maxHeight: 120,
                  }}
                />

                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  style={{
                    width: 44, height: 44, borderRadius: 14, border: 'none', flexShrink: 0,
                    background: !input.trim() || isLoading ? '#e9d5ff' : 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                    color: '#fff', cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .2s',
                    boxShadow: !input.trim() || isLoading ? 'none' : '0 4px 14px rgba(139,92,246,.3)',
                  }}
                  title="Send message"
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                </button>
              </div>

              <p style={{ fontSize: 11, color: '#a78bfa', textAlign: 'center', marginTop: 8, lineHeight: 1.4 }}>
                💡 Not a substitute for professional medical care. Emergencies → 911 · Crisis → 988
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* ── Animations ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; }

        @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-40px) scale(1.1)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,30px) scale(1.05)} }
        @keyframes float3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(15px,25px) scale(.95)} }

        @keyframes bounceDot {
          0%,80%,100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }

        @keyframes pulseRing {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,.5); }
          70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }

        @keyframes slideUp {
          from { opacity:0; transform:translateY(12px); }
          to { opacity:1; transform:translateY(0); }
        }

        @keyframes spin { to { transform: rotate(360deg) } }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(139,92,246,.15); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,.25); }

        textarea::placeholder { color: #c4b5fd; }
      `}</style>
    </div>
  );
}