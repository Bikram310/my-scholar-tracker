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
  Info
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
  attachments: (string | Attachment)[]; // Supports legacy strings and new Attachment objects
}

interface DailyLog {
  date: string;
  categories: Record<string, CategoryLog>;
  reflection: string;
  rating: number; // 0-5 stars
  events: CalendarEvent[];
  antiGoals: Record<string, AntiGoalStatus>;
}

interface UserConfig {
  categories: CategoryDef[];
  antiGoals: AntiGoalDef[];
  streakFreezes: number;
}

// --- Constants & Defaults ---
const COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'orange'];

const defaultCategories: CategoryDef[] = [
  { id: 'research', title: 'Research Progress', color: 'indigo', iconKey: 'microscope' },
  { id: 'interview', title: 'PhD Interview Prep', color: 'emerald', iconKey: 'cap' }
  // Reduced to 2 preset goals as requested
];

const defaultAntiGoals: AntiGoalDef[] = [
  { id: 'ag_social', title: 'Social Media Scrolling' },
  { id: 'ag_procrast', title: 'Procrastination' }
];

const getISTTime = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istOffset = 5.5 * 60 * 60 * 1000; 
  return new Date(utc + istOffset);
};

const getTodayStr = () => getISTTime().toISOString().split('T')[0];

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
  
  // State
  const [config, setConfig] = useState<UserConfig>({ categories: defaultCategories, antiGoals: defaultAntiGoals, streakFreezes: 2 });
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
  const [newEventInput, setNewEventInput] = useState('');
  
  // Temp state
  const [newGoalInputs, setNewGoalInputs] = useState<Record<string, string>>({});
  const [newLinkInputs, setNewLinkInputs] = useState<Record<string, string>>({});

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
        setConfig({
            categories: data.categories || defaultCategories,
            antiGoals: data.antiGoals || defaultAntiGoals,
            streakFreezes: data.streakFreezes !== undefined ? data.streakFreezes : 2
        });
      } else {
        setDoc(configRef, { categories: defaultCategories, antiGoals: defaultAntiGoals, streakFreezes: 2 })
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
          antiGoals: {}
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

  // --- Core Logic ---

  const getLogForDate = (date: string) => {
    return logs.find(l => l.date === date) || {
      date: date,
      categories: {},
      reflection: '',
      rating: 0,
      events: [],
      antiGoals: {}
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

  const deleteAntiGoal = (id: string) => {
      saveConfig({ ...config, antiGoals: config.antiGoals.filter(ag => ag.id !== id)});
  };
  
  const updateAntiGoalTitle = (id: string, title: string) => {
      saveConfig({ ...config, antiGoals: config.antiGoals.map(ag => ag.id === id ? {...ag, title} : ag)});
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
      const isSelected = selectedDate === dateStr;
      const isToday = dateStr === getTodayStr();

      days.push(
        <div 
          key={d} 
          onClick={() => setSelectedDate(dateStr)}
          className={`h-24 p-1 border cursor-pointer transition-colors flex flex-col justify-between relative
            ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-white z-10' : 'border-slate-200 bg-white hover:bg-slate-50'}
            ${isToday ? 'bg-indigo-50' : ''}
          `}
        >
          <div className="flex justify-between items-start">
             <span className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-slate-700'}`}>{d}</span>
             {hasEvents && <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>}
          </div>
          <div className="flex flex-col gap-0.5 mt-1 overflow-hidden">
             {rating > 0 && <div className="flex justify-center my-1"><StarRating rating={rating} readOnly /></div>}
             {log?.events?.slice(0, 2).map((ev, i) => (
               <div key={i} className="text-[8px] bg-rose-100 text-rose-700 rounded px-1 truncate">{ev.title}</div>
             ))}
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
      
      {/* Setup Hint Popup */}
      {showSetupHint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center relative">
            <button 
              onClick={() => setShowSetupHint(false)} 
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
            <div className="flex justify-center mb-4">
              <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                <Info size={32} />
              </div>
            </div>
            <h3 className="font-serif text-xl font-bold text-slate-900 mb-2">Welcome, Scholar!</h3>
            <p className="text-sm text-slate-600 mb-6">
              Tailor this compass to your journey. Visit the <strong>Setup</strong> tab to add or remove your specific research goals.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowSetupHint(false)} 
                className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-50 rounded-lg transition-colors"
              >
                Dismiss
              </button>
              <button 
                onClick={() => { setShowSetupHint(false); setView('settings'); }} 
                className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
              >
                Go to Setup
              </button>
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
              </div>

              <div className="w-full md:w-80 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                   <div>
                     <div className="text-xs font-bold text-slate-400 uppercase">Selected Date</div>
                     <div className="font-serif text-xl font-bold text-slate-900">{selectedDate}</div>
                   </div>
                   {selectedDate === getTodayStr() && <div className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">Today</div>}
                </div>

                <div className="mb-6">
                   <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
                     <Bell size={12} className="text-rose-500" /> Events
                   </h3>
                   <div className="space-y-2 mb-3">
                     {getLogForDate(selectedDate).events?.length === 0 && <p className="text-xs text-slate-400 italic">No events scheduled.</p>}
                     {getLogForDate(selectedDate).events?.map(evt => (
                       <div key={evt.id} className="flex justify-between items-center bg-rose-50 text-rose-900 p-2 rounded text-xs border border-rose-100">
                          <span>{evt.title}</span>
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
                     <button onClick={() => addEvent(selectedDate)} className="bg-rose-600 text-white p-2 rounded hover:bg-rose-700"><Plus size={14} /></button>
                   </div>
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
