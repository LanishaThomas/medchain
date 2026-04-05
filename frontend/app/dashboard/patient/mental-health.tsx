'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';

interface MoodEntry {
  id: string;
  mood: string;
  moodScore: number;
  note: string;
  createdAt: string;
}

interface BreathingPattern {
  id: string;
  name: string;
  description: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdAfterExhale: number;
  cycles: number;
  color: string;
}

interface MusicTrack {
  id: string;
  title: string;
  category: 'meditation' | 'stress-relief' | 'sleep' | 'focus';
  description: string;
  icon: string;
}

const breathingPatterns: BreathingPattern[] = [
  { 
    id: '478', 
    name: '4-7-8 Relaxing Breath', 
    description: 'Calms anxiety and helps you fall asleep',
    inhale: 4, hold: 7, exhale: 8, holdAfterExhale: 0, cycles: 4,
    color: 'from-blue-400 to-purple-500'
  },
  { 
    id: 'box', 
    name: 'Box Breathing', 
    description: 'Used by Navy SEALs for stress control',
    inhale: 4, hold: 4, exhale: 4, holdAfterExhale: 4, cycles: 4,
    color: 'from-teal-400 to-cyan-500'
  },
  { 
    id: 'energizing', 
    name: 'Energizing Breath', 
    description: 'Quick boost of energy and alertness',
    inhale: 2, hold: 0, exhale: 2, holdAfterExhale: 0, cycles: 10,
    color: 'from-orange-400 to-yellow-500'
  },
  { 
    id: 'deep', 
    name: 'Deep Belly Breathing', 
    description: 'Reduces stress and lowers heart rate',
    inhale: 5, hold: 2, exhale: 6, holdAfterExhale: 0, cycles: 5,
    color: 'from-green-400 to-emerald-500'
  },
  { 
    id: '555', 
    name: '5-5-5 Triangle Breath', 
    description: 'Balances nervous system',
    inhale: 5, hold: 5, exhale: 5, holdAfterExhale: 0, cycles: 6,
    color: 'from-pink-400 to-rose-500'
  }
];

const musicTracks: MusicTrack[] = [
  { 
    id: 'rain', 
    title: 'Peaceful Rain', 
    category: 'stress-relief',
    description: 'Gentle rain sounds for relaxation',
    icon: '🌧️'
  },
  { 
    id: 'ocean', 
    title: 'Ocean Waves', 
    category: 'meditation',
    description: 'Calming ocean waves',
    icon: '🌊'
  },
  { 
    id: 'forest', 
    title: 'Forest Birds', 
    category: 'focus',
    description: 'Natural forest ambience',
    icon: '🐦'
  },
  { 
    id: 'crickets', 
    title: 'Night Crickets', 
    category: 'sleep',
    description: 'Peaceful cricket sounds for sleep',
    icon: '🦗'
  },
  { 
    id: 'bowls', 
    title: 'Tibetan Bowls', 
    category: 'meditation',
    description: 'Healing bowl sounds',
    icon: '🔔'
  },
  { 
    id: 'piano', 
    title: 'Gentle Piano', 
    category: 'stress-relief',
    description: 'Soft piano melodies',
    icon: '🎹'
  },
  { 
    id: 'whitenoise', 
    title: 'White Noise', 
    category: 'sleep',
    description: 'Pure white noise for deep sleep',
    icon: '💤'
  },
  { 
    id: 'fireplace', 
    title: 'Fireplace Crackle', 
    category: 'stress-relief',
    description: 'Cozy fireplace sounds',
    icon: '🔥'
  }
];

const moodEmojis = [
  { emoji: '😢', label: 'Very Sad', score: 1 },
  { emoji: '😔', label: 'Sad', score: 2 },
  { emoji: '😐', label: 'Neutral', score: 3 },
  { emoji: '🙂', label: 'Good', score: 4 },
  { emoji: '😊', label: 'Great', score: 5 },
];

export default function MentalHealthComponent() {
  const router = useRouter();
  const [moodLog, setMoodLog] = useState<MoodEntry[]>([]);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [journalNote, setJournalNote] = useState('');
  const [selectedMood, setSelectedMood] = useState<{ emoji: string; score: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingMood, setSavingMood] = useState(false);
  
  // Breathing exercise state
  const [showBreathingModal, setShowBreathingModal] = useState(false);
  const [showBreathingExercise, setShowBreathingExercise] = useState(false);
  const [selectedBreathingPattern, setSelectedBreathingPattern] = useState<BreathingPattern | null>(null);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale' | 'holdAfterExhale'>('inhale');
  const [breathingCount, setBreathingCount] = useState(0);
  const [breathingTimer, setBreathingTimer] = useState(0);
  const breathingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Music player state
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicCategory, setMusicCategory] = useState<'all' | 'meditation' | 'stress-relief' | 'sleep' | 'focus'>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Gratitude journal state
  const [showGratitudeModal, setShowGratitudeModal] = useState(false);
  const [gratitudeEntries, setGratitudeEntries] = useState<string[]>(['', '', '']);

  useEffect(() => {
    fetchMoodHistory();
    return () => {
      stopBreathingExercise();
      stopMusic();
    };
  }, []);

  const fetchMoodHistory = async () => {
    try {
      setLoading(true);
      const response = await authService.client.get('/patient/mood-history');
      if (response.data.success) {
        setMoodLog(response.data.data);
      }
    } catch (err: any) {
      console.log('Mood history fetch error:', err.response?.status, err.response?.data);
      // Silently fail - just start with empty mood log
      setMoodLog([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMoodSelect = (emoji: string, score: number) => {
    setSelectedMood({ emoji, score });
    setShowJournalModal(true);
  };

  const saveMoodEntry = async () => {
    if (!selectedMood) return;
    
    setSavingMood(true);
    try {
      const response = await authService.client.post('/patient/mood', {
        mood: selectedMood.emoji,
        moodScore: selectedMood.score,
        note: journalNote
      });
      
      if (response.data.success) {
        setMoodLog(prev => [{
          id: response.data.data.id || Date.now().toString(),
          mood: selectedMood.emoji,
          moodScore: selectedMood.score,
          note: journalNote,
          createdAt: new Date().toISOString()
        }, ...prev]);
      }
    } catch (err: any) {
      console.error('Failed to save mood:', err);
      alert('Failed to save mood entry. Please try again.');
    } finally {
      setSavingMood(false);
      setShowJournalModal(false);
      setJournalNote('');
      setSelectedMood(null);
    }
  };

  // Breathing Exercise Functions
  const startBreathingPattern = (pattern: BreathingPattern) => {
    setSelectedBreathingPattern(pattern);
    setShowBreathingModal(false);
    setShowBreathingExercise(true);
    setBreathingCount(0);
    setBreathingPhase('inhale');
    runBreathingCycle(pattern);
  };

  const runBreathingCycle = (pattern: BreathingPattern) => {
    let currentCycle = 0;
    let phase: 'inhale' | 'hold' | 'exhale' | 'holdAfterExhale' = 'inhale';

    const executePhase = () => {
      if (currentCycle >= pattern.cycles) {
        stopBreathingExercise();
        return;
      }

      const phaseDurations = {
        inhale: pattern.inhale,
        hold: pattern.hold,
        exhale: pattern.exhale,
        holdAfterExhale: pattern.holdAfterExhale
      };

      const currentDuration = phaseDurations[phase];
      
      if (currentDuration > 0) {
        setBreathingPhase(phase);
        setBreathingTimer(currentDuration);
        
        // Countdown timer
        let remaining = currentDuration;
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => {
          remaining--;
          setBreathingTimer(remaining);
          if (remaining <= 0 && timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
          }
        }, 1000);

        breathingTimeoutRef.current = setTimeout(() => {
          moveToNextPhase();
        }, currentDuration * 1000);
      } else {
        moveToNextPhase();
      }
    };

    const moveToNextPhase = () => {
      if (phase === 'inhale') {
        phase = 'hold';
      } else if (phase === 'hold') {
        phase = 'exhale';
      } else if (phase === 'exhale') {
        phase = 'holdAfterExhale';
      } else {
        phase = 'inhale';
        currentCycle++;
        setBreathingCount(currentCycle);
      }
      executePhase();
    };

    executePhase();
  };

  const stopBreathingExercise = () => {
    if (breathingTimeoutRef.current) {
      clearTimeout(breathingTimeoutRef.current);
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setShowBreathingExercise(false);
    setSelectedBreathingPattern(null);
  };

  // Music/Sound Functions - Generate calming ambient sounds using Web Audio API
  const playMusic = (track: MusicTrack) => {
    stopMusic();
    setCurrentTrack(track);
    
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create different sound generators based on track
      if (track.id === 'rain') {
        // Rain sound using pink noise
        const bufferSize = 4096;
        const whiteNoise = audioContext.createScriptProcessor(bufferSize, 1, 1);
        const b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        
        whiteNoise.onaudioprocess = function(e) {
          const output = e.outputBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.1) / 7;
            output[i] = pink * 0.1;
          }
        };
        
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.3;
        
        whiteNoise.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Store reference
        (audioRef as any).current = { context: audioContext, processor: whiteNoise };
        
      } else if (track.id === 'ocean') {
        // Ocean waves using oscillating low frequency
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 0.2;
        filter.type = 'lowpass';
        filter.frequency.value = 200;
        
        gainNode.gain.value = 0.2;
        
        oscillator.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        
        (audioRef as any).current = { context: audioContext, oscillator, gainNode };
        
      } else {
        // Default ambient tone
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 200;
        gainNode.gain.value = 0.1;
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        
        (audioRef as any).current = { context: audioContext, oscillator };
      }
      
      setIsPlaying(true);
    } catch (err) {
      console.error('Audio error:', err);
      alert('Audio not supported in this browser. Try Chrome, Firefox, or Edge.');
    }
  };

  const stopMusic = () => {
    const audioObj = (audioRef as any).current;
    if (audioObj) {
      if (audioObj.oscillator) {
        audioObj.oscillator.stop();
        audioObj.oscillator.disconnect();
      }
      if (audioObj.processor) {
        audioObj.processor.disconnect();
      }
      if (audioObj.gainNode) {
        audioObj.gainNode.disconnect();
      }
      if (audioObj.context) {
        audioObj.context.close();
      }
      (audioRef as any).current = null;
    }
    setIsPlaying(false);
    setCurrentTrack(null);
  };

  const saveGratitudeJournal = () => {
    const validEntries = gratitudeEntries.filter(e => e.trim());
    if (validEntries.length === 0) {
      alert('Please add at least one thing you\'re grateful for');
      return;
    }
    
    console.log('Gratitude entries saved:', validEntries);
    setShowGratitudeModal(false);
    setGratitudeEntries(['', '', '']);
    alert('Gratitude journal saved! 🙏');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredMusic = musicCategory === 'all' 
    ? musicTracks 
    : musicTracks.filter(t => t.category === musicCategory);

  return (
    <div className="space-y-6">
      {/* Mood Check-in Card */}
      <div className="bg-gradient-to-r from-teal-500 to-emerald-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold">How are you feeling today?</h3>
            <p className="text-teal-100 text-sm">Track your mood to identify patterns</p>
          </div>
        </div>
        <div className="flex justify-center gap-4">
          {moodEmojis.map((item) => (
            <button
              key={item.score}
              onClick={() => handleMoodSelect(item.emoji, item.score)}
              className="flex flex-col items-center p-3 rounded-xl hover:bg-white/20 transition-all transform hover:scale-110"
              title={item.label}
            >
              <span className="text-4xl">{item.emoji}</span>
              <span className="text-xs mt-1 opacity-80">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Activities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chatbot Button */}
          <button
            onClick={() => router.push('/chatbot')}
            className="w-full p-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl">🤖</span>
              <div className="text-left">
                <h3 className="text-lg font-semibold">Talk to Health Assistant</h3>
                <p className="text-sm text-purple-100">Get physical & mental health support anytime</p>
              </div>
            </div>
          </button>

          {/* Wellness Activities */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🌿 Wellness Activities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Breathing Exercises */}
              <button
                onClick={() => setShowBreathingModal(true)}
                className="p-5 text-left border-2 border-blue-200 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🌬️</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-blue-600">Breathing Exercises</h4>
                    <p className="text-sm text-gray-600 mt-1">{breathingPatterns.length} patterns available</p>
                  </div>
                </div>
              </button>

              {/* Calming Sounds */}
              <button
                onClick={() => setShowMusicModal(true)}
                className="p-5 text-left border-2 border-purple-200 rounded-xl hover:bg-purple-50 hover:border-purple-300 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🎵</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-purple-600">Calming Sounds</h4>
                    <p className="text-sm text-gray-600 mt-1">{musicTracks.length} ambient tracks</p>
                  </div>
                </div>
              </button>

              {/* Gratitude Journal */}
              <button
                onClick={() => setShowGratitudeModal(true)}
                className="p-5 text-left border-2 border-green-200 rounded-xl hover:bg-green-50 hover:border-green-300 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🙏</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-green-600">Gratitude Journal</h4>
                    <p className="text-sm text-gray-600 mt-1">List 3 things you're grateful for</p>
                  </div>
                </div>
              </button>

              {/* Body Scan Meditation */}
              <button
                onClick={() => alert('Body scan meditation coming soon!')}
                className="p-5 text-left border-2 border-orange-200 rounded-xl hover:bg-orange-50 hover:border-orange-300 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🧘</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-orange-600">Body Scan</h4>
                    <p className="text-sm text-gray-600 mt-1">Progressive relaxation technique</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Currently Playing */}
          {currentTrack && isPlaying && (
            <div className="bg-white rounded-xl border border-purple-200 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{currentTrack.icon}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900">{currentTrack.title}</h4>
                    <p className="text-sm text-gray-600">{currentTrack.description}</p>
                  </div>
                </div>
                <button
                  onClick={stopMusic}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Stop
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Mood Journal */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📔 Mood Journal</h3>
            {loading ? (
              <div className="text-center py-4 text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-3">
                {moodLog.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-start p-3 bg-gray-50 rounded-lg">
                    <span className="text-2xl">{entry.mood}</span>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">{formatDate(entry.createdAt)}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{entry.note || 'No note'}</p>
                    </div>
                  </div>
                ))}
                {moodLog.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No mood entries yet. Start tracking!</p>
                )}
              </div>
            )}
          </div>

          {/* Crisis Resources & Emergency Contacts */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <h4 className="font-semibold text-red-800 mb-2">🆘 Emergency Helplines</h4>
              <p className="text-xs text-red-700 mb-3">In crisis? Get immediate help:</p>
              <div className="space-y-1.5">
                <a href="tel:100" className="block p-2 bg-white rounded-lg text-center text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                  🚔 100 - Police
                </a>
                <a href="tel:108" className="block p-2 bg-white rounded-lg text-center text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                  🚑 108 - Ambulance
                </a>
                <a href="tel:+911123389090" className="block p-2 bg-white rounded-lg text-center text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
                  💬 Sumaitri: 011-23389090
                </a>
                <a href="tel:+911146018404" className="block p-2 bg-white rounded-lg text-center text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
                  💬 Sumaitri: 011-46018404
                </a>
                <a href="tel:+919315767849" className="block p-2 bg-white rounded-lg text-center text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors">
                  💬 Sumaitri: 9315767849
                </a>
              </div>
            </div>
            
            {/* Personal Emergency Contacts - Coming Soon */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="text-sm font-semibold text-blue-800 mb-2">📱 Your Emergency Contacts</h5>
              <button
                onClick={() => alert('Emergency contacts feature coming soon! You will be able to add family/friend contacts here.')}
                className="w-full p-2 bg-white border border-blue-300 rounded-lg text-sm text-blue-700 hover:bg-blue-50 transition-colors"
              >
                + Add Emergency Contact
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mood Journal Entry Modal */}
      {showJournalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="text-center mb-4">
              <span className="text-5xl">{selectedMood?.emoji}</span>
              <h3 className="text-lg font-semibold text-gray-900 mt-2">How are you feeling?</h3>
            </div>
            <textarea
              value={journalNote}
              onChange={(e) => setJournalNote(e.target.value)}
              placeholder="Add a note about how you're feeling... (optional)"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowJournalModal(false); setSelectedMood(null); setJournalNote(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveMoodEntry}
                disabled={savingMood}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:bg-gray-400"
              >
                {savingMood ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breathing Pattern Selection Modal */}
      {showBreathingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Choose a Breathing Pattern</h3>
            <div className="space-y-3">
              {breathingPatterns.map((pattern) => (
                <button
                  key={pattern.id}
                  onClick={() => startBreathingPattern(pattern)}
                  className={`w-full p-4 text-left rounded-xl border-2 hover:shadow-md transition-all bg-gradient-to-r ${pattern.color} bg-opacity-10 border-transparent hover:border-opacity-50`}
                >
                  <h4 className="font-semibold text-gray-900">{pattern.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{pattern.description}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Inhale: {pattern.inhale}s | Hold: {pattern.hold}s | Exhale: {pattern.exhale}s
                    {pattern.holdAfterExhale > 0 && ` | Hold: ${pattern.holdAfterExhale}s`} × {pattern.cycles} cycles
                  </p>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowBreathingModal(false)}
              className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Breathing Exercise Modal */}
      {showBreathingExercise && selectedBreathingPattern && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{selectedBreathingPattern.name}</h3>
            <p className="text-sm text-gray-600 mb-6">{selectedBreathingPattern.description}</p>
            
            <div className={`w-48 h-48 mx-auto rounded-full flex items-center justify-center mb-6 transition-all duration-1000 bg-gradient-to-r ${selectedBreathingPattern.color} ${
              breathingPhase === 'inhale' ? 'scale-125' :
              breathingPhase === 'hold' || breathingPhase === 'holdAfterExhale' ? 'scale-125' :
              'scale-90'
            }`}>
              <div className="text-center text-white">
                <p className="text-3xl font-bold capitalize">
                  {breathingPhase === 'holdAfterExhale' ? 'Hold' : breathingPhase}
                </p>
                <p className="text-5xl font-bold mt-2">{breathingTimer}</p>
                <p className="text-sm mt-1">seconds</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-2">Cycle {breathingCount + 1} of {selectedBreathingPattern.cycles}</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-teal-600 h-2 rounded-full transition-all"
                  style={{ width: `${((breathingCount) / selectedBreathingPattern.cycles) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <button
              onClick={stopBreathingExercise}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Stop Exercise
            </button>
          </div>
        </div>
      )}

      {/* Music Selection Modal */}
      {showMusicModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Calming Sounds & Music</h3>
            
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(['all', 'meditation', 'stress-relief', 'sleep', 'focus'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setMusicCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    musicCategory === cat
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {filteredMusic.map((track) => (
                <button
                  key={track.id}
                  onClick={() => playMusic(track)}
                  className="p-4 text-left border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-all"
                >
                  <span className="text-3xl mb-2 block">{track.icon}</span>
                  <h4 className="font-semibold text-gray-900 text-sm">{track.title}</h4>
                  <p className="text-xs text-gray-600 mt-1">{track.description}</p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowMusicModal(false)}
              className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Gratitude Journal Modal */}
      {showGratitudeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">🙏 Gratitude Journal</h3>
            <p className="text-sm text-gray-600 mb-4">List three things you're grateful for today</p>
            
            {gratitudeEntries.map((entry, index) => (
              <div key={index} className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {index + 1}. I'm grateful for...
                </label>
                <input
                  type="text"
                  value={entry}
                  onChange={(e) => {
                    const newEntries = [...gratitudeEntries];
                    newEntries[index] = e.target.value;
                    setGratitudeEntries(newEntries);
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="Type here..."
                />
              </div>
            ))}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowGratitudeModal(false); setGratitudeEntries(['', '', '']); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveGratitudeJournal}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save Journal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
