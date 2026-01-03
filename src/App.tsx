import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot, 
  query 
} from 'firebase/firestore';
import { 
  BookOpen, 
  GraduationCap, 
  Microscope, 
  Moon, 
  Sun, 
  BarChart3, 
  Clock, 
  Save, 
  ChevronRight,
  Calendar as CalendarIcon,
  AlertCircle,
  Lock,
  Plus,
  Trash2,
  Settings,
  Paperclip,
  FileText,
  X,
  ChevronLeft,
  CalendarDays,
  Bell,
  Circle,
  PlayCircle,
  CheckCircle2,
  FolderOpen,
  ExternalLink,
  Flame,
  Snowflake,
  ShieldAlert,
  Star,
  Skull,
  Target,
  LogOut,
  LogIn,
  Download,
  UploadCloud,
  HardDrive,
  Link,
  Info,
  History,
  ShieldCheck,
  Activity,
  Heart,
  Copy,
  Grid
} from 'lucide-react';

// --- Firebase Configuration ---
// Using your specific credentials
const firebaseConfig = {
  apiKey: "AIzaSyDWzyI8IwUPIui6NC4WztO3tPIT0MVP9eU",
  authDomain: "research-tracker-6c03c.firebaseapp.com",
  projectId: "research-tracker-6c03c",
  storageBucket: "research-tracker-6c03c.firebasestorage.app",
  messagingSenderId: "588669594482",
  appId: "1:588669594482:web:8ec15eb791d16603e24beb",
  measurementId: "G-71LZ1K6QH9"
};

const appId = 'research-tracker-v1'; // Internal App ID for database structure

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Types ---

type GoalStatus = 'pending' | 'progress' | 'completed';
type AntiGoalStatus = 'pending' | 'succumbed' | 'conquered';

interface CategoryDef {
  id: string;
  title: string;
  color: string;
  iconKey: string;
}

interface AntiGoalDef {
  id: string;
  title: string;
}

interface HabitDef {
  id: string;
  title: string;
  createdAt?: string; // YYYY-MM-DD (IST)
}

interface CalendarEvent {
  id: string;
  title: string;
  type: 'workshop' | 'deadline' | 'reminder' | 'leave';
  completed: boolean;
  reminderEmail?: boolean;
}

interface Attachment {
  type: 'file' | 'link';
  name: string;
  url: string;
}

interface CategoryLog {
  goals: string[];
  goalStatus: GoalStatus[]; 
  hours: number;
  notes: string;
  attachments: (string | Attachment)[]; // Supports legacy strings and new Attachment objects
}

interface DailyLog {
  date: string;
  categories: Record<string, CategoryLog>;
  reflection: string;
  rating: number; // 0-5 stars
  events: CalendarEvent[];
  antiGoals: Record<string, AntiGoalStatus>;
  habits: Record<string, boolean>; // id -> completed (true/false)
}

interface UserConfig {
  categories: CategoryDef[];
  antiGoals: AntiGoalDef[];
  habits: HabitDef[];
  streakFreezes: number;
  scholarApps?: ScholarApp[];
}

interface ScholarApp {
  id: string;
  name: string;
  url: string;
  accent: string;
  emoji: string;
}

// --- Constants & Defaults ---
const COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'orange'];
const TRACK_NOTICE_KEY = 'track_notice_ack';

const defaultCategories: CategoryDef[] = [
  { id: 'research', title: 'Research Progress', color: 'indigo', iconKey: 'microscope' },
  { id: 'interview', title: 'PhD Interview Prep', color: 'emerald', iconKey: 'cap' }
];

const defaultAntiGoals: AntiGoalDef[] = [
  { id: 'ag_social', title: 'Social Media Scrolling' },
  { id: 'ag_procrast', title: 'Procrastination' }
];

const defaultHabits: HabitDef[] = [
  { id: 'h_walk', title: 'Morning Walk' },
  { id: 'h_read', title: 'Read Non-Academic' }
];

const defaultScholarApps: ScholarApp[] = [
  { id: 'app_arxiv', name: 'arXiv', url: 'https://arxiv.org/', accent: 'indigo', emoji: '📄' },
  { id: 'app_scholar', name: 'Google Scholar', url: 'https://scholar.google.com/', accent: 'blue', emoji: '🎓' },
  { id: 'app_overleaf', name: 'Overleaf', url: 'https://www.overleaf.com/', accent: 'emerald', emoji: '🧪' },
  { id: 'app_researchgate', name: 'ResearchGate', url: 'https://www.researchgate.net/', accent: 'teal', emoji: '🌐' },
];

const getISTTime = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
const getISTDateStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); // YYYY-MM-DD
const getTodayStr = () => getISTDateStr();

// --- Helpers for Calendar ---
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0 = Sunday

const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
};

// --- Helpers for Attachments ---
const getAttachmentInfo = (item: string | Attachment) => {
  if (typeof item === 'string') {
    // Legacy support
    return {
      url: item,
      name: item.includes('drive.google.com') ? 'Google Drive File' : 'External Link',
      type: 'link'
    };
  }
  return item;
};

// --- Components ---

const ProgressBar = ({ value, max, label, colorClass, suffix = '' }: { value: number, max: number, label: string, colorClass: string, suffix?: string }) => {
    const percentage = Math.min((value / max) * 100, 100);
    return (
        <div className="w-full mb-3">
            <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1">
                <span>{label}</span>
                <span>{value.toFixed(1)} {suffix}</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-500 ${colorClass}`} 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};

const StarRating = ({ rating, onChange, readOnly = false }: { rating: number, onChange?: (r: number) => void, readOnly?: boolean }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => !readOnly && onChange && onChange(star)}
          disabled={readOnly}
          className={`${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
        >
          <Star 
            size={readOnly ? 10 : 24} 
            className={`${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} 
          />
        </button>
      ))}
    </div>
  );
};

const LoginScreen = ({ onLogin }: { onLogin: () => void }) => (
  <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-orange-50 flex flex-col items-center justify-center p-6 text-center font-sans">
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl max-w-md w-full">
      <div className="flex justify-center mb-6">
        <div className="bg-indigo-600 p-4 rounded-xl text-white shadow-lg transform -rotate-3">
          <BookOpen size={40} />
        </div>
      </div>
      <h1 className="font-serif text-3xl font-bold text-slate-900 mb-2">Scholar's Compass</h1>
      <p className="text-slate-500 mb-8">
        Precision tracking for the serious academic. Log your research, analyze your metrics, and master your timeline.
      </p>
      
      <button 
        onClick={onLogin}
        className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white p-4 rounded-xl font-bold hover:bg-slate-800 transition-all hover:scale-[1.02] shadow-md group"
      >
        <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
        <span>Continue with Google</span>
      </button>
      
      <div className="mt-6 text-xs text-slate-400">
        Data is securely stored in your personal account via Firebase.
      </div>
    </div>
  </div>
);

// --- Main Application ---

export default function ScholarsCompass() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [showSetupHint, setShowSetupHint] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  
  // State
  const [config, setConfig] = useState<UserConfig>({ categories: defaultCategories, antiGoals: defaultAntiGoals, habits: defaultHabits, streakFreezes: 2, scholarApps: defaultScholarApps });
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  
  // UI State
  const [dataLoading, setDataLoading] = useState(true);
  const [view, setView] = useState<'morning' | 'dashboard' | 'calendar' | 'library' | 'night' | 'analytics' | 'settings'>('dashboard');
  const [istHour, setIstHour] = useState(getISTTime().getHours());
  const [istMinutes, setIstMinutes] = useState(getISTTime().getMinutes());
  const [showTrackNotice, setShowTrackNotice] = useState(false);
  
  // File Upload State
  const [uploading, setUploading] = useState<string | null>(null);

  // Calendar State
  const [calDate, setCalDate] = useState(getISTTime());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [historyDate, setHistoryDate] = useState<string | null>(null); // For Time Machine Modal
  const [newEventInput, setNewEventInput] = useState('');
  const [newEventType, setNewEventType] = useState<'workshop' | 'deadline' | 'reminder' | 'leave'>('workshop');
  const [newEventEmailReminder, setNewEventEmailReminder] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkSelectedDates, setBulkSelectedDates] = useState<Set<string>>(new Set());
  const [bulkEventTitle, setBulkEventTitle] = useState('');
  const [bulkEventType, setBulkEventType] = useState<'workshop' | 'deadline' | 'reminder' | 'leave'>('workshop');
  const [bulkEmailReminder, setBulkEmailReminder] = useState(false);
  const [bulkAnchorDate, setBulkAnchorDate] = useState<string | null>(null);
  
  // Temp state
  const [newGoalInputs, setNewGoalInputs] = useState<Record<string, string>>({});
  const [newLinkInputs, setNewLinkInputs] = useState<Record<string, string>>({});
  const [newScholarApp, setNewScholarApp] = useState<{ name: string; url: string; accent: string; emoji: string }>({
    name: '',
    url: '',
    accent: 'indigo',
    emoji: '⭐'
  });

  // --- Clock ---
  useEffect(() => {
    const timer = setInterval(() => {
      const ist = getISTTime();
      setIstHour(ist.getHours());
      setIstMinutes(ist.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // --- Auth Logic ---
  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('g_drive_token');
    const storedExpiry = localStorage.getItem('g_drive_token_expiry');
    if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry)) {
        setGoogleAccessToken(storedToken);
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser?.isAnonymous) {
        signOut(auth);
        setUser(null);
      } else {
        setUser(currentUser);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Show Setup Hint on Login ---
  useEffect(() => {
    if (user && !user.isAnonymous) {
      const hasShown = sessionStorage.getItem('setup_hint_shown');
      if (!hasShown) {
        setShowSetupHint(true);
        sessionStorage.setItem('setup_hint_shown', 'true');
      }
      const hasSeenTour = localStorage.getItem('guided_tour_seen');
      if (!hasSeenTour) {
        setTimeout(() => setShowGuidedTour(true), 400); // slight delay for page render
      }
      const hasSeenTrackNotice = localStorage.getItem(TRACK_NOTICE_KEY);
      if (!hasSeenTrackNotice && view === 'dashboard') {
        setShowTrackNotice(true);
      } else if (view !== 'dashboard') {
        setShowTrackNotice(false);
      }
    }
  }, [user, view]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
          setGoogleAccessToken(credential.accessToken);
          // Persist token for 1 hour (approx 3500s safe margin)
          localStorage.setItem('g_drive_token', credential.accessToken);
          localStorage.setItem('g_drive_token_expiry', (Date.now() + 3500 * 1000).toString());
      }
    } catch (error) {
      console.error("Login failed", error);
      alert("Authentication failed. Ensure 'https://my-scholar-tracker.vercel.app' is added to Authorized Domains in Firebase Console.");
    }
  };

  const handleReAuth = async () => {
      await handleLogin();
  };

  const handleLogout = async () => {
    await signOut(auth);
    setLogs([]);
    setTodayLog(null);
    setGoogleAccessToken(null);
    localStorage.removeItem('g_drive_token');
    localStorage.removeItem('g_drive_token_expiry');
    sessionStorage.removeItem('setup_hint_shown');
  };

  // --- Data Fetching ---
  useEffect(() => {
    if (!user || user.isAnonymous || !appId) return;

    const configRef = doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'main');
    getDoc(configRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        const todayStr = getTodayStr();
        const incomingHabits: HabitDef[] = data.habits || defaultHabits.map(h => ({ ...h, createdAt: todayStr }));
        let habitsUpdated = false;
        const normalizedHabits = incomingHabits.map(habit => {
          if (habit.createdAt) return habit;
          habitsUpdated = true;
          return { ...habit, createdAt: todayStr };
        });
        const normalizedConfig: UserConfig = {
          categories: data.categories || defaultCategories,
          antiGoals: data.antiGoals || defaultAntiGoals,
          habits: normalizedHabits,
          streakFreezes: data.streakFreezes !== undefined ? data.streakFreezes : 2,
          scholarApps: data.scholarApps && Array.isArray(data.scholarApps) && data.scholarApps.length > 0 ? data.scholarApps : defaultScholarApps
        };
        setConfig(normalizedConfig);
        if (habitsUpdated) {
          setDoc(configRef, normalizedConfig).catch(e => console.error("Config Habit Normalization Error", e));
        }
      } else {
        const todayStr = getTodayStr();
        const seededHabits = defaultHabits.map(h => ({ ...h, createdAt: todayStr }));
        const initialConfig: UserConfig = { categories: defaultCategories, antiGoals: defaultAntiGoals, habits: seededHabits, streakFreezes: 2, scholarApps: defaultScholarApps };
        setConfig(initialConfig);
        setDoc(configRef, initialConfig).catch(e => console.error("Config Init Error", e));
      }
    }).catch(err => {
      console.error("Config Fetch Error", err);
      setDataLoading(false); 
    });

    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'daily_logs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs: DailyLog[] = [];
      snapshot.forEach((doc) => fetchedLogs.push(doc.data() as DailyLog));
      setLogs(fetchedLogs);
      
      const todayStr = getTodayStr();
      const existingToday = fetchedLogs.find(l => l.date === todayStr);
      
      if (existingToday) {
        setTodayLog(existingToday);
      } else {
        setTodayLog({
          date: todayStr,
          categories: {},
          reflection: '',
          rating: 0,
          events: [],
          antiGoals: {},
          habits: {}
        });
        if (fetchedLogs.length === 0) setView('morning');
      }
      setDataLoading(false);
    }, (error) => {
      console.error("Data Listen Error:", error);
      setDataLoading(false); 
    });

    return () => unsubscribe();
  }, [user]);

  const syncTodayLogToIST = useCallback(() => {
    const newDate = getTodayStr();
    setTodayLog((prev) => {
      if (prev?.date === newDate) return prev;
      const existing = logs.find(l => l.date === newDate);
      const freshLog = existing || createEmptyLog(newDate);
      setSelectedDate(newDate);
      setCalDate(new Date(newDate));
      if (!existing) setView('morning');
      return freshLog;
    });
  }, [logs]);

  // --- Date Rollover Watcher (IST) ---
  useEffect(() => {
    syncTodayLogToIST();
    const interval = setInterval(syncTodayLogToIST, 60 * 1000);
    const handleVisibility = () => document.visibilityState === 'visible' && syncTodayLogToIST();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncTodayLogToIST]);

  // --- Core Logic ---

  const visibleHabitsForDate = (date: string) => {
    return (config.habits || []).filter(h => {
      const startDate = h.createdAt || getTodayStr();
      return date >= startDate;
    });
  };

  const createEmptyLog = (date: string): DailyLog => ({
    date,
    categories: {},
    reflection: '',
    rating: 0,
    events: [],
    antiGoals: {},
    habits: {}
  });

  const getLogForDate = (date: string) => {
    return logs.find(l => l.date === date) || createEmptyLog(date);
  };

  const cloneYesterdayIntoToday = () => {
    if (!todayLog) return;
    const todayDate = todayLog.date;
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const yLog = logs.find(l => l.date === yStr);
    if (!yLog) {
      alert("No log found for yesterday to copy.");
      return;
    }
    const newLog: DailyLog = {
      ...todayLog,
      categories: JSON.parse(JSON.stringify(yLog.categories || {})),
      antiGoals: { ...yLog.antiGoals },
      habits: { ...yLog.habits },
      events: [...(todayLog.events || [])], // keep today's events intact
      reflection: '',
      rating: 0
    };
    saveLog(newLog);
    alert("Copied yesterday's goals and habits into today. You can edit them now.");
  };

  const activeLog = useMemo(() => {
    if (!todayLog) return null;
    const mergedLog = { ...todayLog };
    config.categories.forEach(cat => {
      if (!mergedLog.categories[cat.id]) {
        mergedLog.categories[cat.id] = {
          goals: [],
          goalStatus: [],
          hours: 0,
          notes: '',
          attachments: []
        };
      }
      const catLog = mergedLog.categories[cat.id];
      if (!catLog.goalStatus) catLog.goalStatus = [];
      while (catLog.goalStatus.length < catLog.goals.length) catLog.goalStatus.push('pending');
    });
    if (!mergedLog.antiGoals) mergedLog.antiGoals = {};
    config.antiGoals.forEach(ag => { if (!mergedLog.antiGoals[ag.id]) mergedLog.antiGoals[ag.id] = 'pending'; });
    
    if (!mergedLog.habits) mergedLog.habits = {};
    visibleHabitsForDate(mergedLog.date).forEach(h => { if (mergedLog.habits[h.id] === undefined) mergedLog.habits[h.id] = false; });

    if (!mergedLog.events) mergedLog.events = [];
    if (mergedLog.rating === undefined) mergedLog.rating = 0;
    return mergedLog;
  }, [todayLog, config]);

  const saveLog = async (logToSave: DailyLog) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'daily_logs', logToSave.date), logToSave);
      if (logToSave.date === getTodayStr()) setTodayLog(logToSave);
    } catch (e) { console.error(e); }
  };

  const saveConfig = async (newConfig: UserConfig) => {
    if (!user) return;
    setConfig(newConfig);
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'main'), newConfig);
  };

  // Email reminder scheduling (best effort - tab must stay open)
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    if (user?.email) {
      const earliestByKey = new Map<string, { title: string; type: string; date: string }>();
      logs.forEach(log => {
        (log.events || []).forEach(evt => {
          if (!evt.reminderEmail) return;
          const key = `${evt.title}|${evt.type}`;
          const existing = earliestByKey.get(key);
          if (!existing || log.date < existing.date) {
            earliestByKey.set(key, { title: evt.title, type: evt.type, date: log.date });
          }
        });
      });
      const now = new Date();
      earliestByKey.forEach(({ title, date }) => {
        const eventDate = new Date(`${date}T00:00:00+05:30`);
        const offsets = [24, 12];
        offsets.forEach(hours => {
          const fireTime = new Date(eventDate.getTime() - hours * 60 * 60 * 1000);
          const delay = fireTime.getTime() - now.getTime();
          if (delay > 0 && delay < 1000 * 60 * 60 * 24 * 30) { // limit to 30 days ahead
            const timer = setTimeout(() => {
              const mailto = `mailto:${user.email}?subject=${encodeURIComponent(`Reminder: ${title}`)}&body=${encodeURIComponent(`This is your ${hours} hour reminder for ${title} on ${date}.`)}`;
              window.open(mailto, '_blank');
            }, delay);
            timers.push(timer);
          }
        });
      });
    }
    return () => timers.forEach(t => clearTimeout(t));
  }, [logs, user]);

  // --- Streak Calculation ---
  const currentStreak = useMemo(() => {
    if (logs.length === 0) return 0;
    const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const today = getTodayStr();
    let streak = 0;
    let expectedDate = new Date(getISTTime());
    const isTodayActive = (log: DailyLog) => {
        if (!log) return false;
        const hasHours = Object.values(log.categories).some(c => c.hours > 0);
        const hasGoals = Object.values(log.categories).some(c => c.goalStatus.some(s => s !== 'pending'));
        return log.rating > 0 || hasHours || hasGoals;
    };
    let logIdx = 0;
    const todayLog = sortedLogs.find(l => l.date === today);
    if (todayLog && isTodayActive(todayLog)) {
        streak = 1; expectedDate.setDate(expectedDate.getDate() - 1); 
    } else if (sortedLogs.length > 0 && sortedLogs[0].date === today) {
        logIdx = 1; expectedDate.setDate(expectedDate.getDate() - 1);
    }
    while (logIdx < sortedLogs.length) {
        const log = sortedLogs[logIdx];
        if (log.date === expectedDate.toISOString().split('T')[0]) {
            if (isTodayActive(log)) { streak++; expectedDate.setDate(expectedDate.getDate() - 1); } else { break; }
            logIdx++;
        } else if (new Date(log.date) > expectedDate) { logIdx++; } else { break; }
    }
    return streak;
  }, [logs]);

  // --- Heatmap Data Calculation ---
  const getHabitCompletionMeta = (log?: DailyLog, dateOverride?: string) => {
      const dateStr = dateOverride || log?.date || getTodayStr();
      const visibleHabits = visibleHabitsForDate(dateStr);
      const totalHabits = visibleHabits.length;
      const completed = log ? Object.entries(log.habits || {}).filter(([id, done]) => done && visibleHabits.some(h => h.id === id)).length : 0;
      let status: 'none' | 'partial' | 'full' = 'none';
      if (totalHabits > 0) {
        if (completed === 0) status = 'none';
        else if (completed === totalHabits) status = 'full';
        else status = 'partial';
      }
      return { completed, totalHabits, status };
  };

  const heatmapData = useMemo(() => {
      // Generate last 16 weeks (approx 112 days)
      const days = [];
      const today = new Date();
      // Start from a Sunday approx 16 weeks ago to align with grid
      const endDate = new Date(today);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - (15 * 7) - startDate.getDay()); // 15 weeks back, align to Sunday

      const dateMap = new Map();
      logs.forEach(l => {
          let score = 0;
          const totalHours = Object.values(l.categories).reduce((acc, c) => acc + (c.hours || 0), 0);
          if (totalHours > 0) score = 1;
          if (totalHours > 2) score = 2;
          if (totalHours > 5) score = 3;
          if (totalHours > 8) score = 4;
          dateMap.set(l.date, score);
      });

      let current = new Date(startDate);
      // Generate days until we reach the Saturday after today (or today)
      // We want full weeks for the grid
      const endGrid = new Date(today);
      endGrid.setDate(endGrid.getDate() + (6 - endGrid.getDay()));

      while (current <= endGrid) {
          const dStr = current.toISOString().split('T')[0];
          days.push({
              date: dStr,
              score: dateMap.get(dStr) || 0
          });
          current.setDate(current.getDate() + 1);
      }
      return days;
  }, [logs]);

  const habitHeatmapData = useMemo(() => {
      const days = [];
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - (15 * 7) - startDate.getDay());
      const endGrid = new Date(today);
      endGrid.setDate(endGrid.getDate() + (6 - endGrid.getDay()));

      const logMap = new Map(logs.map(l => [l.date, l]));
      let current = new Date(startDate);
      while (current <= endGrid) {
          const dStr = current.toISOString().split('T')[0];
          const log = logMap.get(dStr);
          const meta = getHabitCompletionMeta(log, dStr);
          days.push({ 
            date: dStr, 
            status: meta.status, 
            completed: meta.completed, 
            total: meta.totalHabits 
          });
          current.setDate(current.getDate() + 1);
      }
      return days;
  }, [logs, config.habits]);

  // --- Handlers ---

  const handleGoalAdd = (catId: string) => {
    if (!activeLog) return;
    const text = newGoalInputs[catId]?.trim();
    if (!text) return;
    const newCatLog = { ...activeLog.categories[catId] };
    newCatLog.goals = [...newCatLog.goals, text];
    newCatLog.goalStatus = [...newCatLog.goalStatus, 'pending'];
    saveLog({ ...activeLog, categories: { ...activeLog.categories, [catId]: newCatLog } });
    setNewGoalInputs(prev => ({ ...prev, [catId]: '' }));
  };

  const handleGoalDelete = (catId: string, idx: number) => {
    if (!activeLog) return;
    const newCatLog = { ...activeLog.categories[catId] };
    newCatLog.goals = newCatLog.goals.filter((_, i) => i !== idx);
    newCatLog.goalStatus = newCatLog.goalStatus.filter((_, i) => i !== idx);
    saveLog({ ...activeLog, categories: { ...activeLog.categories, [catId]: newCatLog } });
  };

  const cycleGoalStatus = (catId: string, idx: number) => {
    if (!activeLog) return;
    const newCatLog = { ...activeLog.categories[catId] };
    const currentStatus = newCatLog.goalStatus[idx] || 'pending';
    let nextStatus: GoalStatus = 'pending';
    if (currentStatus === 'pending') nextStatus = 'progress';
    else if (currentStatus === 'progress') nextStatus = 'completed';
    else if (currentStatus === 'completed') nextStatus = 'pending';
    newCatLog.goalStatus[idx] = nextStatus;
    saveLog({ ...activeLog, categories: { ...activeLog.categories, [catId]: newCatLog } });
  };

  // --- GOOGLE DRIVE UPLOAD HANDLER ---
  const handleFileUpload = async (catId: string, file: File) => {
    if (!activeLog || !user) return;
    
    if (!googleAccessToken) {
        const confirm = window.confirm("To upload to Drive, we need to refresh your secure session. Proceed?");
        if (confirm) await handleReAuth();
        else return;
    }

    setUploading(catId);
    try {
        const metadata = {
            name: `[Scholar] ${file.name}`,
            mimeType: file.type,
            parents: [] 
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
            method: 'POST',
            headers: { Authorization: `Bearer ${googleAccessToken}` },
            body: form
        });

        if (!res.ok) throw new Error("Drive API Error");

        const data = await res.json();
        const driveLink = data.webViewLink;
        
        const newCatLog = { ...activeLog.categories[catId] };
        // SAVE AS OBJECT WITH NAME
        const newAttachment: Attachment = {
            type: 'file',
            name: file.name,
            url: driveLink
        };
        newCatLog.attachments = [...(newCatLog.attachments || []), newAttachment];
        saveLog({ ...activeLog, categories: { ...activeLog.categories, [catId]: newCatLog } });
        
    } catch (error: any) {
        console.error("Upload failed", error);
        alert("Upload failed. Session may have expired. Please click your profile pic to re-login.");
    } finally {
        setUploading(null);
    }
  };

  const handleLinkAdd = (catId: string) => {
    if (!activeLog) return;
    const text = newLinkInputs[catId]?.trim();
    if (!text) return;
    const newCatLog = { ...activeLog.categories[catId] };
    // SAVE AS OBJECT
    const newAttachment: Attachment = {
        type: 'link',
        name: text, // Or user provided name, simplifying to URL for now
        url: text
    };
    newCatLog.attachments = [...(newCatLog.attachments || []), newAttachment];
    saveLog({ ...activeLog, categories: { ...activeLog.categories, [catId]: newCatLog } });
    setNewLinkInputs(prev => ({ ...prev, [catId]: '' }));
  };

  const handleDeleteAttachment = (catId: string, idx: number) => {
    if (!activeLog) return;
    const newCatLog = { ...activeLog.categories[catId] };
    if (!newCatLog.attachments) return;
    
    // Filter out by index
    newCatLog.attachments = newCatLog.attachments.filter((_, i) => i !== idx);
    
    saveLog({ 
        ...activeLog, 
        categories: { ...activeLog.categories, [catId]: newCatLog } 
    });
  };

  const updateHours = (catId: string, val: number) => {
    if (!activeLog) return;
    const newCatLog = { ...activeLog.categories[catId], hours: val };
    saveLog({ ...activeLog, categories: { ...activeLog.categories, [catId]: newCatLog } });
  };

  const updateNotes = (catId: string, text: string) => {
    if (!activeLog) return;
    const newCatLog = { ...activeLog.categories[catId], notes: text };
    saveLog({ ...activeLog, categories: { ...activeLog.categories, [catId]: newCatLog } });
  };

  const toggleAntiGoal = (agId: string) => {
      if (!activeLog) return;
      const current = activeLog.antiGoals[agId] || 'pending';
      let next: AntiGoalStatus = 'pending';
      if (current === 'pending') next = 'conquered';
      else if (current === 'conquered') next = 'succumbed';
      else next = 'pending';
      saveLog({ ...activeLog, antiGoals: { ...activeLog.antiGoals, [agId]: next } });
  };

  const addAntiGoal = () => {
      const id = `ag_${Date.now()}`;
      saveConfig({ ...config, antiGoals: [...config.antiGoals, { id, title: 'New Anti-Goal' }]});
  };

  const acknowledgeTrackNotice = () => {
      setShowTrackNotice(false);
      localStorage.setItem(TRACK_NOTICE_KEY, 'true');
  };

  const deleteAntiGoal = (id: string) => {
      saveConfig({ ...config, antiGoals: config.antiGoals.filter(ag => ag.id !== id)});
  };
  
  const updateAntiGoalTitle = (id: string, title: string) => {
      saveConfig({ ...config, antiGoals: config.antiGoals.map(ag => ag.id === id ? {...ag, title} : ag)});
  };

  const addScholarApp = () => {
      const name = newScholarApp.name.trim();
      const url = newScholarApp.url.trim();
      if (!name || !url) return;
      const app: ScholarApp = {
        id: `app_${Date.now()}`,
        name,
        url,
        accent: newScholarApp.accent || 'indigo',
        emoji: newScholarApp.emoji || '⭐'
      };
      const updated = [...(config.scholarApps || defaultScholarApps), app];
      saveConfig({ ...config, scholarApps: updated });
      setNewScholarApp({ name: '', url: '', accent: 'indigo', emoji: '⭐' });
  };

  const deleteScholarApp = (id: string) => {
      saveConfig({ ...config, scholarApps: (config.scholarApps || []).filter(app => app.id !== id) });
  };

  const toggleHabit = (hId: string) => {
      if (!activeLog) return;
      // Prevent toggling habits that were not active on this date
      const allowed = visibleHabitsForDate(activeLog.date).some(h => h.id === hId);
      if (!allowed) return;
      const current = activeLog.habits[hId] || false;
      saveLog({ ...activeLog, habits: { ...activeLog.habits, [hId]: !current } });
  };

  const addHabit = () => {
      const id = `h_${Date.now()}`;
      saveConfig({ ...config, habits: [...(config.habits || []), { id, title: 'New Habit', createdAt: getTodayStr() }]});
  };

  const deleteHabit = (id: string) => {
      saveConfig({ ...config, habits: config.habits?.filter(h => h.id !== id)});
  };

  const updateHabitTitle = (id: string, title: string) => {
      saveConfig({ ...config, habits: config.habits?.map(h => h.id === id ? {...h, title} : h)});
  };

  const addEvent = (date: string) => {
    if (!newEventInput.trim()) return;
    const log = getLogForDate(date);
    const newEvent: CalendarEvent = { id: `evt_${Date.now()}`, title: newEventInput.trim(), type: newEventType, completed: false, reminderEmail: newEventEmailReminder };
    const updatedLog = { ...log, events: [...(log.events || []), newEvent] };
    saveLog(updatedLog);
    setNewEventInput('');
    setNewEventType('workshop');
    setNewEventEmailReminder(false);
  };

  const deleteEvent = (date: string, evtId: string) => {
    const log = getLogForDate(date);
    const updatedLog = { ...log, events: log.events.filter(e => e.id !== evtId) };
    saveLog(updatedLog);
  };

  const clearAllEventsForDate = (date: string) => {
    const log = getLogForDate(date);
    if (!log.events || log.events.length === 0) return;
    saveLog({ ...log, events: [] });
  };

  const getDateRange = (start: string, end: string) => {
    const dates: string[] = [];
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return [start];
    const dir = s <= e ? 1 : -1;
    let current = new Date(start);
    while ((dir === 1 && current <= e) || (dir === -1 && current >= e)) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + dir);
    }
    return dates;
  };

  const toggleBulkDate = (date: string) => {
    finalizeRangeSelection(date);
  };

  const clearBulkSelection = () => {
    setBulkSelectedDates(new Set());
    setBulkAnchorDate(null);
  };

  const finalizeRangeSelection = (date: string) => {
    if (!bulkAnchorDate) {
      setBulkSelectedDates(new Set([date]));
      setBulkAnchorDate(date);
      return;
    }
    const range = getDateRange(bulkAnchorDate, date);
    setBulkSelectedDates(new Set(range));
    setBulkAnchorDate(null);
  };

  const addBulkEvents = () => {
    if (!bulkEventTitle.trim() || bulkSelectedDates.size === 0) return;
    bulkSelectedDates.forEach(date => {
      const log = getLogForDate(date);
      const newEvent: CalendarEvent = { 
        id: `evt_${Date.now()}_${date}`, 
        title: bulkEventTitle.trim(), 
        type: bulkEventType, 
        completed: false,
        reminderEmail: bulkEmailReminder
      };
      const updatedLog = { ...log, events: [...(log.events || []), newEvent] };
      saveLog(updatedLog);
    });
    setBulkEventTitle('');
    setBulkEventType('workshop');
    setBulkEmailReminder(false);
    clearBulkSelection();
    setBulkSelectMode(false);
    setBulkAnchorDate(null);
  };

  const removeBulkEvents = () => {
    if (!bulkEventTitle.trim() || bulkSelectedDates.size === 0) return;
    bulkSelectedDates.forEach(date => {
      const log = getLogForDate(date);
      const updatedLog = { 
        ...log, 
        events: (log.events || []).filter(ev => !(ev.title === bulkEventTitle.trim() && ev.type === bulkEventType))
      };
      saveLog(updatedLog);
    });
    clearBulkSelection();
  };

  const removeAllEventsFromBulkDates = () => {
    if (bulkSelectedDates.size === 0) return;
    bulkSelectedDates.forEach(date => {
      const log = getLogForDate(date);
      if ((log.events || []).length === 0) return;
      saveLog({ ...log, events: [] });
    });
    clearBulkSelection();
  };

  const updateCategoryTitle = (id: string, newTitle: string) => {
    const newCats = config.categories.map(c => c.id === id ? { ...c, title: newTitle } : c);
    saveConfig({ ...config, categories: newCats });
  };

  const addCategory = () => {
    const id = `cat_${Date.now()}`;
    const color = COLORS[config.categories.length % COLORS.length];
    const newCat: CategoryDef = { id, title: 'New Plan', color, iconKey: 'book' };
    saveConfig({ ...config, categories: [...config.categories, newCat] });
  };

  const deleteCategory = (id: string) => {
    if (config.categories.length <= 2) {
      alert("Minimum 2 plans required.");
      return;
    }
    const newCats = config.categories.filter(c => c.id !== id);
    saveConfig({ ...config, categories: newCats });
  };

  // Stats Logic
  const stats = useMemo(() => {
    const todayStr = getTodayStr();
    const today = getISTTime();
    const currentWeekNum = getWeekNumber(today);
    const currentMonthNum = today.getMonth();
    const currentYear = today.getFullYear();

    const dailyTotals: Record<string, number> = {};
    const weekTotals: Record<string, number> = {};
    const monthTotals: Record<string, number> = {};

    config.categories.forEach(c => {
        dailyTotals[c.id] = 0;
        weekTotals[c.id] = 0;
        monthTotals[c.id] = 0;
    });

    logs.forEach(log => {
        const logDate = new Date(log.date);
        const isToday = log.date === todayStr;
        const isThisWeek = getWeekNumber(logDate) === currentWeekNum && logDate.getFullYear() === currentYear;
        const isThisMonth = logDate.getMonth() === currentMonthNum && logDate.getFullYear() === currentYear;

        config.categories.forEach(c => {
            const h = log.categories?.[c.id]?.hours || 0;
            if (isToday) dailyTotals[c.id] += h;
            if (isThisWeek) weekTotals[c.id] += h;
            if (isThisMonth) monthTotals[c.id] += h;
        });
    });

    return { dailyTotals, weekTotals, monthTotals };
  }, [logs, config]);

  const buildWeeklyReport = () => {
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    
    // Sort logs descending for the report
    const recentLogs = logs.filter(l => new Date(l.date) >= oneWeekAgo && new Date(l.date) <= today)
                           .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let report = `WEEKLY SCHOLAR REPORT\n${oneWeekAgo.toDateString()} - ${today.toDateString()}\n\n`;
    
    // 1. Time Investment
    report += `TIME INVESTMENT:\n`;
    let totalHours = 0;
    config.categories.forEach(cat => {
      const catHours = recentLogs.reduce((acc, log) => acc + (log.categories[cat.id]?.hours || 0), 0);
      totalHours += catHours;
      if (catHours > 0) report += `- ${cat.title}: ${catHours.toFixed(1)} hrs\n`;
    });
    report += `TOTAL: ${totalHours.toFixed(1)} hrs\n\n`;

    // 2. Key Achievements (Green Goals)
    report += `KEY ACHIEVEMENTS:\n`;
    let achievementCount = 0;
    recentLogs.forEach(log => {
      Object.entries(log.categories).forEach(([catId, data]) => {
        const greenGoals = data.goals.filter((_, i) => data.goalStatus[i] === 'completed');
        if (greenGoals.length > 0) {
            report += `[${log.date}] ${config.categories.find(c=>c.id===catId)?.title || 'Task'}:\n`;
            greenGoals.forEach(g => report += `  ✓ ${g}\n`);
            achievementCount += greenGoals.length;
        }
      });
    });
    if (achievementCount === 0) report += "No completed goals logged.\n";
    report += "\n";

    // 3. Field Notes Summary
    report += `FIELD NOTES HIGHLIGHTS:\n`;
    let notesCount = 0;
    recentLogs.forEach(log => {
        const hasNotes = Object.values(log.categories).some(c => c.notes && c.notes.trim().length > 0);
        if (hasNotes) {
            report += `--- ${log.date} ---\n`;
            Object.entries(log.categories).forEach(([catId, data]) => {
                if (data.notes && data.notes.trim().length > 0) {
                     report += `${config.categories.find(c=>c.id===catId)?.title}: ${data.notes}\n`;
                }
            });
            notesCount++;
        }
    });
    if (notesCount === 0) report += "No notes recorded.\n";

    return report;
  };

  const generateWeeklyReport = () => {
    const report = buildWeeklyReport();
    navigator.clipboard.writeText(report);
    alert("Weekly Report copied to clipboard!");
  };

  const downloadWeeklyReportPdf = () => {
    const report = buildWeeklyReport();
    const lines = report.split('\n').map(l => l.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'));
    const contentLines: string[] = ['BT', '/F1 12 Tf', '50 760 Td'];
    lines.forEach((line, idx) => {
      if (idx === 0) contentLines.push(`(${line || ' '}) Tj`);
      else {
        contentLines.push('0 -16 Td');
        contentLines.push(`(${line || ' '}) Tj`);
      }
    });
    contentLines.push('ET');
    const contentStream = contentLines.join('\n');
    const encoder = new TextEncoder();
    const contentLength = encoder.encode(contentStream).length;

    let pdf = '%PDF-1.4\n';
    const offsets: string[] = ['0000000000 65535 f \n'];
    const addObject = (obj: string) => {
      offsets.push(pdf.length.toString().padStart(10, '0') + ' 00000 n \n');
      pdf += obj + '\n';
    };

    addObject('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
    addObject('2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj');
    addObject('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj');
    addObject(`4 0 obj << /Length ${contentLength} >> stream\n${contentStream}\nendstream endobj`);
    addObject('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');

    const xrefStart = pdf.length;
    pdf += 'xref\n';
    pdf += `0 ${offsets.length}\n`;
    offsets.forEach(off => { pdf += off; });
    pdf += `trailer << /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scholar-weekly-report-${getTodayStr()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Library Logic
  const libraryItems = useMemo(() => {
    const items: Array<{ date: string; catTitle: string; color: string; link: string; name: string; type: string }> = [];
    const sortedLogs = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    sortedLogs.forEach(log => {
      Object.entries(log.categories).forEach(([catId, catLog]) => {
        if (catLog.attachments && catLog.attachments.length > 0) {
          const catDef = config.categories.find(c => c.id === catId);
          if (catDef) {
            catLog.attachments.forEach(item => {
              const info = getAttachmentInfo(item);
              items.push({ 
                  date: log.date, 
                  catTitle: catDef.title, 
                  color: catDef.color, 
                  link: info.url,
                  name: info.name,
                  type: info.type
              });
            });
          }
        }
      });
    });
    return items;
  }, [logs, config]);

  // Calendar Render
  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calDate.getFullYear(), calDate.getMonth());
    const firstDay = getFirstDayOfMonth(calDate.getFullYear(), calDate.getMonth()); 
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 bg-slate-50 border border-slate-100 opacity-50"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calDate.getFullYear()}-${String(calDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const log = logs.find(l => l.date === dateStr);
      const hasEvents = log?.events && log.events.length > 0;
      const rating = log?.rating || 0;
      const habitMeta = getHabitCompletionMeta(log, dateStr);
      const isSelected = selectedDate === dateStr;
      const isToday = dateStr === getTodayStr();
      let lifestyleColor = 'bg-slate-200';
      if (habitMeta.status === 'partial') lifestyleColor = 'bg-amber-400';
      if (habitMeta.status === 'full') lifestyleColor = 'bg-emerald-500';

      days.push(
        <div 
          key={d} 
          data-date={dateStr}
          onClick={() => {
            if (bulkSelectMode) toggleBulkDate(dateStr);
            setSelectedDate(dateStr);
          }}
          onDoubleClick={() => setHistoryDate(dateStr)} // Double click for Time Machine
          className={`h-24 p-1 border cursor-pointer transition-colors flex flex-col justify-between relative select-none
            ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-white z-10' : 'border-slate-200 bg-white hover:bg-slate-50'}
            ${isToday ? 'bg-indigo-50' : ''}
          `}
        >
          <div className="flex justify-between items-start">
             <span className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>{d}</span>
             {hasEvents && <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>}
          </div>
          {bulkSelectMode && (
            <div className="absolute top-1 right-1">
              <input 
                type="checkbox" 
                checked={bulkSelectedDates.has(dateStr)} 
                onChange={() => toggleBulkDate(dateStr)} 
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="flex flex-col gap-0.5 mt-1 overflow-hidden">
             {rating > 0 && <div className="flex justify-center my-1"><StarRating rating={rating} readOnly /></div>}
             {log?.events?.slice(0, 2).map((ev, i) => (
               <div key={i} className="text-[8px] bg-rose-100 text-rose-700 rounded px-1 truncate">{ev.title}</div>
             ))}
          </div>
          <div className="mt-auto flex justify-end">
            <div 
              className={`w-3 h-3 rounded-sm border border-slate-200 ${lifestyleColor}`} 
              title={habitMeta.totalHabits > 0 ? `${habitMeta.completed}/${habitMeta.totalHabits} lifestyle habits` : 'No lifestyle habits configured'}
            ></div>
          </div>
        </div>
      );
    }
    return days;
  };

  const changeMonth = (offset: number) => {
    setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + offset, 1));
  };


  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading...</div>;
  if (!user || user.isAnonymous) return <LoginScreen onLogin={handleLogin} />;
  if (dataLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Syncing Scholar's Log...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      
      {/* Time Machine Modal */}
      {historyDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
            
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                  <History size={24} />
                </div>
                <div>
                  <h2 className="font-serif text-2xl font-bold text-slate-900">Time Machine</h2>
                  <p className="text-sm text-slate-500 font-mono">{historyDate}</p>
                </div>
              </div>
              <button 
                onClick={() => setHistoryDate(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8">
              
              {/* Top Summary */}
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                   <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Day Rating</h3>
                   <StarRating rating={getLogForDate(historyDate).rating} readOnly />
                </div>
                <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                   <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Events & Deadlines</h3>
                   <div className="space-y-1">
                     {getLogForDate(historyDate).events?.length === 0 ? (
                       <p className="text-sm text-slate-400 italic">No events recorded.</p>
                     ) : (
                       getLogForDate(historyDate).events.map(ev => (
                         <div key={ev.id} className="text-sm text-rose-700 font-medium flex items-center gap-2">
                           <Bell size={12} /> {ev.title}
                         </div>
                       ))
                     )}
                   </div>
                </div>
                <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100">
                   <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Distractions</h3>
                   <div className="space-y-1">
                     {Object.entries(getLogForDate(historyDate).antiGoals).map(([id, status]) => {
                        const def = config.antiGoals.find(ag => ag.id === id);
                        if (!def || status === 'pending') return null;
                        return (
                          <div key={id} className={`text-xs font-bold px-2 py-1 rounded w-fit ${status === 'conquered' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {def.title}: {status.toUpperCase()}
                          </div>
                        );
                     })}
                     {!Object.values(getLogForDate(historyDate).antiGoals).some(s => s !== 'pending') && (
                       <p className="text-sm text-slate-400 italic">No distractions logged.</p>
                     )}
                   </div>
                </div>
              </div>

              {/* Main Logs */}
              <div className="grid md:grid-cols-2 gap-6">
                {config.categories.map(cat => {
                   const data = getLogForDate(historyDate).categories[cat.id];
                   if (!data) return null;
                   return (
                     <div key={cat.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className={`flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 text-${cat.color}-600`}>
                           <Target size={18} />
                           <h3 className="font-bold text-lg">{cat.title}</h3>
                           <span className="ml-auto font-mono text-sm bg-slate-100 px-2 py-1 rounded text-slate-600">{data.hours} hrs</span>
                        </div>

                        {/* Goals Snapshot */}
                        <div className="mb-4">
                           <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Objectives</h4>
                           <div className="space-y-2">
                              {data.goals.map((g, i) => {
                                const status = data.goalStatus[i] || 'pending';
                                let color = 'bg-slate-100 text-slate-500 border-slate-200';
                                if (status === 'progress') color = 'bg-amber-50 text-amber-700 border-amber-200';
                                if (status === 'completed') color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                return (
                                  <div key={i} className={`text-sm p-2 rounded border ${color} flex justify-between`}>
                                    <span>{g}</span>
                                    <span className="text-[10px] uppercase font-bold self-center">{status}</span>
                                  </div>
                                );
                              })}
                              {data.goals.length === 0 && <p className="text-sm text-slate-400 italic">No goals set.</p>}
                           </div>
                        </div>

                        {/* Notes Snapshot */}
                        <div className="mb-4">
                           <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Field Notes</h4>
                           <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700 whitespace-pre-wrap border border-slate-100 min-h-[60px]">
                              {data.notes || <span className="italic text-slate-400">No notes recorded.</span>}
                           </div>
                        </div>

                        {/* Attachments Snapshot */}
                        <div>
                           <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Attachments</h4>
                           <div className="space-y-1">
                              {data.attachments?.map((item, i) => {
                                 const info = getAttachmentInfo(item);
                                 return (
                                   <a key={i} href={info.url} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 hover:underline truncate">
                                     📎 {info.name}
                                   </a>
                                 )
                              })}
                              {(!data.attachments || data.attachments.length === 0) && <p className="text-sm text-slate-400 italic">No files.</p>}
                           </div>
                        </div>
                     </div>
                   );
                })}
              </div>

              {/* Nightly Reflection */}
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl">
                 <h3 className="text-indigo-900 font-serif font-bold text-lg mb-3 flex items-center gap-2">
                    <Moon size={20} /> Nightly Reflection
                 </h3>
                 <div className="mb-4">
                   <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2">Lifestyle & Habits</h4>
                   <div className="flex flex-wrap gap-2">
                     {config.habits?.map(h => {
                       const done = getLogForDate(historyDate).habits?.[h.id];
                       return (
                         <span key={h.id} className={`text-xs px-2 py-1 rounded border ${done ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                           {h.title}: {done ? 'Done' : 'Missed'}
                         </span>
                       )
                     })}
                   </div>
                 </div>
                 <p className="text-indigo-800/80 whitespace-pre-wrap leading-relaxed">
                    {getLogForDate(historyDate).reflection || "No reflection recorded for this day."}
                 </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Setup Hint Popup / Welcome Guide */}
      {showSetupHint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col relative">
            <button 
              onClick={() => setShowSetupHint(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10"
            >
              <X size={24} />
            </button>
            
            <div className="p-8">
              <div className="flex flex-col items-center mb-6">
                <div className="bg-indigo-100 p-4 rounded-full text-indigo-600 mb-4 shadow-sm">
                  <BookOpen size={48} />
                </div>
                <h3 className="font-serif text-3xl font-bold text-slate-900 mb-2">Welcome to Scholar's Compass</h3>
                <p className="text-slate-500 text-center max-w-md">
                  A precision instrument designed for the rigors of academic research.
                </p>
              </div>

              <div className="space-y-6">
                
                {/* Feature Manual */}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
                    <Info size={14} /> User Manual & Capabilities
                  </h4>
                  <ul className="space-y-3 text-sm text-slate-600">
                    <li className="flex gap-3">
                      <Settings size={18} className="text-indigo-500 shrink-0" />
                      <span><strong>Dynamic Configuration:</strong> Visit the <strong>Setup</strong> tab to define your specific research vectors. Add/Remove plans and distraction logs (Anti-Goals).</span>
                    </li>
                    <li className="flex gap-3">
                      <Target size={18} className="text-emerald-500 shrink-0" />
                      <span><strong>Tri-State Objectives:</strong> Tap any goal to cycle its status: <span className="text-rose-500">Pending</span> → <span className="text-amber-500">In Progress</span> → <span className="text-emerald-600">Done</span>.</span>
                    </li>
                    <li className="flex gap-3">
                      <History size={18} className="text-purple-500 shrink-0" />
                      <span><strong>Time Machine:</strong> Double-click any date in the <strong>Calendar</strong> to open a full historical snapshot of that day's work, notes, and ratings.</span>
                    </li>
                    <li className="flex gap-3">
                      <BarChart3 size={18} className="text-blue-500 shrink-0" />
                      <span><strong>Longitudinal Analytics:</strong> Track your investment with Daily (6h), Weekly (40h), and Monthly (160h) load matrices.</span>
                    </li>
                  </ul>
                </div>

                {/* Security Guarantee */}
                <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-900 uppercase text-xs tracking-wider mb-3 flex items-center gap-2">
                    <ShieldCheck size={14} /> Data Sovereignty & Security Protocol
                  </h4>
                  <p className="text-sm text-emerald-800 leading-relaxed mb-3">
                    We understand that in Ph.D. research, data confidentiality is paramount. This application is architected with a <strong>Zero-Access</strong> philosophy:
                  </p>
                  <ul className="text-sm text-emerald-800 space-y-2 list-disc list-inside">
                    <li><strong>Identity Isolation:</strong> Database entries are cryptographically locked to your unique Google ID using Row-Level Security rules.</li>
                    <li><strong>Your Drive, Your Data:</strong> All uploaded files (PDFs, images) are stored directly in <strong>your personal Google Drive</strong>. We store only the link.</li>
                    <li><strong>Full Ownership:</strong> You retain complete control and ownership of your intellectual property.</li>
                  </ul>
                </div>

              </div>

              <div className="mt-8 flex gap-4">
                <button 
                  onClick={() => setShowSetupHint(false)} 
                  className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors border border-slate-200"
                >
                  Close Guide
                </button>
                <button 
                  onClick={() => { setShowSetupHint(false); setView('settings'); }} 
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                  Configure My Plans
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Track Upload Security Notice */}
      {showTrackNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-indigo-100">
            <div className="bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 shadow-inner">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <p className="text-xs uppercase font-bold text-indigo-500 tracking-[0.08em]">Upload Safety</p>
                  <h3 className="text-xl font-serif font-bold text-slate-900">Refresh Google Drive access</h3>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                For your security, the Google Drive session we use to store your files expires every hour. If you have been logged in for more than 60 minutes, tap your profile photo to re-authenticate before uploading. This keeps your data private and under your control.
              </p>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => setShowTrackNotice(false)}
                  className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                >
                  Remind me later
                </button>
                <button
                  onClick={acknowledgeTrackNotice}
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-200 transition-transform hover:translate-y-[-1px]"
                >
                  Got it, stay safe
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guided Tour Overlay (first login only) */}
      {showGuidedTour && (
        <div className="fixed inset-0 z-[60] pointer-events-none">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => { setShowGuidedTour(false); localStorage.setItem('guided_tour_seen', 'true'); }}></div>
          <div className="pointer-events-auto">
            <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-white shadow-2xl border border-slate-200 rounded-xl p-4 w-[90%] max-w-3xl">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-indigo-100 text-indigo-700 p-2 rounded-full"><BookOpen size={18} /></div>
                <h3 className="font-serif text-xl font-bold text-slate-900">1-minute tour</h3>
              </div>
              <ol className="list-decimal list-inside text-sm text-slate-700 space-y-2">
                <li><strong>Morning:</strong> Set goals and plans for the day.</li>
                <li><strong>Dashboard:</strong> Track goals, hours, files, and distractions.</li>
                <li><strong>Calendar:</strong> Double-click any date to open <em>Time Machine</em> and see full history.</li>
                <li><strong>Night:</strong> Rate the day, mark habits, and write reflections.</li>
               
              </ol>
              <div className="mt-3 text-xs text-slate-500">You can revisit anytime via the header “?” badge.</div>
              <div className="mt-3 flex justify-end">
                <button 
                  onClick={() => { setShowGuidedTour(false); localStorage.setItem('guided_tour_seen', 'true'); }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700"
                >
                  Got it
                </button>
              </div>
            </div>
            <div className="fixed top-[70px] left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
              <div className="flex gap-2 bg-white/90 text-slate-700 px-3 py-1 rounded-full shadow-md text-[11px] font-bold uppercase tracking-wide">
                <span className="text-orange-600">Morning</span>
                <span className="text-indigo-600">Dashboard</span>
                <span className="text-sky-600">Calendar</span>
                <span className="text-purple-600">Night</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded text-white hidden sm:block">
              <BookOpen size={20} />
            </div>
            <h1 className="font-serif font-bold text-lg tracking-tight text-slate-900">Scholar's Compass</h1>
            
            <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-slate-200">
               <div className="flex items-center gap-1 text-orange-500" title="Current Streak">
                  <Flame size={16} className={currentStreak > 0 ? 'fill-orange-500 animate-pulse' : 'text-slate-300'} />
                  <span className={`font-mono font-bold ${currentStreak > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{currentStreak}</span>
               </div>
               <div className="flex items-center gap-1 text-sky-500" title="Streak Freezes Available">
                  <Snowflake size={16} className="fill-sky-100" />
                  <span className="font-mono font-bold text-sky-600">{config.streakFreezes}</span>
               </div>
               <button 
                 onClick={() => { setShowGuidedTour(true); }}
                 className="ml-2 text-[11px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                 title="Show guided tour"
               >
                 ?
               </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
                {[
                { id: 'morning', icon: Sun, label: 'Plan' },
                { id: 'dashboard', icon: CalendarDays, label: 'Track' },
                { id: 'calendar', icon: CalendarIcon, label: 'Cal' },
                { id: 'library', icon: FolderOpen, label: 'Lib' },
                { id: 'analytics', icon: BarChart3, label: 'Data' },
                { id: 'night', icon: Moon, label: 'Reflect' },
                { id: 'settings', icon: Settings, label: 'Setup' },
                ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setView(tab.id as any)}
                    className={`p-2 rounded-md transition-all flex items-center gap-2 ${view === tab.id ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <tab.icon size={18} />
                    <span className="hidden lg:inline text-xs font-bold uppercase">{tab.label}</span>
                </button>
                ))}
            </div>
            
            {/* User Profile & Logout */}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
              {user?.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "User"} 
                  className="w-8 h-8 rounded-full border border-slate-200 shadow-sm cursor-pointer hover:ring-2 hover:ring-indigo-300"
                  onClick={handleReAuth}
                  title="Click to refresh Drive session"
                />
              ) : (
                <div 
                    className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-200 cursor-pointer" 
                    onClick={handleReAuth}
                    title="Click to refresh Drive session"
                >
                  {user.displayName?.[0] || user.email?.[0] || 'U'}
                </div>
              )}
              <button 
                  onClick={handleLogout} 
                  className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                  title="Sign Out"
              >
                  <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* --- VIEW: CALENDAR --- */}
        {view === 'calendar' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif text-xl font-bold text-slate-900">
                    {calDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="flex gap-2">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={20} /></button>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={20} /></button>
                  </div>
                </div>
                
                <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500 uppercase">{d}</div>
                  ))}
                  {renderCalendar()}
                </div>
                <div className="mt-4 text-xs text-center text-slate-400 italic">Double-click a date to view full history (Time Machine)</div>
              </div>

              <div className="w-full md:w-80 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                   <div>
                     <div className="text-xs font-bold text-slate-400 uppercase">Selected Date</div>
                     <div className="font-serif text-xl font-bold text-slate-900">{selectedDate}</div>
                   </div>
                   {selectedDate === getTodayStr() && <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">Today</div>}
               </div>
               
               {/* Bulk Selection Controls */}
               <div className="mb-6 border border-dashed border-slate-200 rounded-lg p-3 bg-slate-50">
                 <div className="flex items-center justify-between mb-2">
                   <div className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                     <CalendarIcon size={12} /> Bulk events
                   </div>
                   <button 
                     onClick={() => { setBulkSelectMode(!bulkSelectMode); if (!bulkSelectMode) { clearBulkSelection(); setBulkAnchorDate(null); } }}
                     className={`text-[11px] px-2 py-1 rounded font-bold ${bulkSelectMode ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                   >
                     {bulkSelectMode ? 'Selecting...' : 'Start selecting'}
                   </button>
                 </div>
                 <div className="text-[11px] text-slate-500 mb-2">Click dates in the calendar to toggle them.</div>
                 <div className="text-[11px] text-slate-500 mb-2">Tip: click a start date, then click an end date to auto-select the full range.</div>
                 <div className="flex flex-wrap gap-2 mb-2">
                   {Array.from(bulkSelectedDates).map(d => (
                     <span key={d} className="text-[10px] px-2 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-200">{d}</span>
                   ))}
                   {bulkSelectedDates.size === 0 && <span className="text-[11px] text-slate-400 italic">No dates selected.</span>}
                 </div>
                 <div className="flex gap-2 mb-2">
                   <input 
                     value={bulkEventTitle}
                     onChange={(e) => setBulkEventTitle(e.target.value)}
                     placeholder="Workshop / Leave title..."
                     className="flex-1 text-xs p-2 border border-slate-200 rounded focus:border-indigo-500 outline-none"
                   />
                   <select 
                     value={bulkEventType}
                     onChange={(e) => setBulkEventType(e.target.value as any)}
                     className="text-xs p-2 border border-slate-200 rounded bg-white"
                   >
                     <option value="workshop">Workshop</option>
                     <option value="deadline">Deadline</option>
                     <option value="reminder">Reminder</option>
                     <option value="leave">Leave</option>
                   </select>
                 </div>
                 <label className="flex items-center gap-2 text-[11px] text-slate-600 mb-2">
                   <input type="checkbox" checked={bulkEmailReminder} onChange={(e) => setBulkEmailReminder(e.target.checked)} />
                   Email reminder (opens mail client 24h & 12h before first date, tab must be open)
                 </label>
                 <div className="flex gap-2">
                   <button 
                     onClick={addBulkEvents}
                     className="flex-1 bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                     disabled={bulkSelectedDates.size === 0 || !bulkEventTitle.trim()}
                   >
                     Add events
                   </button>
                  
                   <button 
                     onClick={clearBulkSelection}
                     className="text-xs px-3 py-2 rounded border border-slate-200 text-slate-500 hover:bg-slate-100"
                   >
                     Clear selection
                   </button>
                   <button 
                     onClick={removeAllEventsFromBulkDates}
                     className="text-xs px-3 py-2 rounded border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                     disabled={bulkSelectedDates.size === 0}
                   >
                     Remove all on dates
                   </button>
                 </div>
               </div>

                <div className="mb-6">
                   <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
                     <Bell size={12} className="text-rose-500" /> Events
                   </h3>
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-[11px] text-slate-500">Manage events for this date.</span>
                     <button 
                       onClick={() => clearAllEventsForDate(selectedDate)} 
                       className="text-[11px] px-2 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                       disabled={getLogForDate(selectedDate).events?.length === 0}
                     >
                       Remove all
                     </button>
                   </div>
                   <div className="space-y-2 mb-3">
                     {getLogForDate(selectedDate).events?.length === 0 && <p className="text-xs text-slate-400 italic">No events scheduled.</p>}
                     {getLogForDate(selectedDate).events?.map(evt => (
                       <div key={evt.id} className="flex justify-between items-center bg-rose-50 text-rose-900 p-2 rounded text-xs border border-rose-100">
                          <span>{evt.title}</span>
                          {evt.reminderEmail && <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">Email 24h/12h</span>}
                          <button onClick={() => deleteEvent(selectedDate, evt.id)} className="text-rose-400 hover:text-rose-600"><X size={12} /></button>
                       </div>
                     ))}
                   </div>
                   <div className="flex gap-2">
                     <input 
                       value={newEventInput}
                       onChange={(e) => setNewEventInput(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && addEvent(selectedDate)}
                       placeholder="Add workshop..."
                       className="flex-1 text-xs p-2 border border-slate-200 rounded focus:border-rose-500 outline-none"
                     />
                     <select 
                       value={newEventType}
                       onChange={(e) => setNewEventType(e.target.value as any)}
                       className="text-xs p-2 border border-slate-200 rounded bg-white"
                     >
                       <option value="workshop">Workshop</option>
                       <option value="deadline">Deadline</option>
                       <option value="reminder">Reminder</option>
                       <option value="leave">Leave</option>
                     </select>
                      <button onClick={() => addEvent(selectedDate)} className="bg-rose-600 text-white p-2 rounded hover:bg-rose-700"><Plus size={14} /></button>
                   </div>
                     <label className="flex items-center gap-1 text-[10px] text-slate-500">
                       <input type="checkbox" checked={newEventEmailReminder} onChange={(e) => setNewEventEmailReminder(e.target.checked)} />
                       Email reminders
                     </label>
                     </div>

                {/* Distraction Log in Calendar */}
                <div className="mb-6">
                    <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
                     <Skull size={12} className="text-slate-400" /> Distraction Log
                   </h3>
                   <div className="space-y-2">
                       {config.antiGoals.map(ag => {
                           const status = getLogForDate(selectedDate).antiGoals[ag.id] || 'pending';
                           let badgeClass = 'bg-slate-100 text-slate-400';
                           if (status === 'conquered') badgeClass = 'bg-emerald-100 text-emerald-700';
                           if (status === 'succumbed') badgeClass = 'bg-rose-100 text-rose-700';
                           
                           return (
                               <div key={ag.id} className="flex justify-between items-center text-xs">
                                   <span className="text-slate-600">{ag.title}</span>
                                   <span className={`px-1.5 py-0.5 rounded uppercase text-[10px] font-bold ${badgeClass}`}>{status === 'pending' ? '-' : status}</span>
                               </div>
                           )
                       })}
                   </div>
                </div>

                {/* Attachments Section in Calendar */}
                <div className="mb-6">
                    <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
                        <Paperclip size={12} className="text-slate-400" /> Attachments
                    </h3>
                    <div className="space-y-1">
                    {Object.entries(getLogForDate(selectedDate).categories).flatMap(([catId, data]) => 
                        (data.attachments || []).map((item, i) => {
                            const catDef = config.categories.find(c => c.id === catId);
                            const info = getAttachmentInfo(item);
                            return (
                                <a key={`${catId}-${i}`} href={info.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded text-xs hover:bg-slate-100 transition-colors group">
                                    <div className={`w-1 h-4 rounded-full bg-${catDef?.color || 'slate'}-400`}></div>
                                    <div className="flex-1 truncate text-slate-600 group-hover:text-blue-600" title={info.name}>
                                        {info.name}
                                    </div>
                                    <ExternalLink size={10} className="text-slate-300 group-hover:text-blue-400" />
                                </a>
                            );
                        })
                    )}
                    {!Object.values(getLogForDate(selectedDate).categories).some(c => c.attachments?.length) && (
                        <p className="text-xs text-slate-400 italic">No files attached for this date.</p>
                    )}
                    </div>
                </div>

                {/* Lifestyle Summary in Calendar */}
                <div className="mb-6">
                   <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
                     <Heart size={12} className="text-rose-400" /> Lifestyle
                   </h3>
                   {(() => {
                      const meta = getHabitCompletionMeta(getLogForDate(selectedDate), selectedDate);
                      const statusClass = meta.status === 'full' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                                         : meta.status === 'partial' ? 'bg-amber-100 text-amber-700 border-amber-200'
                                         : 'bg-slate-100 text-slate-500 border-slate-200';
                      const statusLabel = meta.totalHabits === 0 ? 'No lifestyle habits configured' 
                                          : meta.status === 'full' ? 'All habits followed' 
                                          : meta.status === 'partial' ? 'Partially followed' 
                                          : 'Not followed';
                      return (
                        <div className="space-y-2">
                          <div className={`text-[10px] px-2 py-1 rounded-full border inline-flex items-center gap-2 ${statusClass}`}>
                            <div className="w-2 h-2 rounded-full bg-current opacity-70"></div>
                            <span className="font-bold uppercase">{statusLabel}</span>
                            {meta.totalHabits > 0 && <span className="font-mono">{meta.completed}/{meta.totalHabits}</span>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {visibleHabitsForDate(selectedDate).map(h => {
                              const done = getLogForDate(selectedDate).habits?.[h.id];
                              return (
                                <span key={h.id} className={`text-[10px] px-2 py-0.5 rounded-full border ${done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                  {h.title}: {done ? 'Done' : 'Missed'}
                                </span>
                              )
                            })}
                            {visibleHabitsForDate(selectedDate).length === 0 && <p className="text-xs text-slate-400 italic">No habits configured for this date.</p>}
                          </div>
                        </div>
                      );
                   })()}
                </div>

                <div>
                   <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">Log Summary</h3>
                   <div className="mb-2">
                     <StarRating rating={getLogForDate(selectedDate).rating} readOnly />
                   </div>
                   <div className="space-y-3">
                    {Object.entries(getLogForDate(selectedDate).categories).map(([catId, data]) => {
                        const catDef = config.categories.find(c => c.id === catId);
                        if (!catDef || (!data.hours && !data.goalStatus?.some(s => s !== 'pending'))) return null;
                        
                        const redCount = data.goalStatus.filter(s => s === 'pending').length;
                        const yellowCount = data.goalStatus.filter(s => s === 'progress').length;
                        const greenCount = data.goalStatus.filter(s => s === 'completed').length;

                        return (
                        <div key={catId} className="text-xs border-b border-slate-50 pb-2 last:border-0">
                            <div className={`font-bold text-${catDef.color}-600 mb-1`}>{catDef.title}</div>
                            {data.hours > 0 && <div className="text-slate-600 font-mono mb-1">{data.hours} hrs</div>}
                            <div className="flex gap-2">
                                {redCount > 0 && <span className="text-rose-600 bg-rose-50 px-1 rounded flex items-center gap-1"><Circle size={8} className="fill-rose-600" /> {redCount} Not Met</span>}
                                {yellowCount > 0 && <span className="text-amber-600 bg-amber-50 px-1 rounded flex items-center gap-1"><PlayCircle size={8} className="fill-amber-600" /> {yellowCount} Partial</span>}
                                {greenCount > 0 && <span className="text-emerald-600 bg-emerald-50 px-1 rounded flex items-center gap-1"><CheckCircle2 size={8} className="fill-emerald-600" /> {greenCount} Done</span>}
                            </div>
                        </div>
                        );
                    })}
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: LIBRARY --- */}
        {view === 'library' && (
           <div className="animate-fade-in space-y-6">
               <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
                 <h2 className="font-serif text-2xl font-bold text-blue-900 mb-2">Knowledge Repository</h2>
                 <p className="text-blue-800/80">Centralized archive of all files, proofs, and links.</p>
               </div>

               {/* Scholar Quick Launch */}
               <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-xs uppercase font-bold text-slate-400">Scholar Apps</p>
                     <h3 className="font-serif text-lg font-bold text-slate-900">Your go-to tools</h3>
                   </div>
                   <div className="text-[11px] text-slate-500">Add, remove, or open instantly.</div>
                 </div>
                 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                   {(config.scholarApps || defaultScholarApps).map(app => (
                     <div key={app.id} className={`p-3 rounded-xl border border-${app.accent}-100 bg-${app.accent}-50/60 flex items-center gap-3`}>
                       <div className={`w-10 h-10 rounded-full bg-${app.accent}-100 flex items-center justify-center text-xl`}>
                         {app.emoji}
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="text-sm font-bold text-slate-800 truncate">{app.name}</div>
                         <a href={app.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 truncate hover:underline">{app.url}</a>
                       </div>
                       <div className="flex items-center gap-1">
                         <a href={app.url} target="_blank" rel="noreferrer" className={`p-2 rounded-lg text-${app.accent}-700 hover:bg-white/70`} title={`Open ${app.name}`}>
                           <ExternalLink size={16} />
                         </a>
                         <button onClick={() => deleteScholarApp(app.id)} className="p-2 text-slate-400 hover:text-rose-600" title="Remove">
                           <Trash2 size={14} />
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
                 <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 items-end border-t border-slate-100 pt-3">
                   <div className="md:col-span-2">
                     <label className="text-[11px] text-slate-500 uppercase font-bold">App name</label>
                     <input 
                       value={newScholarApp.name}
                       onChange={(e) => setNewScholarApp({ ...newScholarApp, name: e.target.value })}
                       placeholder="Zotero"
                       className="w-full mt-1 p-2 rounded border border-slate-200 text-sm focus:border-indigo-500 outline-none"
                     />
                   </div>
                   <div className="md:col-span-2">
                     <label className="text-[11px] text-slate-500 uppercase font-bold">URL</label>
                     <input 
                       value={newScholarApp.url}
                       onChange={(e) => setNewScholarApp({ ...newScholarApp, url: e.target.value })}
                       placeholder="https://www.zotero.org/"
                       className="w-full mt-1 p-2 rounded border border-slate-200 text-sm focus:border-indigo-500 outline-none"
                     />
                   </div>
                   <div>
                     <label className="text-[11px] text-slate-500 uppercase font-bold">Accent</label>
                     <select 
                       value={newScholarApp.accent}
                       onChange={(e) => setNewScholarApp({ ...newScholarApp, accent: e.target.value })}
                       className="w-full mt-1 p-2 rounded border border-slate-200 text-sm bg-white focus:border-indigo-500 outline-none"
                     >
                       {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                       <option value="teal">teal</option>
                     </select>
                   </div>
                   <div>
                     <label className="text-[11px] text-slate-500 uppercase font-bold">Emoji</label>
                     <input 
                       value={newScholarApp.emoji}
                       onChange={(e) => setNewScholarApp({ ...newScholarApp, emoji: e.target.value })}
                       maxLength={2}
                       className="w-full mt-1 p-2 rounded border border-slate-200 text-sm focus:border-indigo-500 outline-none"
                     />
                   </div>
                   <div className="md:col-span-4 flex justify-end">
                     <button 
                       onClick={addScholarApp}
                       className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                       disabled={!newScholarApp.name.trim() || !newScholarApp.url.trim()}
                     >
                       Add app
                     </button>
                   </div>
                 </div>
               </div>

               {libraryItems.length === 0 ? (
                 <div className="text-center py-20 text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
                   <FolderOpen size={48} className="mx-auto mb-4 opacity-50" />
                   <p>No resources logged yet. Add links in the "Track" tab.</p>
                 </div>
             ) : (
               <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {libraryItems.map((item, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                       <div className="flex items-center justify-between mb-3">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-${item.color}-50 text-${item.color}-600`}>
                            {item.catTitle}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{item.date}</span>
                       </div>
                       <a href={item.link} target="_blank" rel="noreferrer" className="flex items-start gap-3 group-hover:bg-slate-50 p-2 rounded transition-colors">
                          <div className="bg-slate-100 p-2 rounded text-slate-500">
                             {item.type === 'file' ? <HardDrive size={16} /> : (item.link.includes('firebasestorage') ? <UploadCloud size={16} /> : <Link size={16} />)}
                          </div>
                          <div className="flex-1 overflow-hidden">
                             <div className="text-xs font-bold text-slate-700 truncate mb-1" title={item.name}>
                                {item.name}
                             </div>
                             <div className="text-[10px] text-blue-500 truncate">{item.link}</div>
                          </div>
                       </a>
                    </div>
                  ))}
               </div>
             )}
           </div>
        )}

        {/* --- VIEW: SETTINGS --- */}
        {view === 'settings' && (
           <div className="animate-fade-in space-y-6">
             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
               <h2 className="font-serif text-xl font-bold text-slate-900 mb-4">Plan Configuration</h2>
               <div className="space-y-4 mb-6">
                 {config.categories.map((cat) => (
                   <div key={cat.id} className="flex items-center gap-3">
                     <div className={`w-3 h-3 rounded-full bg-${cat.color}-500`}></div>
                     <input 
                       value={cat.title}
                       onChange={(e) => updateCategoryTitle(cat.id, e.target.value)}
                       className="flex-1 p-2 border border-slate-300 rounded text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
                     />
                     <button onClick={() => deleteCategory(cat.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                   </div>
                 ))}
               </div>
               <button onClick={addCategory} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 mb-8"><Plus size={16} /> Add New Plan</button>
               
               <h2 className="font-serif text-xl font-bold text-slate-900 mb-4">Lifestyle Habits</h2>
               <div className="space-y-4 mb-6">
                 {config.habits?.map((h) => (
                   <div key={h.id} className="flex items-center gap-3">
                     <Activity size={16} className="text-slate-400" />
                     <input 
                       value={h.title}
                       onChange={(e) => updateHabitTitle(h.id, e.target.value)}
                       className="flex-1 p-2 border border-slate-300 rounded text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
                     />
                     <button onClick={() => deleteHabit(h.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                   </div>
                 ))}
               </div>
               <button onClick={addHabit} className="flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 mb-8"><Plus size={16} /> Add Habit</button>

               <h2 className="font-serif text-xl font-bold text-slate-900 mb-4">Anti-Goals (Distractions)</h2>
               <div className="space-y-4 mb-6">
                 {config.antiGoals.map((ag) => (
                   <div key={ag.id} className="flex items-center gap-3">
                     <Skull size={16} className="text-slate-400" />
                     <input 
                       value={ag.title}
                       onChange={(e) => updateAntiGoalTitle(ag.id, e.target.value)}
                       className="flex-1 p-2 border border-slate-300 rounded text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
                     />
                     <button onClick={() => deleteAntiGoal(ag.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                   </div>
                 ))}
               </div>
               <button onClick={addAntiGoal} className="flex items-center gap-2 text-sm font-bold text-rose-600 hover:text-rose-700"><Plus size={16} /> Add Anti-Goal</button>

               {/* ACCOUNT SECTION */}
               <div className="border-t border-slate-200 pt-6 mt-8">
                 <h2 className="font-serif text-xl font-bold text-slate-900 mb-4">Account</h2>
                 <div className="flex items-center gap-4 mb-4">
                    {user?.photoURL ? (
                        <img src={user.photoURL} className="w-10 h-10 rounded-full border border-slate-200" alt="Profile" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200">
                            {user?.displayName?.[0] || user?.email?.[0] || 'U'}
                        </div>
                    )}
                    <div>
                        <div className="text-sm font-bold text-slate-700">{user?.displayName || 'Scholar'}</div>
                        <div className="text-xs text-slate-500">{user?.email}</div>
                    </div>
                 </div>
                 <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-600 p-3 rounded-xl font-bold hover:bg-rose-50 hover:text-rose-600 transition-colors"
                 >
                    <LogOut size={18} /> Sign Out
                 </button>
               </div>
             </div>
           </div>
        )}
        
        {/* --- VIEW: MORNING --- */}
        {view === 'morning' && (
          <div className="animate-fade-in space-y-6">
            {activeLog.events && activeLog.events.length > 0 && (
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3">
                 <AlertCircle className="text-rose-500 shrink-0" size={20} />
                 <div>
                   <h3 className="font-bold text-rose-800 text-sm">Happening Today</h3>
                   <ul className="list-disc list-inside text-xs text-rose-700 mt-1">
                     {activeLog.events.map(ev => <li key={ev.id}>{ev.title}</li>)}
                   </ul>
                 </div>
              </div>
            )}

            <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-100">
              <h2 className="font-serif text-2xl font-bold text-orange-900 mb-2">Morning Resolutions</h2>
              <p className="text-orange-800/80">Define your vectors for the day.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button 
                  onClick={cloneYesterdayIntoToday}
                  className="flex items-center gap-2 text-xs font-bold bg-white text-orange-700 px-3 py-2 rounded border border-orange-200 hover:bg-orange-100 shadow-sm"
                >
                  <History size={14} /> Same as yesterday
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-6">
                {config.categories.map(cat => (
                  <div key={cat.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 text-${cat.color}-600`}>{cat.title}</h3>
                    <div className="space-y-2 mb-3">
                      {activeLog.categories[cat.id]?.goals.map((g, i) => (
                        <div key={i} className="flex items-center justify-between text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 group">
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full bg-${cat.color}-400`}></div>
                            <span>{g}</span>
                          </div>
                          <button 
                            onClick={() => handleGoalDelete(cat.id, i)}
                            className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                            title="Remove Goal"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        value={newGoalInputs[cat.id] || ''}
                        onChange={(e) => setNewGoalInputs({ ...newGoalInputs, [cat.id]: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleGoalAdd(cat.id)}
                        placeholder="Add goal..."
                        className="flex-1 text-sm p-2 rounded border border-slate-300 focus:border-indigo-500 outline-none"
                      />
                      <button onClick={() => handleGoalAdd(cat.id)} className="p-2 bg-slate-800 text-white rounded"><ChevronRight size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col justify-center items-center text-center p-8 bg-slate-800 rounded-xl text-slate-300">
                <Sun size={48} className="text-orange-400 mb-4" />
                <h3 className="font-serif text-xl text-white mb-2">Ready to execute?</h3>
                <button onClick={() => setView('dashboard')} className="mt-6 bg-white text-slate-900 px-6 py-2 rounded-full font-bold text-sm hover:bg-orange-50">Go to Tracker</button>
                
                <div className="mt-8 pt-8 border-t border-slate-700 w-full">
                  <p className="text-xs italic text-slate-400">created by Bikram with love</p>
                  <p className="text-[10px] text-slate-500 mt-1">For assists and suggestion drop an email to <a href="mailto:bikrampoddar2@gmail.com" className="hover:text-slate-300">bikrampoddar2@gmail.com</a></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: TRACKER / DASHBOARD --- */}
        {view === 'dashboard' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                 <h2 className="font-serif text-2xl font-bold text-slate-900">Today's Ledger</h2>
                 <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block mt-1">{todayLog?.date}</span>
              </div>
              
              {activeLog.events && activeLog.events.length > 0 ? (
                 <div className="bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg flex items-center gap-3 animate-pulse-slow">
                    <Bell size={16} className="text-rose-600" />
                    <div className="text-sm text-rose-800 font-bold">
                      {activeLog.events.length} Event{activeLog.events.length > 1 ? 's' : ''} Today
                    </div>
                 </div>
              ) : null}
            </div>

            {/* Anti-Goal Section */}
            <div className="bg-slate-800 p-5 rounded-xl text-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-rose-400">
                    <ShieldAlert size={16} /> Anti-Goals / Distraction Log
                </h3>
                <div className="flex flex-wrap gap-4">
                    {config.antiGoals.map(ag => {
                        const status = activeLog.antiGoals[ag.id] || 'pending';
                        let statusColor = 'bg-slate-700 text-slate-400';
                        if (status === 'conquered') statusColor = 'bg-emerald-900/50 border border-emerald-500/50 text-emerald-400';
                        if (status === 'succumbed') statusColor = 'bg-rose-900/50 border border-rose-500/50 text-rose-400';
                        
                        return (
                            <button 
                                key={ag.id}
                                onClick={() => toggleAntiGoal(ag.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${statusColor}`}
                            >
                                {ag.title}
                                <span className="block text-[9px] uppercase font-normal opacity-70 mt-1">
                                    {status === 'pending' ? '?' : status}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <p className="text-[10px] text-slate-500 mt-3 italic">Tap to toggle: Pending → Conquered → Succumbed</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {config.categories.map(cat => {
                const catLog = activeLog.categories[cat.id];
                return (
                  <div key={cat.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                      <div className={`text-${cat.color}-600 bg-${cat.color}-50 p-2 rounded-lg`}>
                        <GraduationCap size={20} />
                      </div>
                      <h3 className="font-serif text-lg font-bold text-slate-800 leading-tight">{cat.title}</h3>
                    </div>

                    <div className="flex-1 mb-6">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Objectives</h4>
                      {!catLog?.goals.length ? (
                        <p className="text-sm text-slate-400 italic">No goals set.</p>
                      ) : (
                        <div className="space-y-2">
                          {catLog.goals.map((g, i) => {
                            const status = catLog.goalStatus?.[i] || 'pending';
                            let statusClasses = '';
                            let icon = null;
                            
                            if (status === 'progress') {
                                // Yellow
                                statusClasses = 'bg-amber-50 border border-amber-300 text-amber-800';
                                icon = <PlayCircle size={10} className="text-amber-500 fill-amber-100" />;
                            } else if (status === 'completed') {
                                // Green
                                statusClasses = 'bg-emerald-50 border border-emerald-500 text-emerald-800';
                                icon = <CheckCircle2 size={10} className="text-emerald-500 fill-emerald-100" />;
                            } else {
                                // Red (Pending/Not Started)
                                statusClasses = 'bg-red-50 border border-red-200 text-red-800';
                                icon = <Circle size={10} className="text-red-300" />;
                            }

                            return (
                                <div 
                                key={i} 
                                onClick={() => cycleGoalStatus(cat.id, i)}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all ${statusClasses}`}
                                >
                                <span className={`text-xs ${status === 'completed' ? 'line-through opacity-70' : ''} flex-1`}>{g}</span>
                                <div className="ml-2">{icon}</div>
                                </div>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-[9px] text-slate-400 text-right mt-2 italic">Tap to cycle: Red → Yellow → Green</p>
                    </div>

                    <div className="mb-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider flex items-center gap-1">
                            <FileText size={10} /> Field Notes
                        </h4>
                        <textarea 
                            value={catLog?.notes || ''}
                            onChange={(e) => updateNotes(cat.id, e.target.value)}
                            placeholder={`Progress notes...`}
                            className="w-full h-20 text-xs p-2 bg-slate-50 border border-slate-200 rounded resize-none focus:bg-white focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div className="mb-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider flex items-center gap-1">
                            <HardDrive size={10} /> Proofs / Drive Files
                        </h4>
                        <div className="space-y-1 mb-2">
                             {catLog?.attachments?.map((item, i) => {
                                 const info = getAttachmentInfo(item);
                                 return (
                                    <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-slate-50 hover:bg-indigo-50 border border-slate-100 group transition-colors">
                                        <a href={info.url} target="_blank" rel="noreferrer" className="flex-1 flex items-center gap-2 overflow-hidden">
                                            <div className="text-slate-400 group-hover:text-indigo-500 shrink-0">
                                                {info.type === 'file' ? <HardDrive size={12} /> : (info.url.includes('firebasestorage') ? <UploadCloud size={12} /> : <ExternalLink size={12} />)}
                                            </div>
                                            <span className="truncate text-[10px] text-slate-600 flex-1" title={info.name}>{info.name}</span>
                                            <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 text-indigo-400" />
                                        </a>
                                        <button 
                                            onClick={() => handleDeleteAttachment(cat.id, i)}
                                            className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                            title="Remove Attachment"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                 );
                             })}
                        </div>
                        <div className="flex gap-1 items-center">
                            <input 
                                value={newLinkInputs[cat.id] || ''}
                                onChange={(e) => setNewLinkInputs({ ...newLinkInputs, [cat.id]: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleLinkAdd(cat.id)}
                                placeholder="Paste URL..."
                                className="flex-1 text-[10px] p-1 border border-slate-200 rounded focus:border-indigo-500 outline-none"
                            />
                            
                            <label className={`cursor-pointer px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded hover:bg-indigo-100 flex items-center justify-center h-full ml-1 ${uploading === cat.id ? 'opacity-50 pointer-events-none' : ''}`} title="Upload to Drive">
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    onChange={(e) => e.target.files && e.target.files[0] && handleFileUpload(cat.id, e.target.files[0])}
                                    disabled={!!uploading}
                                />
                                {uploading === cat.id ? (
                                    <div className="animate-spin h-3 w-3 border-2 border-indigo-500 rounded-full border-t-transparent"></div>
                                ) : (
                                    <UploadCloud size={14} />
                                )}
                            </label>

                            <button onClick={() => handleLinkAdd(cat.id)} className="px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 ml-1"><Plus size={14} /></button>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50 -mx-5 -mb-5 p-3 rounded-b-xl">
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Clock size={12} /> Hours</label>
                      <input 
                        type="number" step="0.5" min="0"
                        value={catLog?.hours || ''}
                        onChange={(e) => updateHours(cat.id, parseFloat(e.target.value) || 0)}
                        className="w-16 text-right font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded p-1 focus:border-indigo-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- VIEW: ANALYTICS --- */}
        {view === 'analytics' && stats && (
             <div className="animate-fade-in space-y-6">
                 
                 {/* Supervisor Sync Section */}
                 <div className="bg-indigo-900 text-white p-6 rounded-xl shadow-lg mb-8">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
                                <ShieldCheck size={24} className="text-indigo-300" /> 
                                Supervisor Sync
                            </h2>
                            <p className="text-indigo-200 text-sm mt-1 max-w-lg">
                                Generate a consolidated report of your week's progress, including completed objectives, hours logged, and key field notes.
                            </p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                              onClick={generateWeeklyReport}
                              className="bg-white text-indigo-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-indigo-50 transition-colors shadow-md"
                          >
                              <Copy size={16} /> Copy Weekly Report
                          </button>
                          <button 
                              onClick={downloadWeeklyReportPdf}
                              className="bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-indigo-400 transition-colors shadow-md"
                          >
                              <Download size={16} /> Download PDF
                          </button>
                        </div>
                    </div>
                 </div>

                 {/* Consistency Heatmap */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                    <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
                        <Grid size={16} className="text-emerald-500" /> Consistency Heatmap (Last 16 Weeks)
                    </h3>
                    <div className="flex flex-wrap gap-1">
                        {heatmapData.map((day, i) => {
                            let colorClass = 'bg-slate-100';
                            if (day.score === 1) colorClass = 'bg-emerald-200';
                            if (day.score === 2) colorClass = 'bg-emerald-300';
                            if (day.score === 3) colorClass = 'bg-emerald-400';
                            if (day.score >= 4) colorClass = 'bg-emerald-600';
                            
                            return (
                                <div 
                                    key={i} 
                                    title={`${day.date}: Level ${day.score}`}
                                    className={`w-3 h-3 rounded-sm ${colorClass}`}
                                ></div>
                            );
                        })}
                    </div>
                 <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-400">
                     <span>Less</span>
                     <div className="w-2 h-2 bg-slate-100 rounded-sm"></div>
                     <div className="w-2 h-2 bg-emerald-200 rounded-sm"></div>
                     <div className="w-2 h-2 bg-emerald-400 rounded-sm"></div>
                     <div className="w-2 h-2 bg-emerald-600 rounded-sm"></div>
                     <span>More</span>
                  </div>
                 </div>

                 {/* Lifestyle Heatmap */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                    <h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-4 flex items-center gap-2">
                        <Grid size={16} className="text-amber-500" /> Lifestyle Heatmap (Habits)
                    </h3>
                    <div className="flex flex-wrap gap-1">
                        {habitHeatmapData.map((day, i) => {
                            let colorClass = 'bg-slate-200';
                            if (day.status === 'partial') colorClass = 'bg-amber-400';
                            if (day.status === 'full') colorClass = 'bg-emerald-500';
                            const label = day.total === 0 ? 'No lifestyle habits' : `${day.completed}/${day.total} followed`;
                            return (
                                <div 
                                    key={i} 
                                    title={`${day.date}: ${label}`}
                                    className={`w-3 h-3 rounded-sm ${colorClass}`}
                                ></div>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-400">
                        <span>None</span>
                        <div className="w-2 h-2 bg-slate-200 rounded-sm"></div>
                        <span>Partial</span>
                        <div className="w-2 h-2 bg-amber-400 rounded-sm"></div>
                        <span>Full</span>
                        <div className="w-2 h-2 bg-emerald-500 rounded-sm"></div>
                    </div>
                 </div>

                 <h2 className="font-serif text-2xl font-bold text-slate-900">Performance Matrices</h2>
                 <p className="text-sm text-slate-500">Longitudinal analysis of temporal investment.</p>
                 
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {config.categories.map(cat => (
                         <div key={cat.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                             <div className={`flex items-center gap-2 mb-4 text-${cat.color}-600 font-bold uppercase text-xs tracking-wider border-b border-slate-100 pb-2`}>
                                 <Target size={16} /> {cat.title}
                             </div>
                             
                             <ProgressBar 
                                value={stats.dailyTotals[cat.id]} 
                                max={6} 
                                label="Daily Load" 
                                colorClass={`bg-${cat.color}-500`}
                                suffix="hrs"
                             />
                             <ProgressBar 
                                value={stats.weekTotals[cat.id]} 
                                max={40} 
                                label="Weekly Load" 
                                colorClass={`bg-${cat.color}-500`}
                                suffix="hrs"
                             />
                             <ProgressBar 
                                value={stats.monthTotals[cat.id]} 
                                max={160} 
                                label="Monthly Load" 
                                colorClass={`bg-${cat.color}-500`}
                                suffix="hrs"
                             />
                         </div>
                     ))}
                 </div>
             </div>
        )}

        {/* --- VIEW: NIGHT --- */}
        {view === 'night' && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-6 rounded-xl text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <Moon size={24} className="text-indigo-300" />
                <h2 className="font-serif text-2xl font-bold">Nightly Protocol</h2>
              </div>
              <p className="text-indigo-200 opacity-80">Consolidate your progress.</p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">Rate your day</label>
                  <StarRating rating={activeLog.rating} onChange={(r) => saveLog({ ...activeLog, rating: r })} />
              </div>

              {/* Lifestyle Habits Section */}
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <h4 className="font-bold text-emerald-900 uppercase text-xs tracking-wider mb-3 flex items-center gap-2">
                  <Activity size={14} /> Lifestyle Protocol
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {config.habits?.map((h) => {
                    const isDone = activeLog.habits?.[h.id] || false;
                    return (
                      <button
                        key={h.id}
                        onClick={() => toggleHabit(h.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border text-sm font-medium transition-all ${
                          isDone 
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800' 
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <span>{h.title}</span>
                        {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      </button>
                    )
                  })}
                </div>
              </div>
              
              <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Daily Summary & Reflection</label>
                  <textarea 
                      className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700"
                      value={activeLog.reflection}
                      onChange={(e) => saveLog({ ...activeLog, reflection: e.target.value })}
                      placeholder="How did the day go?"
                  />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-500"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>Auto-sync active</div>
                {istHour === 23 ? (
                  <button onClick={() => alert("Progress finalized.")} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"><Save size={18} /><span>Finalize</span></button>
                ) : (
                  <button disabled className="flex items-center gap-2 bg-slate-100 text-slate-400 px-6 py-3 rounded-lg cursor-not-allowed border border-slate-200"><Lock size={18} /><span>Locked until 11 PM IST</span></button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
