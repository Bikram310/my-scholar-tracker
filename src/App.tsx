import React, { useState, useEffect, useMemo } from 'react';
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
  UploadCloud,
  HardDrive,
  Link,
  Info,
  History,
  ShieldCheck,
  Activity,
  Heart,
  Copy,
  Grid,
  Printer
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDWzyI8IwUPIui6NC4WztO3tPIT0MVP9eU",
  authDomain: "research-tracker-6c03c.firebaseapp.com",
  projectId: "research-tracker-6c03c",
  storageBucket: "research-tracker-6c03c.firebasestorage.app",
  messagingSenderId: "588669594482",
  appId: "1:588669594482:web:8ec15eb791d16603e24beb",
  measurementId: "G-71LZ1K6QH9"
};

const appId = 'research-tracker-v1'; 

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
}

interface CalendarEvent {
  id: string;
  title: string;
  type: 'workshop' | 'deadline' | 'reminder';
  completed: boolean;
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
  attachments: (string | Attachment)[]; 
}

interface DailyLog {
  date: string;
  categories: Record<string, CategoryLog>;
  reflection: string;
  rating: number; 
  events: CalendarEvent[];
  antiGoals: Record<string, AntiGoalStatus>;
  habits: Record<string, boolean>; 
}

interface UserConfig {
  categories: CategoryDef[];
  antiGoals: AntiGoalDef[];
  habits: HabitDef[];
  streakFreezes: number;
}

// --- Constants & Defaults ---
const COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'orange'];

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

const getISTTime = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istOffset = 5.5 * 60 * 60 * 1000; 
  return new Date(utc + istOffset);
};

const getTodayStr = () => getISTTime().toISOString().split('T')[0];

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); 

const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
};

const getAttachmentInfo = (item: string | Attachment) => {
  if (typeof item === 'string') {
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
      <div className="mt-6 text-xs text-slate-400">Data is securely stored in your personal account via Firebase.</div>
    </div>
  </div>
);

// --- Main Application ---

export default function ScholarsCompass() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [showSetupHint, setShowSetupHint] = useState(false);
  
  // State
  const [config, setConfig] = useState<UserConfig>({ categories: defaultCategories, antiGoals: defaultAntiGoals, habits: defaultHabits, streakFreezes: 2 });
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  
  // UI State
  const [dataLoading, setDataLoading] = useState(true);
  const [view, setView] = useState<'morning' | 'dashboard' | 'calendar' | 'library' | 'night' | 'analytics' | 'settings'>('dashboard');
  const [istHour, setIstHour] = useState(getISTTime().getHours());
  const [istMinutes, setIstMinutes] = useState(getISTTime().getMinutes());
  
  // File Upload State
  const [uploading, setUploading] = useState<string | null>(null);

  // Calendar State
  const [calDate, setCalDate] = useState(getISTTime());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [historyDate, setHistoryDate] = useState<string | null>(null); 
  const [newEventInput, setNewEventInput] = useState('');
  
  // Temp state
  const [newGoalInputs, setNewGoalInputs] = useState<Record<string, string>>({});
  const [newLinkInputs, setNewLinkInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      const ist = getISTTime();
      setIstHour(ist.getHours());
      setIstMinutes(ist.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    if (user && !user.isAnonymous) {
      const hasShown = sessionStorage.getItem('setup_hint_shown');
      if (!hasShown) {
        setShowSetupHint(true);
        sessionStorage.setItem('setup_hint_shown', 'true');
      }
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
          setGoogleAccessToken(credential.accessToken);
          localStorage.setItem('g_drive_token', credential.accessToken);
          localStorage.setItem('g_drive_token_expiry', (Date.now() + 3500 * 1000).toString());
      }
    } catch (error) {
      console.error("Login failed", error);
      alert("Authentication failed. Ensure 'https://my-scholar-tracker.vercel.app' is added to Authorized Domains in Firebase Console.");
    }
  };

  const handleReAuth = async () => { await handleLogin(); };

  const handleLogout = async () => {
    await signOut(auth);
    setLogs([]);
    setTodayLog(null);
    setGoogleAccessToken(null);
    localStorage.removeItem('g_drive_token');
    localStorage.removeItem('g_drive_token_expiry');
    sessionStorage.removeItem('setup_hint_shown');
  };

  useEffect(() => {
    if (!user || user.isAnonymous || !appId) return;

    const configRef = doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'main');
    getDoc(configRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setConfig({
            categories: data.categories || defaultCategories,
            antiGoals: data.antiGoals || defaultAntiGoals,
            habits: data.habits || defaultHabits,
            streakFreezes: data.streakFreezes !== undefined ? data.streakFreezes : 2
        });
      } else {
        setDoc(configRef, { categories: defaultCategories, antiGoals: defaultAntiGoals, habits: defaultHabits, streakFreezes: 2 })
          .catch(e => console.error("Config Init Error", e));
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

  const getLogForDate = (date: string) => {
    return logs.find(l => l.date === date) || {
      date: date,
      categories: {},
      reflection: '',
      rating: 0,
      events: [],
      antiGoals: {},
      habits: {}
    } as DailyLog;
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
    config.habits?.forEach(h => { if (mergedLog.habits[h.id] === undefined) mergedLog.habits[h.id] = false; });
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

  const workHeatmapData = useMemo(() => {
      const days = [];
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - (15 * 7) - startDate.getDay()); 
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
      const endGrid = new Date(today);
      endGrid.setDate(endGrid.getDate() + (6 - endGrid.getDay()));
      while (current <= endGrid) {
          const dStr = current.toISOString().split('T')[0];
          days.push({ date: dStr, score: dateMap.get(dStr) || 0 });
          current.setDate(current.getDate() + 1);
      }
      return days;
  }, [logs]);

  const lifestyleHeatmapData = useMemo(() => {
      const days = [];
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - (15 * 7) - startDate.getDay()); 
      const dateMap = new Map();
      logs.forEach(l => {
          let score = 0;
          const habitCount = Object.values(l.habits || {}).filter(Boolean).length;
          if (habitCount === 0) score = -1; 
          else if (habitCount === 1) score = 1;
          else if (habitCount >= 2) score = 2;
          dateMap.set(l.date, score);
      });
      let current = new Date(startDate);
      const endGrid = new Date(today);
      endGrid.setDate(endGrid.getDate() + (6 - endGrid.getDay()));
      while (current <= endGrid) {
          const dStr = current.toISOString().split('T')[0];
          const loggedScore = dateMap.get(dStr);
          let finalScore = 0;
          if (loggedScore === -1) finalScore = 3; 
          else if (loggedScore === 1) finalScore = 1; 
          else if (loggedScore >= 2) finalScore = 2; 
          days.push({ date: dStr, score: finalScore });
          current.setDate(current.getDate() + 1);
      }
      return days;
  }, [logs]);

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

  const handleFileUpload = async (catId: string, file: File) => {
    if (!activeLog || !user) return;
    if (!googleAccessToken) {
        const confirm = window.confirm("To upload to Drive, we need to refresh your secure session. Proceed?");
        if (confirm) await handleReAuth(); else return;
    }
    setUploading(catId);
    try {
        const metadata = { name: `[Scholar] ${file.name}`, mimeType: file.type, parents: [] };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
            method: 'POST', headers: { Authorization: `Bearer ${googleAccessToken}` }, body: form
        });
        if (!res.ok) throw new Error("Drive API Error");
        const data = await res.json();
        const driveLink = data.webViewLink;
        const newCatLog = { ...activeLog.categories[catId] };
        const newAttachment: Attachment = { type: 'file', name: file.name, url: driveLink };
        newCatLog.attachments = [...(newCatLog.attachments || []), newAttachment];
        saveLog({ ...activeLog, categories: { ...activeLog.categories, [catId]: newCatLog } });
    } catch (error: any) {
        console.error("Upload failed", error);
        alert("Upload failed. Session may have expired. Please click your profile pic to re-login.");
    } finally { setUploading(null); }
  };

  const handleLinkAdd = (catId: string) => {
    if (!activeLog) return;
    const text = newLinkInputs[catId]?.trim();
    if (!text) return;
    const newCatLog = { ...activeLog.categories[catId] };
    const newAttachment: Attachment = { type: 'link', name: text, url: text };
    newCatLog.attachments = [...(newCatLog.attachments || []), newAttachment];
    saveLog({ ...activeLog, categories: { ...activeLog.categories, [catId]: newCatLog } });
    setNewLinkInputs(prev => ({ ...prev, [catId]: '' }));
  };

  const handleDeleteAttachment = (catId: string, idx: number) => {
    if (!activeLog) return;
    const newCatLog = { ...activeLog.categories[catId] };
    if (!newCatLog.attachments) return;
    newCatLog.attachments = newCatLog.attachments.filter((_, i) => i !== idx);
    saveLog({ ...activeLog, categories: { ...activeLog.categories, [catId]: newCatLog } });
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

  const deleteAntiGoal = (id: string) => {
      saveConfig({ ...config, antiGoals: config.antiGoals.filter(ag => ag.id !== id)});
  };
  
  const updateAntiGoalTitle = (id: string, title: string) => {
      saveConfig({ ...config, antiGoals: config.antiGoals.map(ag => ag.id === id ? {...ag, title} : ag)});
  };

  const toggleHabit = (hId: string) => {
      if (!activeLog) return;
      const current = activeLog.habits[hId] || false;
      saveLog({ ...activeLog, habits: { ...activeLog.habits, [hId]: !current } });
  };

  const addHabit = () => {
      const id = `h_${Date.now()}`;
      saveConfig({ ...config, habits: [...(config.habits || []), { id, title: 'New Habit' }]});
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
    const newEvent: CalendarEvent = { id: `evt_${Date.now()}`, title: newEventInput.trim(), type: 'workshop', completed: false };
    const updatedLog = { ...log, events: [...(log.events || []), newEvent] };
    saveLog(updatedLog);
    setNewEventInput('');
  };

  const deleteEvent = (date: string, evtId: string) => {
    const log = getLogForDate(date);
    const updatedLog = { ...log, events: log.events.filter(e => e.id !== evtId) };
    saveLog(updatedLog);
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
        dailyTotals[c.id] = 0; weekTotals[c.id] = 0; monthTotals[c.id] = 0;
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

  const generateWeeklyReport = (mode: 'copy' | 'print' = 'copy') => {
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    const recentLogs = logs.filter(l => new Date(l.date) >= oneWeekAgo && new Date(l.date) <= today).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let htmlContent = `<html><head><title>Scholar's Weekly Report</title><style>body { font-family: 'Georgia', serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1e293b; } h1 { color: #312e81; border-bottom: 2px solid #312e81; padding-bottom: 15px; margin-bottom: 30px; } h2 { color: #4f46e5; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; } .meta { color: #64748b; font-style: italic; margin-bottom: 30px; font-size: 14px; } ul { padding-left: 20px; } li { margin-bottom: 8px; line-height: 1.5; } .stat-row { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; } .notes-block { background: #f8fafc; padding: 15px; border-left: 3px solid #6366f1; margin-bottom: 15px; font-size: 14px; white-space: pre-wrap; } .date-header { font-weight: bold; margin-top: 15px; color: #334155; }</style></head><body><h1>Scholar's Compass: Weekly Report</h1><div class="meta">Report Period: ${oneWeekAgo.toDateString()} - ${today.toDateString()}</div><div class="meta">Generated for: ${user?.displayName || user?.email}</div>`;
    htmlContent += `<h2>Time Investment</h2>`;
    let totalHours = 0;
    config.categories.forEach(cat => {
      const catHours = recentLogs.reduce((acc, log) => acc + (log.categories[cat.id]?.hours || 0), 0);
      totalHours += catHours;
      if (catHours > 0) htmlContent += `<div class="stat-row"><span>${cat.title}</span> <span>${catHours.toFixed(1)} hrs</span></div>`;
    });
    htmlContent += `<div class="stat-row" style="font-weight:bold; margin-top:10px; border-bottom:none;"><span>TOTAL</span> <span>${totalHours.toFixed(1)} hrs</span></div>`;
    htmlContent += `<h2>Key Achievements</h2><ul>`;
    let achievementCount = 0;
    recentLogs.forEach(log => {
      Object.entries(log.categories).forEach(([catId, data]) => {
        const greenGoals = data.goals.filter((_, i) => data.goalStatus[i] === 'completed');
        if (greenGoals.length > 0) {
            htmlContent += `<li><strong>[${log.date}] ${config.categories.find(c=>c.id===catId)?.title || 'Task'}:</strong><ul>`;
            greenGoals.forEach(g => htmlContent += `<li>${g}</li>`);
            htmlContent += `</ul></li>`;
            achievementCount += greenGoals.length;
        }
      });
    });
    if (achievementCount === 0) htmlContent += "<li>No completed goals recorded this week.</li>";
    htmlContent += `</ul>`;
    htmlContent += `<h2>Research Field Notes</h2>`;
    let notesCount = 0;
    recentLogs.forEach(log => {
        const hasNotes = Object.values(log.categories).some(c => c.notes && c.notes.trim().length > 0);
        if (hasNotes) {
            htmlContent += `<div class="date-header">${log.date}</div>`;
            Object.entries(log.categories).forEach(([catId, data]) => {
                if (data.notes && data.notes.trim().length > 0) {
                     htmlContent += `<div class="notes-block"><strong>${config.categories.find(c=>c.id===catId)?.title}:</strong><br/>${data.notes}</div>`;
                }
            });
            notesCount++;
        }
    });
    if (notesCount === 0) htmlContent += "<p>No notes recorded.</p>";
    htmlContent += `</body></html>`;
    if (mode === 'print') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            setTimeout(() => { printWindow.print(); }, 500);
        }
    } else {
        let report = `WEEKLY SCHOLAR REPORT\n${oneWeekAgo.toDateString()} - ${today.toDateString()}\n\n`;
        report += `TIME INVESTMENT:\n`;
        config.categories.forEach(cat => {
            const catHours = recentLogs.reduce((acc, log) => acc + (log.categories[cat.id]?.hours || 0), 0);
            if (catHours > 0) report += `- ${cat.title}: ${catHours.toFixed(1)} hrs\n`;
        });
        report += `TOTAL: ${totalHours.toFixed(1)} hrs\n\n`;
        report += `KEY ACHIEVEMENTS:\n`;
        recentLogs.forEach(log => {
            Object.entries(log.categories).forEach(([catId, data]) => {
                const greenGoals = data.goals.filter((_, i) => data.goalStatus[i] === 'completed');
                greenGoals.forEach(g => report += `[${log.date}] ${g}\n`);
            });
        });
        navigator.clipboard.writeText(report);
        alert("Weekly Report copied to clipboard!");
    }
  };

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
              items.push({ date: log.date, catTitle: catDef.title, color: catDef.color, link: info.url, name: info.name, type: info.type });
            });
          }
        }
      });
    });
    return items;
  }, [logs, config]);

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calDate.getFullYear(), calDate.getMonth());
    const firstDay = getFirstDayOfMonth(calDate.getFullYear(), calDate.getMonth()); 
    const days = [];
    for (let i = 0; i < firstDay; i++) { days.push(<div key={`empty-${i}`} className="h-20 bg-slate-50 border border-slate-100 opacity-50"></div>); }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calDate.getFullYear()}-${String(calDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const log = logs.find(l => l.date === dateStr);
      const hasEvents = log?.events && log.events.length > 0;
      const rating = log?.rating || 0;
      const isSelected = selectedDate === dateStr;
      const isToday = dateStr === getTodayStr();
      days.push(
        <div key={d} onClick={() => setSelectedDate(dateStr)} onDoubleClick={() => setHistoryDate(dateStr)} className={`h-24 p-1 border cursor-pointer transition-colors flex flex-col justify-between relative select-none ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-white z-10' : 'border-slate-200 bg-white hover:bg-slate-50'} ${isToday ? 'bg-indigo-50' : ''}`}>
          <div className="flex justify-between items-start"><span className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>{d}</span>{hasEvents && <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>}</div>
          <div className="flex flex-col gap-0.5 mt-1 overflow-hidden">{rating > 0 && <div className="flex justify-center my-1"><StarRating rating={rating} readOnly /></div>}{log?.events?.slice(0, 2).map((ev, i) => (<div key={i} className="text-[8px] bg-rose-100 text-rose-700 rounded px-1 truncate">{ev.title}</div>))}</div>
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
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center z-10">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><History size={24} /></div>
                <div><h2 className="font-serif text-2xl font-bold text-slate-900">Time Machine</h2><p className="text-sm text-slate-500 font-mono">{historyDate}</p></div>
              </div>
              <button onClick={() => setHistoryDate(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100"><h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Day Rating</h3><StarRating rating={getLogForDate(historyDate).rating} readOnly /></div>
                <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100"><h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Events & Deadlines</h3><div className="space-y-1">{getLogForDate(historyDate).events?.length === 0 ? (<p className="text-sm text-slate-400 italic">No events recorded.</p>) : (getLogForDate(historyDate).events.map(ev => (<div key={ev.id} className="text-sm text-rose-700 font-medium flex items-center gap-2"><Bell size={12} /> {ev.title}</div>)))}</div></div>
                <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100"><h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Distractions</h3><div className="space-y-1">{Object.entries(getLogForDate(historyDate).antiGoals).map(([id, status]) => { const def = config.antiGoals.find(ag => ag.id === id); if (!def || status === 'pending') return null; return (<div key={id} className={`text-xs font-bold px-2 py-1 rounded w-fit ${status === 'conquered' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{def.title}: {status.toUpperCase()}</div>); })} {!Object.values(getLogForDate(historyDate).antiGoals).some(s => s !== 'pending') && (<p className="text-sm text-slate-400 italic">No distractions logged.</p>)}</div></div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {config.categories.map(cat => {
                   const data = getLogForDate(historyDate).categories[cat.id];
                   if (!data) return null;
                   return (
                     <div key={cat.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className={`flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 text-${cat.color}-600`}><Target size={18} /><h3 className="font-bold text-lg">{cat.title}</h3><span className="ml-auto font-mono text-sm bg-slate-100 px-2 py-1 rounded text-slate-600">{data.hours} hrs</span></div>
                        <div className="mb-4"><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Objectives</h4><div className="space-y-2">{data.goals.map((g, i) => { const status = data.goalStatus[i] || 'pending'; let color = 'bg-slate-100 text-slate-500 border-slate-200'; if (status === 'progress') color = 'bg-amber-50 text-amber-700 border-amber-200'; if (status === 'completed') color = 'bg-emerald-50 text-emerald-700 border-emerald-200'; return (<div key={i} className={`text-sm p-2 rounded border ${color} flex justify-between`}><span>{g}</span><span className="text-[10px] uppercase font-bold self-center">{status}</span></div>); })} {data.goals.length === 0 && <p className="text-sm text-slate-400 italic">No goals set.</p>}</div></div>
                        <div className="mb-4"><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Field Notes</h4><div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700 whitespace-pre-wrap border border-slate-100 min-h-[60px]">{data.notes || <span className="italic text-slate-400">No notes recorded.</span>}</div></div>
                        <div><h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Attachments</h4><div className="space-y-1">{data.attachments?.map((item, i) => { const info = getAttachmentInfo(item); return (<a key={i} href={info.url} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 hover:underline truncate">📎 {info.name}</a>) })} {(!data.attachments || data.attachments.length === 0) && <p className="text-sm text-slate-400 italic">No files.</p>}</div></div>
                     </div>
                   );
                })}
              </div>
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl">
                 <h3 className="text-indigo-900 font-serif font-bold text-lg mb-3 flex items-center gap-2"><Moon size={20} /> Nightly Reflection</h3>
                 <div className="mb-4"><h4 className="text-xs font-bold text-indigo-400 uppercase mb-2">Lifestyle & Habits</h4><div className="flex flex-wrap gap-2">{config.habits?.map(h => { const done = getLogForDate(historyDate).habits?.[h.id]; return (<span key={h.id} className={`text-xs px-2 py-1 rounded border ${done ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}`}>{h.title}: {done ? 'Done' : 'Missed'}</span>) })}</div></div>
                 <p className="text-indigo-800/80 whitespace-pre-wrap leading-relaxed">{getLogForDate(historyDate).reflection || "No reflection recorded for this day."}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSetupHint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col relative">
            <button onClick={() => setShowSetupHint(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10"><X size={24} /></button>
            <div className="p-8">
              <div className="flex flex-col items-center mb-6"><div className="bg-indigo-100 p-4 rounded-full text-indigo-600 mb-4 shadow-sm"><BookOpen size={48} /></div><h3 className="font-serif text-3xl font-bold text-slate-900 mb-2">Welcome to Scholar's Compass</h3><p className="text-slate-500 text-center max-w-md">A precision instrument designed for the rigors of academic research.</p></div>
              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100"><h4 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-4 flex items-center gap-2"><Info size={14} /> User Manual & Capabilities</h4><ul className="space-y-3 text-sm text-slate-600"><li className="flex gap-3"><Settings size={18} className="text-indigo-500 shrink-0" /><span><strong>Dynamic Configuration:</strong> Visit the <strong>Setup</strong> tab to define your specific research vectors. Add/Remove plans and distraction logs (Anti-Goals).</span></li><li className="flex gap-3"><Target size={18} className="text-emerald-500 shrink-0" /><span><strong>Tri-State Objectives:</strong> Tap any goal to cycle its status: <span className="text-rose-500">Pending</span> → <span className="text-amber-500">In Progress</span> → <span className="text-emerald-600">Done</span>.</span></li><li className="flex gap-3"><History size={18} className="text-purple-500 shrink-0" /><span><strong>Time Machine:</strong> Double-click any date in the <strong>Calendar</strong> to open a full historical snapshot of that day's work, notes, and ratings.</span></li><li className="flex gap-3"><BarChart3 size={18} className="text-blue-500 shrink-0" /><span><strong>Longitudinal Analytics:</strong> Track your investment with Daily (6h), Weekly (40h), and Monthly (160h) load matrices.</span></li></ul></div>
                <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100"><h4 className="font-bold text-emerald-900 uppercase text-xs tracking-wider mb-3 flex items-center gap-2"><ShieldCheck size={14} /> Data Sovereignty & Security Protocol</h4><p className="text-sm text-emerald-800 leading-relaxed mb-3">We understand that in Ph.D. research, data confidentiality is paramount. This application is architected with a <strong>Zero-Access</strong> philosophy:</p><ul className="text-sm text-emerald-800 space-y-2 list-disc list-inside"><li><strong>Identity Isolation:</strong> Database entries are cryptographically locked to your unique Google ID using Row-Level Security rules.</li><li><strong>Your Drive, Your Data:</strong> All uploaded files (PDFs, images) are stored directly in <strong>your personal Google Drive</strong>. We store only the link.</li><li><strong>Full Ownership:</strong> You retain complete control and ownership of your intellectual property.</li></ul></div>
              </div>
              <div className="mt-8 flex gap-4"><button onClick={() => setShowSetupHint(false)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors border border-slate-200">Close Guide</button><button onClick={() => { setShowSetupHint(false); setView('settings'); }} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Configure My Plans</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded text-white hidden sm:block"><BookOpen size={20} /></div>
            <h1 className="font-serif font-bold text-lg tracking-tight text-slate-900">Scholar's Compass</h1>
            <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-slate-200">
               <div className="flex items-center gap-1 text-orange-500" title="Current Streak"><Flame size={16} className={currentStreak > 0 ? 'fill-orange-500 animate-pulse' : 'text-slate-300'} /><span className={`font-mono font-bold ${currentStreak > 0 ? 'text-orange-600' : 'text-slate-400'}`}>{currentStreak}</span></div>
               <div className="flex items-center gap-1 text-sky-500" title="Streak Freezes Available"><Snowflake size={16} className="fill-sky-100" /><span className="font-mono font-bold text-sky-600">{config.streakFreezes}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
                {[{ id: 'morning', icon: Sun, label: 'Plan' }, { id: 'dashboard', icon: CalendarDays, label: 'Track' }, { id: 'calendar', icon: CalendarIcon, label: 'Cal' }, { id: 'library', icon: FolderOpen, label: 'Lib' }, { id: 'analytics', icon: BarChart3, label: 'Data' }, { id: 'night', icon: Moon, label: 'Reflect' }, { id: 'settings', icon: Settings, label: 'Setup' }].map(tab => (
                <button key={tab.id} onClick={() => setView(tab.id as any)} className={`p-2 rounded-md transition-all flex items-center gap-2 ${view === tab.id ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}><tab.icon size={18} /><span className="hidden lg:inline text-xs font-bold uppercase">{tab.label}</span></button>
                ))}
            </div>
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
              {user?.photoURL ? (<img src={user.photoURL} alt={user.displayName || "User"} className="w-8 h-8 rounded-full border border-slate-200 shadow-sm cursor-pointer hover:ring-2 hover:ring-indigo-300" onClick={handleReAuth} title="Click to refresh Drive session" />) : (<div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-200 cursor-pointer" onClick={handleReAuth} title="Click to refresh Drive session">{user.displayName?.[0] || user.email?.[0] || 'U'}</div>)}
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-500 transition-colors" title="Sign Out"><LogOut size={20} /></button>
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
                  <h2 className="font-serif text-xl font-bold text-slate-900">{calDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                  <div className="flex gap-2"><button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={20} /></button><button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={20} /></button></div>
                </div>
                <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (<div key={d} className="bg-slate-50 p-2 text-center text-xs font-bold text-slate-500 uppercase">{d}</div>))}{renderCalendar()}</div>
                <div className="mt-4 text-xs text-center text-slate-400 italic">Double-click a date to view full history (Time Machine)</div>
              </div>
              <div className="w-full md:w-80 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                   <div><div className="text-xs font-bold text-slate-400 uppercase">Selected Date</div><div className="font-serif text-xl font-bold text-slate-900">{selectedDate}</div></div>
                   {selectedDate === getTodayStr() && <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">Today</div>}
                </div>
                <div className="mb-6">
                   <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2"><Bell size={12} className="text-rose-500" /> Events</h3>
                   <div className="space-y-2 mb-3">{getLogForDate(selectedDate).events?.length === 0 && <p className="text-xs text-slate-400 italic">No events scheduled.</p>}{getLogForDate(selectedDate).events?.map(evt => (<div key={evt.id} className="flex justify-between items-center bg-rose-50 text-rose-900 p-2 rounded text-xs border border-rose-100"><span>{evt.title}</span><button onClick={() => deleteEvent(selectedDate, evt.id)} className="text-rose-400 hover:text-rose-600"><X size={12} /></button></div>))}</div>
                   <div className="flex gap-2"><input value={newEventInput} onChange={(e) => setNewEventInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addEvent(selectedDate)} placeholder="Add workshop..." className="flex-1 text-xs p-2 border border-slate-200 rounded focus:border-rose-500 outline-none"/><button onClick={() => addEvent(selectedDate)} className="bg-rose-600 text-white p-2 rounded hover:bg-rose-700"><Plus size={14} /></button></div>
                </div>
                <div className="mb-6">
                    <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2"><Skull size={12} className="text-slate-400" /> Distraction Log</h3>
                   <div className="space-y-2">{config.antiGoals.map(ag => { const status = getLogForDate(selectedDate).antiGoals[ag.id] || 'pending'; let badgeClass = 'bg-slate-100 text-slate-400'; if (status === 'conquered') badgeClass = 'bg-emerald-100 text-emerald-700'; if (status === 'succumbed') badgeClass = 'bg-rose-100 text-rose-700'; return (<div key={ag.id} className="flex justify-between items-center text-xs"><span className="text-slate-600">{ag.title}</span><span className={`px-1.5 py-0.5 rounded uppercase text-[10px] font-bold ${badgeClass}`}>{status === 'pending' ? '-' : status}</span></div>) })}</div>
                </div>
                <div className="mb-6">
                    <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2"><Paperclip size={12} className="text-slate-400" /> Attachments</h3>
                    <div className="space-y-1">{Object.entries(getLogForDate(selectedDate).categories).flatMap(([catId, data]) => (data.attachments || []).map((item, i) => { const catDef = config.categories.find(c => c.id === catId); const info = getAttachmentInfo(item); return (<a key={`${catId}-${i}`} href={info.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded text-xs hover:bg-slate-100 transition-colors group"><div className={`w-1 h-4 rounded-full bg-${catDef?.color || 'slate'}-400`}></div><div className="flex-1 truncate text-slate-600 group-hover:text-blue-600" title={info.name}>{info.name}</div><ExternalLink size={10} className="text-slate-300 group-hover:text-blue-400" /></a>); }))} {!Object.values(getLogForDate(selectedDate).categories).some(c => c.attachments?.length) && (<p className="text-xs text-slate-400 italic">No files attached for this date.</p>)}</div>
                </div>
                <div className="mb-6">
                   <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2"><Heart size={12} className="text-rose-400" /> Lifestyle</h3>
                   <div className="flex flex-wrap gap-2">{config.habits?.map(h => { const done = getLogForDate(selectedDate).habits?.[h.id]; if (!done) return null; return (<span key={h.id} className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">{h.title}</span>) })} {!Object.values(getLogForDate(selectedDate).habits || {}).some(Boolean) && (<p className="text-xs text-slate-400 italic">No habits completed.</p>)}</div>
                </div>
                <div>
                   <h3 className="text-xs font-bold text-slate-700 uppercase mb-2">Log Summary</h3>
                   <div className="mb-2"><StarRating rating={getLogForDate(selectedDate).rating} readOnly /></div>
                   <div className="space-y-3">{Object.entries(getLogForDate(selectedDate).categories).map(([catId, data]) => { const catDef = config.categories.find(c => c.id === catId); if (!catDef || (!data.hours && !data.goalStatus?.some(s => s !== 'pending'))) return null; const redCount = data.goalStatus.filter(s => s === 'pending').length; const yellowCount = data.goalStatus.filter(s => s === 'progress').length; const greenCount = data.goalStatus.filter(s => s === 'completed').length; return (<div key={catId} className="text-xs border-b border-slate-50 pb-2 last:border-0"><div className={`font-bold text-${catDef.color}-600 mb-1`}>{catDef.title}</div>{data.hours > 0 && <div className="text-slate-600 font-mono mb-1">{data.hours} hrs</div>}<div className="flex gap-2">{redCount > 0 && <span className="text-rose-600 bg-rose-50 px-1 rounded flex items-center gap-1"><Circle size={8} className="fill-rose-600" /> {redCount} Not Met</span>} {yellowCount > 0 && <span className="text-amber-600 bg-amber-50 px-1 rounded flex items-center gap-1"><PlayCircle size={8} className="fill-amber-600" /> {yellowCount} Partial</span>} {greenCount > 0 && <span className="text-emerald-600 bg-emerald-50 px-1 rounded flex items-center gap-1"><CheckCircle2 size={8} className="fill-emerald-600" /> {greenCount} Done</span>}</div></div>); })}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: ANALYTICS --- */}
        {view === 'analytics' && stats && (
             <div className="animate-fade-in space-y-6">
                 <div className="bg-indigo-900 text-white p-6 rounded-xl shadow-lg mb-8">
                    <div className="flex justify-between items-start mb-4">
                        <div><h2 className="font-serif text-2xl font-bold flex items-center gap-2"><ShieldCheck size={24} className="text-indigo-300" /> Supervisor Sync</h2><p className="text-indigo-200 text-sm mt-1 max-w-lg">Generate a consolidated report of your week's progress, including completed objectives, hours logged, and key field notes.</p></div>
                        <div className="flex gap-2"><button onClick={() => generateWeeklyReport('copy')} className="bg-white/10 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-white/20 transition-colors backdrop-blur-sm"><Copy size={16} /> Copy Text</button><button onClick={() => generateWeeklyReport('print')} className="bg-white text-indigo-900 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-indigo-50 transition-colors shadow-md"><Printer size={16} /> Print / Save PDF</button></div>
                    </div>
                 </div>
                 <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-4 flex items-center gap-2"><Grid size={16} className="text-emerald-500" /> Work Consistency (Last 16 Weeks)</h3><div className="flex flex-wrap gap-1">{workHeatmapData.map((day, i) => { let colorClass = 'bg-slate-100'; if (day.score === 1) colorClass = 'bg-emerald-200'; if (day.score === 2) colorClass = 'bg-emerald-300'; if (day.score === 3) colorClass = 'bg-emerald-400'; if (day.score >= 4) colorClass = 'bg-emerald-600'; return (<div key={i} title={`${day.date}: Level ${day.score}`} className={`w-3 h-3 rounded-sm ${colorClass}`}></div>); })}</div><div className="flex items-center gap-2 mt-4 text-[10px] text-slate-400"><span>Less</span><div className="w-2 h-2 bg-slate-100 rounded-sm"></div><div className="w-2 h-2 bg-emerald-200 rounded-sm"></div><div className="w-2 h-2 bg-emerald-400 rounded-sm"></div><div className="w-2 h-2 bg-emerald-600 rounded-sm"></div><span>More</span></div></div>
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-800 uppercase text-xs tracking-wider mb-4 flex items-center gap-2"><Heart size={16} className="text-rose-500" /> Lifestyle Habits (Last 16 Weeks)</h3><div className="flex flex-wrap gap-1">{lifestyleHeatmapData.map((day, i) => { let colorClass = 'bg-slate-100'; if (day.score === 3) colorClass = 'bg-rose-400'; if (day.score === 1) colorClass = 'bg-amber-400'; if (day.score === 2) colorClass = 'bg-emerald-500'; return (<div key={i} title={`${day.date}`} className={`w-3 h-3 rounded-sm ${colorClass}`}></div>); })}</div><div className="flex items-center gap-2 mt-4 text-[10px] text-slate-400"><div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-100 rounded-sm"></div><span>None</span></div><div className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-400 rounded-sm"></div><span>0 Done</span></div><div className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-400 rounded-sm"></div><span>1 Done</span></div><div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-sm"></div><span>2+ Done</span></div></div></div>
                 </div>
                 <h2 className="font-serif text-2xl font-bold text-slate-900">Performance Matrices</h2>
                 <p className="text-sm text-slate-500">Longitudinal analysis of temporal investment.</p>
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {config.categories.map(cat => (
                         <div key={cat.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                             <div className={`flex items-center gap-2 mb-4 text-${cat.color}-600 font-bold uppercase text-xs tracking-wider border-b border-slate-100 pb-2`}><Target size={16} /> {cat.title}</div>
                             <ProgressBar value={stats.dailyTotals[cat.id]} max={6} label="Daily Load" colorClass={`bg-${cat.color}-500`} suffix="hrs" />
                             <ProgressBar value={stats.weekTotals[cat.id]} max={40} label="Weekly Load" colorClass={`bg-${cat.color}-500`} suffix="hrs" />
                             <ProgressBar value={stats.monthTotals[cat.id]} max={160} label="Monthly Load" colorClass={`bg-${cat.color}-500`} suffix="hrs" />
                         </div>
                     ))}
                 </div>
             </div>
        )}

        {/* --- VIEW: NIGHT --- */}
        {view === 'night' && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-6 rounded-xl text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2"><Moon size={24} className="text-indigo-300" /><h2 className="font-serif text-2xl font-bold">Nightly Protocol</h2></div>
              <p className="text-indigo-200 opacity-80">Consolidate your progress.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div><label className="block text-sm font-bold text-slate-700 mb-3">Rate your day</label><StarRating rating={activeLog.rating} onChange={(r) => saveLog({ ...activeLog, rating: r })} /></div>
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100"><h4 className="font-bold text-emerald-900 uppercase text-xs tracking-wider mb-3 flex items-center gap-2"><Activity size={14} /> Lifestyle Protocol</h4><div className="grid grid-cols-2 gap-3">{config.habits?.map((h) => { const isDone = activeLog.habits?.[h.id] || false; return (<button key={h.id} onClick={() => toggleHabit(h.id)} className={`flex items-center justify-between p-3 rounded-lg border text-sm font-medium transition-all ${isDone ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}><span>{h.title}</span>{isDone ? <CheckCircle2 size={16} /> : <Circle size={16} />}</button>) })}</div></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Daily Summary & Reflection</label><textarea className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700" value={activeLog.reflection} onChange={(e) => saveLog({ ...activeLog, reflection: e.target.value })} placeholder="How did the day go?" /></div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100"><div className="flex items-center gap-2 text-xs text-slate-500"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>Auto-sync active</div>{istHour === 23 ? (<button onClick={() => alert("Progress finalized.")} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"><Save size={18} /><span>Finalize</span></button>) : (<button disabled className="flex items-center gap-2 bg-slate-100 text-slate-400 px-6 py-3 rounded-lg cursor-not-allowed border border-slate-200"><Lock size={18} /><span>Locked until 11 PM IST</span></button>)}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
