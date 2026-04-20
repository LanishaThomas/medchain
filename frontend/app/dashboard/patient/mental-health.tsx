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

interface GratitudeJournalEntry {
  id: string;
  entries: string[];
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
  audioUrl: string;
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

// Audio served from frontend public folder (static, works on Vercel)
const AUDIO_BASE_URL = '';

const musicTracks: MusicTrack[] = [
  { id: 'rain',       title: 'Peaceful Rain',    category: 'stress-relief', description: 'Gentle rain sounds for relaxation',    icon: '🌧️', audioUrl: `${AUDIO_BASE_URL}/audio/rain.mp3` },
  { id: 'ocean',      title: 'Ocean Waves',      category: 'meditation',    description: 'Calming ocean waves',                  icon: '🌊', audioUrl: `${AUDIO_BASE_URL}/audio/ocean.mp3` },
  { id: 'forest',     title: 'Forest Birds',     category: 'focus',         description: 'Natural forest ambience',              icon: '🐦', audioUrl: `${AUDIO_BASE_URL}/audio/forest.mp3` },
  { id: 'crickets',   title: 'Night Crickets',   category: 'sleep',         description: 'Peaceful cricket sounds for sleep',    icon: '🦗', audioUrl: `${AUDIO_BASE_URL}/audio/crickets.mp3` },
  { id: 'bowls',      title: 'Tibetan Bowls',    category: 'meditation',    description: 'Healing bowl sounds',                  icon: '🔔', audioUrl: `${AUDIO_BASE_URL}/audio/bowls.mp3` },
  { id: 'piano',      title: 'Gentle Piano',     category: 'stress-relief', description: 'Soft piano melodies',                  icon: '🎹', audioUrl: `${AUDIO_BASE_URL}/audio/piano.mp3` },
  { id: 'whitenoise', title: 'White Noise',      category: 'sleep',         description: 'Pure white noise for deep sleep',      icon: '💤', audioUrl: `${AUDIO_BASE_URL}/audio/whitenoise.mp3` },
  { id: 'fireplace',  title: 'Fireplace Crackle',category: 'stress-relief', description: 'Cozy fireplace sounds',                icon: '🔥', audioUrl: `${AUDIO_BASE_URL}/audio/fireplace.mp3` },
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
  const [showBreathingExercise, setShowBreathingExercise] = useState(false);
  const [selectedBreathingPattern, setSelectedBreathingPattern] = useState<BreathingPattern | null>(null);
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale' | 'holdAfterExhale'>('inhale');
  const [breathingCount, setBreathingCount] = useState(0);
  const [breathingTimer, setBreathingTimer] = useState(0);
  const breathingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Music player state
  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicCategory, setMusicCategory] = useState<'all' | 'meditation' | 'stress-relief' | 'sleep' | 'focus'>('all');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Gratitude journal state
  const [showGratitudeModal, setShowGratitudeModal] = useState(false);
  const [gratitudeEntries, setGratitudeEntries] = useState<string[]>(['', '', '']);
  const [journalList, setJournalList] = useState<GratitudeJournalEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(0); // 0 = write-new page
  const [savingGratitude, setSavingGratitude] = useState(false);
  const [pageFlipping, setPageFlipping] = useState(false);

  useEffect(() => {
    fetchMoodHistory();
    fetchGratitudeJournals();
    return () => {
      stopBreathingExercise();
      stopMusic();
    };
  }, []);

  const fetchGratitudeJournals = async () => {
    try {
      const response = await authService.client.get('/patient/gratitude');
      if (response.data.success) {
        setJournalList(response.data.data);
      }
    } catch (err) {
      console.log('Gratitude fetch error:', err);
    }
  };

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
    // setShowBreathingModal no longer needed since patterns are inline
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

  // Music/Sound Functions
  const handleTrackClick = (track: MusicTrack) => {
    // Clicking the currently playing track → stop it
    if (currentTrack?.id === track.id && isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTrack(null);
      return;
    }

    // Stop whatever is currently playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';  // release the audio resource
      audioRef.current.load();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTrack(track);

    try {
      const audio = new Audio();
      audio.src = track.audioUrl;  // set src after creation to avoid caching issues
      audio.loop = true;
      audio.volume = 0.7;
      audioRef.current = audio;

      audio.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error('Playback failed:', err);
          setIsPlaying(false);
          setCurrentTrack(null);
        });
    } catch (err) {
      console.error('Audio error:', err);
      setIsPlaying(false);
      setCurrentTrack(null);
    }
  };

  const stopMusic = (clearTrack = true) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      audioRef.current.load();
      audioRef.current = null;
    }
    setIsPlaying(false);
    if (clearTrack) setCurrentTrack(null);
  };

  const saveGratitudeJournal = async () => {
    const valid = gratitudeEntries.map(e => e.trim()).filter(Boolean);
    if (valid.length === 0) {
      alert('Please add at least one thing you\'re grateful for');
      return;
    }
    setSavingGratitude(true);
    try {
      const response = await authService.client.post('/patient/gratitude', { entries: valid });
      if (response.data.success) {
        const saved = response.data.data;
        setJournalList(prev => [saved, ...prev]);
        setGratitudeEntries(['', '', '']);
        // Flip to the newly saved page (index 1 = first saved entry)
        setCurrentPage(1);
      }
    } catch (err) {
      console.error('Failed to save gratitude journal:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSavingGratitude(false);
    }
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

          {/* Breathing Exercises — inline cards */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🌬️ Breathing Exercises</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {breathingPatterns.map((pattern) => (
                <button
                  key={pattern.id}
                  onClick={() => startBreathingPattern(pattern)}
                  className={`p-4 text-left rounded-xl border-2 border-transparent bg-gradient-to-r ${pattern.color} bg-opacity-10 hover:shadow-md transition-all`}
                  style={{ background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)' }}
                >
                  <h4 className="font-semibold text-gray-900 text-sm">{pattern.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{pattern.description}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Inhale {pattern.inhale}s · Hold {pattern.hold}s · Exhale {pattern.exhale}s
                    {pattern.holdAfterExhale > 0 && ` · Hold ${pattern.holdAfterExhale}s`} · {pattern.cycles} cycles
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Calming Sounds — inline cards */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">🎵 Calming Sounds</h3>
              {/* Category filter */}
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'meditation', 'stress-relief', 'sleep', 'focus'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setMusicCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                      musicCategory === cat
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {filteredMusic.map((track) => {
                const isActive = currentTrack?.id === track.id && isPlaying;
                return (
                  <button
                    key={track.id}
                    onClick={() => handleTrackClick(track)}
                    className={`p-3 text-left border-2 rounded-xl transition-all relative ${
                      isActive
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    )}
                    <span className="text-2xl mb-1 block">{track.icon}</span>
                    <h4 className={`font-semibold text-xs leading-tight ${isActive ? 'text-purple-700' : 'text-gray-900'}`}>
                      {track.title}
                    </h4>
                    {isActive && (
                      <p className="text-xs mt-1 font-medium text-green-600">▶ Playing</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gratitude Journal */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🙏 Gratitude Journal</h3>
            <button
              onClick={() => setShowGratitudeModal(true)}
              className="w-full p-4 text-left border-2 border-green-200 rounded-xl hover:bg-green-50 hover:border-green-300 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">✍️</span>
                <div>
                  <h4 className="font-semibold text-gray-900 group-hover:text-green-600">Write Today's Gratitude</h4>
                  <p className="text-sm text-gray-600 mt-1">List 3 things you're grateful for today</p>
                </div>
              </div>
            </button>
          </div>

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



      {/* ── Gratitude Journal Book Modal ── */}
      {showGratitudeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-2xl">
            {/* Close button */}
            <button
              onClick={() => { setShowGratitudeModal(false); setGratitudeEntries(['', '', '']); setCurrentPage(0); }}
              className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm flex items-center gap-1"
            >
              ✕ Close
            </button>

            {/* Book container */}
            <div
              className="relative bg-amber-50 rounded-lg shadow-2xl overflow-hidden"
              style={{
                minHeight: '480px',
                background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 50%, #fde68a 100%)',
                boxShadow: '-8px 8px 24px rgba(0,0,0,0.4), 8px 8px 24px rgba(0,0,0,0.2)'
              }}
            >
              {/* Book spine */}
              <div
                className="absolute left-0 top-0 bottom-0 w-6 rounded-l-lg"
                style={{ background: 'linear-gradient(to right, #92400e, #b45309)' }}
              />

              {/* Page content */}
              <div
                className={`ml-6 p-8 transition-all duration-300 ${pageFlipping ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-3 border-b-2 border-amber-300">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📖</span>
                    <div>
                      <h3 className="text-lg font-bold text-amber-900">Gratitude Journal</h3>
                      {currentPage === 0 ? (
                        <p className="text-xs text-amber-700">Write today's entry</p>
                      ) : (
                        <p className="text-xs text-amber-700">
                          {new Date(journalList[currentPage - 1]?.createdAt).toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-amber-600 font-medium">
                    Page {currentPage + 1} of {journalList.length + 1}
                  </div>
                </div>

                {/* Page 0: Write new entry */}
                {currentPage === 0 && (
                  <div>
                    <p className="text-sm text-amber-800 mb-5 italic">"Gratitude turns what we have into enough."</p>
                    {gratitudeEntries.map((entry, index) => (
                      <div key={index} className="mb-4">
                        <label className="block text-sm font-semibold text-amber-900 mb-1">
                          {index + 1}. I am grateful for...
                        </label>
                        <input
                          type="text"
                          value={entry}
                          onChange={(e) => {
                            const next = [...gratitudeEntries];
                            next[index] = e.target.value;
                            setGratitudeEntries(next);
                          }}
                          className="w-full px-3 py-2 bg-amber-100/60 border border-amber-300 rounded-lg text-amber-900 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                          placeholder={`Thing ${index + 1}...`}
                        />
                      </div>
                    ))}
                    {/* Add more entries */}
                    {gratitudeEntries.length < 6 && (
                      <button
                        onClick={() => setGratitudeEntries(prev => [...prev, ''])}
                        className="text-sm text-amber-700 hover:text-amber-900 mb-4 underline"
                      >+ Add another entry</button>
                    )}
                    <button
                      onClick={saveGratitudeJournal}
                      disabled={savingGratitude}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-semibold rounded-lg transition-colors mt-2"
                    >
                      {savingGratitude ? 'Saving...' : '🙏 Save Today\'s Entry'}
                    </button>
                  </div>
                )}

                {/* Past journal pages */}
                {currentPage > 0 && journalList[currentPage - 1] && (
                  <div>
                    <p className="text-sm text-amber-800 mb-5 italic">"Gratitude makes sense of our past."</p>
                    <ul className="space-y-3">
                      {journalList[currentPage - 1].entries.map((entry, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="text-amber-500 font-bold text-lg leading-tight">{i + 1}.</span>
                          <p className="text-amber-900 text-sm leading-relaxed">{entry}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Decorative lines */}
              {[1,2,3,4,5,6].map(i => (
                <div
                  key={i}
                  className="absolute left-14 right-6 border-b border-amber-200/60"
                  style={{ top: `${80 + i * 60}px` }}
                />
              ))}
            </div>

            {/* Page navigation */}
            <div className="flex items-center justify-between mt-4">
              <button
                disabled={currentPage === 0}
                onClick={() => {
                  setPageFlipping(true);
                  setTimeout(() => { setCurrentPage(p => p - 1); setPageFlipping(false); }, 200);
                }}
                className="px-5 py-2 bg-amber-700 text-white rounded-lg disabled:opacity-30 hover:bg-amber-800 text-sm font-medium transition-colors"
              >
                ◀ Previous
              </button>

              {/* Page dots */}
              <div className="flex gap-1.5">
                {Array.from({ length: Math.min(journalList.length + 1, 7) }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPageFlipping(true);
                      setTimeout(() => { setCurrentPage(i); setPageFlipping(false); }, 200);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      currentPage === i ? 'bg-amber-700' : 'bg-amber-300 hover:bg-amber-500'
                    }`}
                  />
                ))}
                {journalList.length > 6 && <span className="text-amber-600 text-xs self-center">...</span>}
              </div>

              <button
                disabled={currentPage >= journalList.length}
                onClick={() => {
                  setPageFlipping(true);
                  setTimeout(() => { setCurrentPage(p => p + 1); setPageFlipping(false); }, 200);
                }}
                className="px-5 py-2 bg-amber-700 text-white rounded-lg disabled:opacity-30 hover:bg-amber-800 text-sm font-medium transition-colors"
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
