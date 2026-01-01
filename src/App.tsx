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
  CheckCircle2, 
  Clock, 
  Save, 
  ChevronRight,
  Calendar,
  AlertCircle,
  Lock,
  Plus,
  Trash2,
  Settings,
  Paperclip,
  FileText,
  X
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
let firebaseConfig;
let appId = 'research-tracker-v1';

// @ts-ignore
if (typeof __firebase_config !== 'undefined') {
  // @ts-ignore
  firebaseConfig = JSON.parse(__firebase_config);
  // @ts-ignore
  if (typeof __app_id !== 'undefined') appId = __app_id;
} else {
  // --- FOR VERCEL / LOCAL DEPLOYMENT ---
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

interface CategoryDef {
  id: string;
  title: string;
  color: string; // e.g., 'indigo', 'emerald', 'amber', 'rose', 'blue'
  iconKey: string; // 'microscope', 'book', 'cap'
}

interface CategoryLog {
  goals: string[];
  completedGoals: boolean[];
  hours: number;
  notes: string;       // New: Field Notes
  attachments: string[]; // New: Links/Files
}

interface DailyLog {
  date: string;
  categories: Record<string, CategoryLog>; // Dynamic keys based on CategoryDef.id
  reflection: string;
}

interface UserConfig {
  categories: CategoryDef[];
}

// --- Constants & Defaults ---
const COLORS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'orange'];
const ICONS = {
  microscope: Microscope,
  book: BookOpen,
  cap: GraduationCap,
  file: FileText,
  sun: Sun
};

const defaultCategories: CategoryDef[] = [
  { id: 'research', title: 'Research Progress', color: 'indigo', iconKey: 'microscope' },
  { id: 'interview', title: 'PhD Interview Prep', color: 'emerald', iconKey: 'cap' },
  { id: 'gate', title: 'GATE Preparation', color: 'amber', iconKey: 'book' }
];

const getISTTime = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istOffset = 5.5 * 60 * 60 * 1000; 
  return new Date(utc + istOffset);
};

const getTodayStr = () => getISTTime().toISOString().split('T')[0];

// --- Components ---

const BarChart = ({ data, label, colorClass }: { data: number[], label: string, colorClass: string }) => {
  const max = Math.max(...data, 1);
  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-xs font-mono text-slate-500 mb-1 truncate w-full text-center">{label}</div>
      <svg viewBox="0 0 100 100" className="w-full h-24 bg-slate-50 rounded border border-slate-200">
        {data.map((val, i) => (
          <rect
            key={i}
            x={i * (100 / data.length) + 1}
            y={100 - (val / max) * 100}
            width={(100 / data.length) - 2}
            height={(val / max) * 100}
            className={colorClass}
            rx="2"
          />
        ))}
      </svg>
    </div>
  );
};

// --- Main Application ---

export default function ScholarsCompass() {
  const [user, setUser] = useState<User | null>(null);
  
  // State
  const [config, setConfig] = useState<UserConfig>({ categories: defaultCategories });
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'morning' | 'dashboard' | 'night' | 'analytics' | 'settings'>('dashboard');
  const [istHour, setIstHour] = useState(getISTTime().getHours());
  const [istMinutes, setIstMinutes] = useState(getISTTime().getMinutes());
  
  // Temp state for adding items
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

  // --- Auth & Init ---
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
      } catch (err) { console.error(err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    if (!user || !appId) return;

    // 1. Fetch User Config
    const configRef = doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'main');
    getDoc(configRef).then(snap => {
      if (snap.exists()) {
        setConfig(snap.data() as UserConfig);
      } else {
        // Init default config if new user
        setDoc(configRef, { categories: defaultCategories });
      }
    });

    // 2. Fetch Logs
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
        // Initialize today based on current config (or defaults if config not loaded yet)
        setTodayLog({
          date: todayStr,
          categories: {},
          reflection: ''
        });
        if (fetchedLogs.length === 0) setView('morning');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Core Logic ---

  // Ensure todayLog has entries for all current categories
  const activeLog = useMemo(() => {
    if (!todayLog) return null;
    const mergedLog = { ...todayLog };
    
    config.categories.forEach(cat => {
      if (!mergedLog.categories[cat.id]) {
        mergedLog.categories[cat.id] = {
          goals: [],
          completedGoals: [],
          hours: 0,
          notes: '',
          attachments: []
        };
      }
    });
    return mergedLog;
  }, [todayLog, config]);

  const saveLog = async (logToSave: DailyLog) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'daily_logs', logToSave.date), logToSave);
      setTodayLog(logToSave);
    } catch (e) { console.error(e); }
  };

  const saveConfig = async (newConfig: UserConfig) => {
    if (!user) return;
    setConfig(newConfig);
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'config', 'main'), newConfig);
  };

  // --- Handlers ---

  const handleGoalAdd = (catId: string) => {
    if (!activeLog) return;
    const text = newGoalInputs[catId]?.trim();
    if (!text) return;

    const newCatLog = { ...activeLog.categories[catId] };
    newCatLog.goals = [...newCatLog.goals, text];
    newCatLog.completedGoals = [...newCatLog.completedGoals, false];

    saveLog({
      ...activeLog,
      categories: { ...activeLog.categories, [catId]: newCatLog }
    });
    setNewGoalInputs(prev => ({ ...prev, [catId]: '' }));
  };

  const handleLinkAdd = (catId: string) => {
    if (!activeLog) return;
    const text = newLinkInputs[catId]?.trim();
    if (!text) return;

    const newCatLog = { ...activeLog.categories[catId] };
    newCatLog.attachments = [...(newCatLog.attachments || []), text];

    saveLog({
      ...activeLog,
      categories: { ...activeLog.categories, [catId]: newCatLog }
    });
    setNewLinkInputs(prev => ({ ...prev, [catId]: '' }));
  };

  const toggleGoal = (catId: string, idx: number) => {
    if (!activeLog) return;
    const newCatLog = { ...activeLog.categories[catId] };
    newCatLog.completedGoals[idx] = !newCatLog.completedGoals[idx];
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

  // --- Settings Handlers ---
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

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    if (!logs.length) return null;
    const recentLogs = logs.slice(-7);
    
    // Initialize data structure based on CURRENT categories
    const chartData: Record<string, number[]> = {};
    const weekTotals: Record<string, number> = {};
    const monthTotals: Record<string, number> = {};
    
    config.categories.forEach(c => {
      chartData[c.id] = [];
      weekTotals[c.id] = 0;
      monthTotals[c.id] = 0;
    });

    recentLogs.forEach(log => {
      config.categories.forEach(c => {
        // Handle migration safely (log.categories might not have new keys)
        const hours = log.categories?.[c.id]?.hours || 0;
        chartData[c.id].push(hours);
      });
    });

    // Simple sum for demo (real week logic omitted for brevity but follows same pattern)
    logs.forEach(log => {
        config.categories.forEach(c => {
            const h = log.categories?.[c.id]?.hours || 0;
            weekTotals[c.id] += h; // Simplified 'all time' for preview
        });
    });

    return { chartData, weekTotals };
  }, [logs, config]);


  if (loading || !activeLog) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded text-white">
              <BookOpen size={20} />
            </div>
            <h1 className="font-serif font-bold text-xl tracking-tight text-slate-900 hidden sm:block">Scholar's Compass</h1>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            {[
              { id: 'morning', icon: Sun, label: 'Plan' },
              { id: 'dashboard', icon: Calendar, label: 'Track' },
              { id: 'analytics', icon: BarChart3, label: 'Analyze' },
              { id: 'night', icon: Moon, label: 'Reflect' },
              { id: 'settings', icon: Settings, label: 'Setup' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id as any)}
                className={`p-2 rounded-md transition-all flex items-center gap-2 ${view === tab.id ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <tab.icon size={18} />
                <span className="hidden md:inline text-xs font-bold uppercase">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* --- VIEW: SETTINGS --- */}
        {view === 'settings' && (
           <div className="animate-fade-in space-y-6">
             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
               <h2 className="font-serif text-xl font-bold text-slate-900 mb-4">Plan Configuration</h2>
               <p className="text-sm text-slate-500 mb-6">Customize your tracking domains. You must maintain at least two plans.</p>
               
               <div className="space-y-4">
                 {config.categories.map((cat) => (
                   <div key={cat.id} className="flex items-center gap-3">
                     <div className={`w-3 h-3 rounded-full bg-${cat.color}-500`}></div>
                     <input 
                       value={cat.title}
                       onChange={(e) => updateCategoryTitle(cat.id, e.target.value)}
                       className="flex-1 p-2 border border-slate-300 rounded text-sm font-bold text-slate-700 focus:border-indigo-500 outline-none"
                     />
                     <button 
                       onClick={() => deleteCategory(cat.id)}
                       className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                       title="Delete Plan"
                     >
                       <Trash2 size={16} />
                     </button>
                   </div>
                 ))}
               </div>

               <button 
                 onClick={addCategory}
                 className="mt-6 flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
               >
                 <Plus size={16} /> Add New Plan
               </button>
             </div>
           </div>
        )}
        
        {/* --- VIEW: MORNING --- */}
        {view === 'morning' && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-100">
              <h2 className="font-serif text-2xl font-bold text-orange-900 mb-2">Morning Resolutions</h2>
              <p className="text-orange-800/80">
                Define your vectors for the day. (Edit titles in 'Setup' tab)
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-6">
                {config.categories.map(cat => (
                  <div key={cat.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 text-${cat.color}-600`}>{cat.title}</h3>
                    <div className="space-y-2 mb-3">
                      {activeLog.categories[cat.id]?.goals.map((g, i) => (
                        <div key={i} className="flex items-center text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                          <div className={`w-1.5 h-1.5 rounded-full bg-${cat.color}-400 mr-2`}></div>
                          {g}
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
                      <button onClick={() => handleGoalAdd(cat.id)} className="p-2 bg-slate-800 text-white rounded">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col justify-center items-center text-center p-8 bg-slate-800 rounded-xl text-slate-300">
                <Sun size={48} className="text-orange-400 mb-4" />
                <h3 className="font-serif text-xl text-white mb-2">Ready to execute?</h3>
                <button onClick={() => setView('dashboard')} className="mt-6 bg-white text-slate-900 px-6 py-2 rounded-full font-bold text-sm hover:bg-orange-50">
                  Go to Tracker
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: TRACKER / DASHBOARD --- */}
        {view === 'dashboard' && (
          <div className="animate-fade-in space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl font-bold text-slate-900">Today's Ledger</h2>
              <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">{todayLog?.date}</span>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {config.categories.map(cat => {
                const catLog = activeLog.categories[cat.id];
                return (
                  <div key={cat.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                      <div className={`text-${cat.color}-600 bg-${cat.color}-50 p-2 rounded-lg`}>
                        {/* Dynamic Icon Fallback */}
                        <GraduationCap size={20} />
                      </div>
                      <h3 className="font-serif text-lg font-bold text-slate-800 leading-tight">{cat.title}</h3>
                    </div>

                    {/* Goals Section */}
                    <div className="flex-1 mb-6">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Objectives</h4>
                      {!catLog?.goals.length ? (
                        <p className="text-sm text-slate-400 italic">No goals set.</p>
                      ) : (
                        <div className="space-y-2">
                          {catLog.goals.map((g, i) => (
                            <div 
                              key={i} 
                              onClick={() => toggleGoal(cat.id, i)}
                              className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition-colors ${catLog.completedGoals[i] ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50'}`}
                            >
                              <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center ${catLog.completedGoals[i] ? 'bg-green-500 border-green-500' : 'border-slate-300'}`}>
                                {catLog.completedGoals[i] && <CheckCircle2 size={10} className="text-white" />}
                              </div>
                              <span className={`text-xs ${catLog.completedGoals[i] ? 'line-through' : 'text-slate-700'}`}>{g}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Notes Section */}
                    <div className="mb-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider flex items-center gap-1">
                            <FileText size={10} /> Field Notes
                        </h4>
                        <textarea 
                            value={catLog?.notes || ''}
                            onChange={(e) => updateNotes(cat.id, e.target.value)}
                            placeholder={`Progress notes for ${cat.title}...`}
                            className="w-full h-20 text-xs p-2 bg-slate-50 border border-slate-200 rounded resize-none focus:bg-white focus:border-indigo-500 outline-none"
                        />
                    </div>

                    {/* Attachments Section */}
                    <div className="mb-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider flex items-center gap-1">
                            <Paperclip size={10} /> Proofs / Files
                        </h4>
                        <div className="space-y-1 mb-2">
                             {catLog?.attachments?.map((link, i) => (
                                 <a key={i} href={link} target="_blank" rel="noreferrer" className="block text-[10px] text-blue-600 truncate hover:underline bg-blue-50 px-2 py-1 rounded">
                                     {link}
                                 </a>
                             ))}
                        </div>
                        <div className="flex gap-1">
                            <input 
                                value={newLinkInputs[cat.id] || ''}
                                onChange={(e) => setNewLinkInputs({ ...newLinkInputs, [cat.id]: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleLinkAdd(cat.id)}
                                placeholder="Paste URL (Drive/Img)..."
                                className="flex-1 text-[10px] p-1 border border-slate-200 rounded focus:border-indigo-500 outline-none"
                            />
                            <button onClick={() => handleLinkAdd(cat.id)} className="px-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200">
                                <Plus size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Time Input */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50 -mx-5 -mb-5 p-3 rounded-b-xl">
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Clock size={12} /> Hours
                      </label>
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
                 <h2 className="font-serif text-2xl font-bold text-slate-900">Performance Metrics</h2>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     {config.categories.map(cat => (
                         <div key={cat.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                             <div className={`text-xs font-bold uppercase text-${cat.color}-600 mb-1`}>{cat.title}</div>
                             <div className="text-2xl font-mono font-bold text-slate-800">
                                 {stats.weekTotals[cat.id]?.toFixed(1)} <span className="text-xs text-slate-400 font-sans">hrs (Total)</span>
                             </div>
                         </div>
                     ))}
                 </div>
                 
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-6">Recent Distribution</h3>
                    <div className={`grid grid-cols-${Math.min(config.categories.length, 4)} gap-6`}>
                        {config.categories.map(cat => (
                            <BarChart 
                                key={cat.id} 
                                data={stats.chartData[cat.id]} 
                                label={cat.title} 
                                colorClass={`fill-${cat.color}-500`} 
                            />
                        ))}
                    </div>
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
              <p className="text-indigo-200 opacity-80">
                Consolidate your progress.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Daily Summary & Reflection</label>
              <textarea 
                  className="w-full h-32 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-700"
                  value={activeLog.reflection}
                  onChange={(e) => saveLog({ ...activeLog, reflection: e.target.value })}
                  placeholder="How did the day go?"
              />

              {/* Status Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Auto-sync active
                </div>

                {istHour === 23 ? (
                  <button 
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
                    onClick={() => alert("Progress finalized.")}
                  >
                    <Save size={18} />
                    <span>Finalize</span>
                  </button>
                ) : (
                  <button 
                    disabled
                    className="flex items-center gap-2 bg-slate-100 text-slate-400 px-6 py-3 rounded-lg cursor-not-allowed border border-slate-200"
                  >
                    <Lock size={18} />
                    <span>Locked until 11 PM IST</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
