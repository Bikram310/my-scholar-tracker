import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
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
  CheckCircle2, 
  Clock, 
  Save, 
  ChevronRight,
  Calendar,
  AlertCircle,
  Lock
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
let firebaseConfig;
let appId = 'research-tracker-v1'; // Default App ID for your personal app

// 1. Environment Detection
// We check if we are in the Chat Canvas or on your Vercel App
// @ts-ignore
if (typeof __firebase_config !== 'undefined') {
  // --- CANVAS ENVIRONMENT (Do not touch) ---
  // @ts-ignore
  firebaseConfig = JSON.parse(__firebase_config);
  // @ts-ignore
  if (typeof __app_id !== 'undefined') appId = __app_id;
} else {
  // --- FOR VERCEL / LOCAL DEPLOYMENT (EDIT THIS!) ---
  // Paste your specific keys from Firebase Console -> Project Settings -> General -> Your Apps
  firebaseConfig = {
    apiKey: "AIzaSyDWzyI8IwUPIui6NC4WztO3tPIT0MVP9eU",
  authDomain: "research-tracker-6c03c.firebaseapp.com",
  projectId: "research-tracker-6c03c",
  storageBucket: "research-tracker-6c03c.firebasestorage.app",
  messagingSenderId: "588669594482",
  appId: "1:588669594482:web:8ec15eb791d16603e24beb",
  measurementId: "G-71LZ1K6QH9"
};
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Types ---
type Category = 'research' | 'interview' | 'gate';

interface DailyLog {
  date: string; // YYYY-MM-DD
  goals: {
    research: string[];
    interview: string[];
    gate: string[];
  };
  hours: {
    research: number;
    interview: number;
    gate: number;
  };
  completedGoals: {
    research: boolean[];
    interview: boolean[];
    gate: boolean[];
  };
  reflection: string;
}

// --- Helper Functions ---

// 1. Precise IST Time Calculation
// Calculates current time in Indian Standard Time (UTC+5:30) independently of device timezone
const getISTTime = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
  return new Date(utc + istOffset);
};

const getTodayStr = () => {
  // We use IST date string to ensure the "Day" aligns with Indian time, not local device time
  const istDate = getISTTime();
  return istDate.toISOString().split('T')[0];
};

const defaultLog: DailyLog = {
  date: getTodayStr(),
  goals: { research: [], interview: [], gate: [] },
  hours: { research: 0, interview: 0, gate: 0 },
  completedGoals: { research: [], interview: [], gate: [] },
  reflection: ''
};

// --- Components ---

// 1. Simple SVG Bar Chart for Analytics
const BarChart = ({ data, label, colorClass }: { data: number[], label: string, colorClass: string }) => {
  const max = Math.max(...data, 1);
  const height = 100;
  const width = 100;
  const barWidth = width / data.length - 2;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-xs font-mono text-slate-500 mb-1">{label}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 bg-slate-50 rounded border border-slate-200">
        {data.map((val, i) => (
          <rect
            key={i}
            x={i * (width / data.length) + 1}
            y={height - (val / max) * height}
            width={barWidth}
            height={(val / max) * height}
            className={colorClass}
            rx="2"
          />
        ))}
      </svg>
      <div className="flex justify-between w-full text-[10px] text-slate-400 mt-1 font-mono">
        <span>Start</span>
        <span>Now</span>
      </div>
    </div>
  );
};

// 2. Goal Input Component
const GoalInput = ({ 
  category, 
  goals, 
  onAdd 
}: { 
  category: string, 
  goals: string[], 
  onAdd: (g: string[]) => void 
}) => {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (input.trim()) {
      onAdd([...goals, input.trim()]);
      setInput('');
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{category}</label>
      <div className="space-y-2">
        {goals.map((g, i) => (
          <div key={i} className="flex items-center text-sm text-slate-700 bg-white p-2 rounded border border-slate-100 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-2"></div>
            {g}
          </div>
        ))}
        <div className="flex gap-2">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={`Add ${category} goal...`}
            className="flex-1 text-sm p-2 rounded border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
          />
          <button 
            onClick={handleAdd}
            className="p-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// 3. Category Card for Dashboard
const CategoryCard = ({ 
  title, 
  icon: Icon, 
  color, 
  hours, 
  goals, 
  completed,
  onToggleGoal,
  onHoursChange
}: { 
  title: string, 
  icon: any, 
  color: string, 
  hours: number, 
  goals: string[], 
  completed: boolean[],
  onToggleGoal: (idx: number) => void,
  onHoursChange: (h: number) => void
}) => {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className={`flex items-center gap-3 mb-4 ${color}`}>
        <Icon size={24} />
        <h3 className="font-serif text-lg font-bold text-slate-800">{title}</h3>
      </div>
      
      <div className="mb-6">
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">Today's Objectives</h4>
        {goals.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No goals set for today.</p>
        ) : (
          <div className="space-y-2">
            {goals.map((g, i) => (
              <div 
                key={i} 
                onClick={() => onToggleGoal(i)}
                className={`flex items-start gap-3 p-2 rounded cursor-pointer transition-colors ${completed[i] ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${completed[i] ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}>
                  {completed[i] && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <span className={`text-sm ${completed[i] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{g}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
            <Clock size={12} /> Time Logged (Hours)
          </label>
          <input 
            type="number" 
            step="0.5"
            min="0"
            value={hours || ''}
            onChange={(e) => onHoursChange(parseFloat(e.target.value) || 0)}
            className="w-20 text-right font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded p-1 focus:border-indigo-500 outline-none"
          />
        </div>
      </div>
    </div>
  );
};

export default function ScholarsCompass() {
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [todayLog, setTodayLog] = useState<DailyLog>(defaultLog);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [view, setView] = useState<'morning' | 'dashboard' | 'night' | 'analytics'>('dashboard');
  
  // IST Time State
  const [istHour, setIstHour] = useState(getISTTime().getHours());
  const [istMinutes, setIstMinutes] = useState(getISTTime().getMinutes());

  // Update IST Clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const ist = getISTTime();
      setIstHour(ist.getHours());
      setIstMinutes(ist.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        // @ts-ignore
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          // @ts-ignore
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error", err);
        setErrorState("Authentication failed. Please refresh.");
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Safety check for inputs
    if (!appId || !user.uid) {
      console.warn("Missing appId or userId");
      return;
    }

    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'daily_logs'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs: DailyLog[] = [];
      snapshot.forEach((doc) => {
        fetchedLogs.push(doc.data() as DailyLog);
      });
      setLogs(fetchedLogs);
      
      const todayStr = getTodayStr();
      const existingToday = fetchedLogs.find(l => l.date === todayStr);
      if (existingToday) {
        setTodayLog(existingToday);
      } else {
        setTodayLog({ ...defaultLog, date: todayStr });
        // Only force morning view if it's actually morning/day time
        if (fetchedLogs.length === 0) setView('morning'); 
      }
      setLoading(false);
      setErrorState(null);
    }, (error) => {
      console.error("Data fetch error:", error);
      if (error.code === 'not-found' || error.toString().includes('NOT_FOUND')) {
        setLogs([]);
        setTodayLog({ ...defaultLog, date: getTodayStr() });
        setView('morning');
        setLoading(false);
      } else {
        setErrorState(`Connection issue: ${error.message}`);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // --- Actions ---
  const saveToday = async (logToSave: DailyLog) => {
    if (!user) return;
    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'users', user.uid, 'daily_logs', logToSave.date), 
        logToSave
      );
      setTodayLog(logToSave);
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  const updateGoalCompletion = (category: Category, index: number) => {
    const newLog = { ...todayLog };
    // Ensure array exists
    if (!newLog.completedGoals) newLog.completedGoals = { research: [], interview: [], gate: [] };
    if (!newLog.completedGoals[category]) newLog.completedGoals[category] = [];
    
    // Toggle
    newLog.completedGoals[category][index] = !newLog.completedGoals[category][index];
    saveToday(newLog);
  };

  const updateHours = (category: Category, val: number) => {
    const newLog = { ...todayLog, hours: { ...todayLog.hours, [category]: val } };
    saveToday(newLog);
  };

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    const now = getISTTime(); // Use IST for consistent analytics
    // Helper to check dates
    const isSameWeek = (d1: Date, d2: Date) => {
      const one = new Date(d1);
      const two = new Date(d2);
      one.setHours(0,0,0,0);
      two.setHours(0,0,0,0);
      const diff = one.getDate() - one.getDay() + (one.getDay() === 0 ? -6 : 1);
      const monday = new Date(one.setDate(diff));
      const diff2 = two.getDate() - two.getDay() + (two.getDay() === 0 ? -6 : 1);
      const monday2 = new Date(two.setDate(diff2));
      return monday.getTime() === monday2.getTime();
    };

    const isSameMonth = (d1: Date, d2: Date) => 
      d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

    const weekLogs = logs.filter(l => isSameWeek(new Date(l.date), now));
    const monthLogs = logs.filter(l => isSameMonth(new Date(l.date), now));

    const sumHours = (logList: DailyLog[], cat: Category) => 
      logList.reduce((acc, curr) => acc + (curr.hours[cat] || 0), 0);

    return {
      week: {
        research: sumHours(weekLogs, 'research'),
        interview: sumHours(weekLogs, 'interview'),
        gate: sumHours(weekLogs, 'gate'),
        total: 0 
      },
      month: {
        research: sumHours(monthLogs, 'research'),
        interview: sumHours(monthLogs, 'interview'),
        gate: sumHours(monthLogs, 'gate'),
        total: 0 
      },
      chartData: {
        research: logs.slice(-7).map(l => l.hours.research),
        interview: logs.slice(-7).map(l => l.hours.interview),
        gate: logs.slice(-7).map(l => l.hours.gate),
      }
    };
  }, [logs]);
  
  stats.week.total = stats.week.research + stats.week.interview + stats.week.gate;
  stats.month.total = stats.month.research + stats.month.interview + stats.month.gate;

  // --- Views ---

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-serif">
      Loading your Scholar's Log...
    </div>
  );

  if (errorState) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 font-sans p-4">
      <AlertCircle size={40} className="text-red-500 mb-4" />
      <h2 className="text-xl font-bold mb-2">Connection Status</h2>
      <p className="max-w-md text-center mb-6">{errorState}</p>
      <button 
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700"
      >
        Retry
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded text-white">
              <BookOpen size={20} />
            </div>
            <h1 className="font-serif font-bold text-xl tracking-tight text-slate-900">Scholar's Compass</h1>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'morning', icon: Sun, label: 'Plan' },
              { id: 'dashboard', icon: Calendar, label: 'Track' },
              { id: 'analytics', icon: BarChart3, label: 'Analyze' },
              { id: 'night', icon: Moon, label: 'Reflect' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id as any)}
                className={`p-2 rounded-md transition-all flex items-center gap-2 ${view === tab.id ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                title={tab.label}
              >
                <tab.icon size={18} />
                <span className="hidden sm:inline text-xs font-bold uppercase">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        
        {/* VIEW: MORNING RESOLUTIONS */}
        {view === 'morning' && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-100">
              <h2 className="font-serif text-2xl font-bold text-orange-900 mb-2">Morning Resolutions</h2>
              <p className="text-orange-800/80 max-w-xl">
                Define your research vectors for the day. Precision in planning leads to precision in execution.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                 <GoalInput 
                   category="Research Progress" 
                   goals={todayLog.goals.research} 
                   onAdd={(g) => saveToday({ ...todayLog, goals: { ...todayLog.goals, research: g } })} 
                 />
                 <GoalInput 
                   category="PhD Interview Prep" 
                   goals={todayLog.goals.interview} 
                   onAdd={(g) => saveToday({ ...todayLog, goals: { ...todayLog.goals, interview: g } })} 
                 />
                 <GoalInput 
                   category="GATE Preparation" 
                   goals={todayLog.goals.gate} 
                   onAdd={(g) => saveToday({ ...todayLog, goals: { ...todayLog.goals, gate: g } })} 
                 />
              </div>

              <div className="bg-slate-800 text-slate-300 p-6 rounded-xl flex flex-col justify-center items-center text-center">
                <Sun size={48} className="text-orange-400 mb-4" />
                <h3 className="font-serif text-xl text-white mb-2">Intentionality</h3>
                <p className="text-sm italic opacity-80">
                  "The morning is the rudder of the day."
                </p>
                <button 
                  onClick={() => setView('dashboard')}
                  className="mt-8 bg-white text-slate-900 px-6 py-2 rounded-full font-bold text-sm hover:bg-orange-50 transition-colors"
                >
                  Start Tracking
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: DASHBOARD / TRACKER */}
        {view === 'dashboard' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl font-bold text-slate-900">Today's Ledger</h2>
              <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">{todayLog.date}</span>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <CategoryCard 
                title="Research" 
                icon={Microscope} 
                color="text-indigo-600"
                hours={todayLog.hours.research}
                goals={todayLog.goals.research}
                completed={todayLog.completedGoals?.research || Array(todayLog.goals.research.length).fill(false)}
                onToggleGoal={(idx) => updateGoalCompletion('research', idx)}
                onHoursChange={(h) => updateHours('research', h)}
              />
              <CategoryCard 
                title="PhD Prep" 
                icon={GraduationCap} 
                color="text-emerald-600"
                hours={todayLog.hours.interview}
                goals={todayLog.goals.interview}
                completed={todayLog.completedGoals?.interview || Array(todayLog.goals.interview.length).fill(false)}
                onToggleGoal={(idx) => updateGoalCompletion('interview', idx)}
                onHoursChange={(h) => updateHours('interview', h)}
              />
              <CategoryCard 
                title="GATE" 
                icon={BookOpen} 
                color="text-amber-600"
                hours={todayLog.hours.gate}
                goals={todayLog.goals.gate}
                completed={todayLog.completedGoals?.gate || Array(todayLog.goals.gate.length).fill(false)}
                onToggleGoal={(idx) => updateGoalCompletion('gate', idx)}
                onHoursChange={(h) => updateHours('gate', h)}
              />
            </div>
            
            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center justify-between">
               <div>
                 <h4 className="text-blue-900 font-bold text-sm">Total Investment Today</h4>
                 <p className="text-blue-700 text-xs">Sum of all tracked hours</p>
               </div>
               <div className="text-3xl font-mono font-bold text-blue-900">
                 {(todayLog.hours.research + todayLog.hours.interview + todayLog.hours.gate).toFixed(1)} <span className="text-sm text-blue-600 font-sans">hrs</span>
               </div>
            </div>
          </div>
        )}

        {/* VIEW: ANALYTICS */}
        {view === 'analytics' && (
          <div className="animate-fade-in space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold text-slate-900">Longitudinal Analysis</h2>
            </div>

            {/* Weekly & Monthly Tally Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4">Current Week (Mon-Sun)</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                    <span className="text-sm text-slate-600">Research</span>
                    <span className="font-mono font-bold text-indigo-600">{stats.week.research.toFixed(1)} h</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                    <span className="text-sm text-slate-600">PhD Prep</span>
                    <span className="font-mono font-bold text-emerald-600">{stats.week.interview.toFixed(1)} h</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                    <span className="text-sm text-slate-600">GATE</span>
                    <span className="font-mono font-bold text-amber-600">{stats.week.gate.toFixed(1)} h</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-bold text-slate-800">Total</span>
                    <span className="font-mono font-bold text-slate-900 text-lg">{stats.week.total.toFixed(1)} h</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-4">Current Month</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                    <span className="text-sm text-slate-600">Research</span>
                    <span className="font-mono font-bold text-indigo-600">{stats.month.research.toFixed(1)} h</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                    <span className="text-sm text-slate-600">PhD Prep</span>
                    <span className="font-mono font-bold text-emerald-600">{stats.month.interview.toFixed(1)} h</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-dashed border-slate-100 pb-2">
                    <span className="text-sm text-slate-600">GATE</span>
                    <span className="font-mono font-bold text-amber-600">{stats.month.gate.toFixed(1)} h</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm font-bold text-slate-800">Total</span>
                    <span className="font-mono font-bold text-slate-900 text-lg">{stats.month.total.toFixed(1)} h</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Charts */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
               <h3 className="text-sm font-bold text-slate-800 mb-6">Activity Distribution (Last 7 Days)</h3>
               <div className="grid grid-cols-3 gap-6">
                  <BarChart data={stats.chartData.research} label="Research" colorClass="fill-indigo-500" />
                  <BarChart data={stats.chartData.interview} label="Interview" colorClass="fill-emerald-500" />
                  <BarChart data={stats.chartData.gate} label="GATE" colorClass="fill-amber-500" />
               </div>
            </div>
          </div>
        )}

        {/* VIEW: NIGHT REFLECTION */}
        {view === 'night' && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-6 rounded-xl text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <Moon size={24} className="text-indigo-300" />
                <h2 className="font-serif text-2xl font-bold">Nightly Protocol</h2>
              </div>
              <p className="text-indigo-200 opacity-80">
                Consolidate your progress. Reflection is the bridge between experience and wisdom.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Daily Reflection</label>
                <textarea 
                  className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-slate-700 leading-relaxed"
                  placeholder="What was the primary blocker today? What was a breakthrough? Notes for tomorrow..."
                  value={todayLog.reflection}
                  onChange={(e) => saveToday({ ...todayLog, reflection: e.target.value })}
                ></textarea>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-center">
                   <div className="text-xs text-slate-500 uppercase font-bold mb-1">Research</div>
                   <div className="font-mono text-xl font-bold text-indigo-600">{todayLog.hours.research}h</div>
                </div>
                <div className="text-center">
                   <div className="text-xs text-slate-500 uppercase font-bold mb-1">PhD Prep</div>
                   <div className="font-mono text-xl font-bold text-emerald-600">{todayLog.hours.interview}h</div>
                </div>
                <div className="text-center">
                   <div className="text-xs text-slate-500 uppercase font-bold mb-1">GATE</div>
                   <div className="font-mono text-xl font-bold text-amber-600">{todayLog.hours.gate}h</div>
                </div>
              </div>

              {/* Status Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Auto-sync active: Data is stored instantly.
                </div>

                {istHour === 23 ? (
                  <button 
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
                    onClick={() => alert("Progress finalized for " + todayLog.date + ". System sleeping...")}
                  >
                    <Save size={18} />
                    <span>Finalize & Sleep</span>
                  </button>
                ) : (
                  <button 
                    disabled
                    className="flex items-center gap-2 bg-slate-100 text-slate-400 px-6 py-3 rounded-lg cursor-not-allowed border border-slate-200"
                    title="Available only between 11 PM and Midnight IST"
                  >
                    <Lock size={18} />
                    <span>Available at 11:00 PM IST</span>
                  </button>
                )}
              </div>
              <div className="text-right text-[10px] text-slate-400 font-mono">
                Current IST: {istHour.toString().padStart(2, '0')}:{istMinutes.toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
