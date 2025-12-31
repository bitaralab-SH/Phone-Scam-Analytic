
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import RiskMeter from '../components/RiskMeter.tsx';
import { 
  ShieldCheck, 
  Search, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  History, 
  Activity, 
  Database,
  Globe,
  BarChart3,
  RefreshCw,
  Terminal,
  ThumbsUp,
  Fingerprint,
  Zap,
  Calendar,
  Loader2,
  ChevronRight,
  Settings,
  Info,
  Layers,
  Timer,
  Cpu,
  Lock,
  DownloadCloud,
  WifiOff
} from 'lucide-react';
import { AnalysisResult, CallerCategory } from '../types.ts';

const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbw6YaL6KPZ31iKAFBHaopAT-swutKSCijbk7m-7rNvPzqv84Xto6He2PLXbFWSUa4fD/exec';
const CACHE_KEY_TRENDS = 'bitara_malaysia_trends';
const CACHE_KEY_LAST_ATTEMPT = 'bitara_trends_last_attempt';
const CACHE_KEY_QUOTA_SUPPRESS = 'bitara_quota_suppress';

// Increased throttle to 1 second for Shinjiru/Shared Hosting environments 
// to prevent IP-based burst detection.
const GLOBAL_API_THROTTLE_MS = 1000;

const CALLER_CATEGORIES: { id: CallerCategory; label: string; icon: string; color: string }[] = [
  { id: 'Official Bank', label: 'Official Bank', icon: '🏛️', color: 'blue' },
  { id: 'Government/Authority', label: 'Gov / Authority', icon: '⚖️', color: 'slate' },
  { id: 'Telecommunications', label: 'Telco Service', icon: '📡', color: 'indigo' },
  { id: 'Logistics/Courier', label: 'Logistics/Courier', icon: '📦', color: 'orange' },
  { id: 'Financial Sales', label: 'Financial Sales', icon: '💰', color: 'emerald' },
  { id: 'Real Estate', label: 'Real Estate', icon: '🏠', color: 'cyan' },
  { id: 'General Telemarketing', label: 'Telemarketing', icon: '📞', color: 'sky' },
  { id: 'Market Research', label: 'Market Research', icon: '📊', color: 'violet' },
  { id: 'Bank Impersonator', label: 'Bank Impersonator', icon: '🎭', color: 'red' },
  { id: 'Authority Impersonator', label: 'Gov Impersonator', icon: '🕵️', color: 'rose' },
  { id: 'Job Offer Scam', label: 'Job Offer Scam', icon: '💼', color: 'pink' },
  { id: 'Investment/Crypto', label: 'Invest/Crypto Scam', icon: '📈', color: 'amber' },
  { id: 'Debt Collector', label: 'Debt Collector', icon: '📑', color: 'stone' },
  { id: 'Winner/Prize Scam', label: 'Winner/Prize Scam', icon: '🏆', color: 'yellow' },
  { id: 'Personal/Private', label: 'Personal/Private', icon: '👤', color: 'green' },
  { id: 'Automated Bot', label: 'Automated Bot', icon: '🤖', color: 'zinc' },
  { id: 'Unknown', label: 'Unknown / Others', icon: '❓', color: 'gray' },
];

interface TrendingTrend {
  rank: number;
  phone: string;
  claims: number;
  score: number;
  hotspot: string;
}

const Home: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('Kuala Lumpur');
  const [dateCalled, setDateCalled] = useState(new Date().toISOString().split('T')[0]);
  const [timeCalled, setTimeCalled] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
  const [selectedCategory, setSelectedCategory] = useState<CallerCategory>('Unknown');
  const [loading, setLoading] = useState(false);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [malaysiaTrends, setMalaysiaTrends] = useState<TrendingTrend[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);
  
  const lastCallTimeRef = useRef<number>(0);

  useEffect(() => {
    // BOOT: Restore existing session data
    const cached = localStorage.getItem(CACHE_KEY_TRENDS);
    if (cached) {
      try {
        setMalaysiaTrends(JSON.parse(cached).data);
      } catch (e) {
        console.warn("Invalid cache data");
      }
    }

    const savedHistory = localStorage.getItem('bitara_audit_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const throttleGap = async () => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTimeRef.current;
    if (timeSinceLastCall < GLOBAL_API_THROTTLE_MS) {
      const delay = GLOBAL_API_THROTTLE_MS - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    lastCallTimeRef.current = Date.now();
  };

  const manualIntelSync = async () => {
    if (loadingTrends || cooldown > 0) return;
    
    // Safety check for data freshness
    const lastSync = localStorage.getItem(CACHE_KEY_TRENDS);
    if (lastSync) {
      const { timestamp } = JSON.parse(lastSync);
      if (Date.now() - timestamp < 3600000) { // 1 hour threshold for manual override
        setError("INTELLIGENCE FRESH: Data recently synced. Preserving quota.");
        return;
      }
    }

    setLoadingTrends(true);
    setError(null);

    try {
      await throttleGap();
      const apiKey = process.env.API_KEY;
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const prompt = `Identify top 10 trending scam phone numbers in Malaysia today. Format as JSON array: [{"rank": 1, "phone": "+60 1x-****", "claims": 150, "score": 95, "hotspot": "High"}]`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          responseMimeType: "application/json", 
          tools: [{ googleSearch: {} }] 
        }
      });

      const parsed = JSON.parse(response.text);
      if (Array.isArray(parsed)) {
        const sorted = parsed.sort((a, b) => b.score - a.score).map((item, idx) => ({ ...item, rank: idx + 1 }));
        setMalaysiaTrends(sorted);
        localStorage.setItem(CACHE_KEY_TRENDS, JSON.stringify({ data: sorted, timestamp: Date.now() }));
      }
    } catch (err: any) {
      const errMsg = err.message || JSON.stringify(err);
      if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        setCooldown(60);
        setError("IP LIMIT EXCEEDED: Your shared server IP is temporarily restricted. Wait 60s.");
      } else {
        setError(`Sync Error: ${errMsg}`);
      }
    } finally {
      setLoadingTrends(false);
    }
  };

  const performAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || cooldown > 0 || loading) return;

    setIsWarmingUp(true);
    setError(null);
    
    // Increased buffering for shared hosting
    await new Promise(resolve => setTimeout(resolve, 2000));
    await throttleGap();
    setIsWarmingUp(false);

    setLoading(true);
    const apiKey = process.env.API_KEY;

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const prompt = `Audit phone ${phoneNumber} (Location: ${location}, Role: ${selectedCategory}, Time: ${timeCalled}). Analyze current reputation. Respond JSON ONLY: {"score": 0-100, "level": "Low|Medium|High|Critical", "confidence": 0.0-1.0, "probability": 0.0-1.0, "freqHour": number, "freqWeekLocation": number, "factors": ["reason"], "expertCommentary": "summary"}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { 
          responseMimeType: "application/json", 
          tools: [{ googleSearch: {} }] 
        }
      });

      const parsed = JSON.parse(response.text);
      const newResult: AnalysisResult = {
        id: `AUDIT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        phoneNumber, 
        location, 
        incidentDate: dateCalled, 
        incidentTime: timeCalled, 
        reportedCategory: selectedCategory, 
        timestamp: new Date().toISOString(), 
        ...parsed
      };

      setResult(newResult);
      const updatedHistory = [newResult, ...history].slice(0, 50);
      setHistory(updatedHistory);
      localStorage.setItem('bitara_audit_history', JSON.stringify(updatedHistory));
      
      fetch(SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(newResult),
      }).catch(err => console.debug("Vault sync deferred."));

    } catch (err: any) {
      const errMsg = err.message || JSON.stringify(err);
      if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        setCooldown(60);
        localStorage.setItem(CACHE_KEY_QUOTA_SUPPRESS, Date.now().toString());
        setError("SEARCH QUOTA EXCEEDED: Your server IP address has reached its collective limit. Try again in 60s.");
      } else {
        setError(`Telemetry Error: ${errMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const isSyncSuppressed = localStorage.getItem(CACHE_KEY_QUOTA_SUPPRESS) !== null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      <div className="fixed inset-0 pointer-events-none opacity-40">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent animate-pulse" />
      </div>

      <nav className="relative z-10 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white uppercase">BITARA <span className="text-blue-500">LAB</span></span>
          </div>
          <div className="flex items-center gap-3">
            {isSyncSuppressed && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                <Lock className="w-3 h-3 text-blue-400" />
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Shield Mode Active</span>
              </div>
            )}
            {cooldown > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <Timer className="w-3 h-3 text-amber-500 animate-pulse" />
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{cooldown}s Cooldown</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">Node Stable</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <section className="mb-12">
          <div className="max-w-3xl mb-10">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter leading-tight uppercase">
              Collective Intelligence <span className="text-blue-500">Protocol</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed font-medium">
              Institutional signal gathering for the Malaysian telecommunications ecosystem. 
              <span className="text-amber-500/80 font-bold block mt-2 uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
                <WifiOff className="w-3 h-3" /> Shared Infrastructure Adaptation Active
              </span>
            </p>
          </div>

          {/* TRACE ANALYSIS RESULT - PLACED ON TOP */}
          {result && (
            <div className="mb-12 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col ring-1 ring-blue-500/20">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-950/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg"><BarChart3 className="w-5 h-5 text-blue-400" /></div>
                    <div>
                      <h2 className="text-lg font-bold text-white uppercase">Primary Trace Outcome</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Analysis Result</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sequence ID</div>
                    <div className="text-xs font-mono text-blue-400 font-bold tracking-tighter">{result.id}</div>
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-10">
                  <div className="md:col-span-4 flex flex-col items-center justify-center space-y-6">
                    <RiskMeter score={result.score} level={result.level} size={240} />
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Threat Assessment</div>
                      <div className={`text-4xl font-black uppercase tracking-tighter ${result.level === 'Critical' ? 'text-red-500' : result.level === 'High' ? 'text-orange-500' : result.level === 'Medium' ? 'text-amber-500' : 'text-emerald-500'}`}>{result.level}</div>
                    </div>
                  </div>
                  <div className="md:col-span-8 flex flex-col justify-center space-y-8">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Trust Index', val: `${Math.round(result.confidence * 100)}%`, icon: <ShieldCheck className="w-3 h-3 text-blue-400" /> },
                        { label: 'Scam Risk', val: `${Math.round(result.probability * 100)}%`, icon: <AlertTriangle className="w-3 h-3 text-red-400" /> },
                        { label: 'Hourly Spike', val: result.freqHour, icon: <Clock className="w-3 h-3 text-amber-400" /> },
                        { label: 'Regional Load', val: result.freqWeekLocation, icon: <MapPin className="w-3 h-3 text-indigo-400" /> }
                      ].map((m, i) => (
                        <div key={i} className="bg-slate-950 p-5 rounded-2xl border border-white/5 shadow-inner">
                          <div className="flex items-center gap-2 mb-2">{m.icon} <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.15em]">{m.label}</span></div>
                          <div className="text-2xl font-black text-white font-mono">{m.val}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-950/80 p-8 rounded-2xl border-l-4 border-l-blue-500 min-h-[160px] relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Terminal className="w-24 h-24 text-white" />
                      </div>
                      <div className="flex items-center gap-2 mb-4"><Terminal className="w-4 h-4 text-blue-500" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dossier Interpretation</span></div>
                      <p className="text-sm text-slate-300 leading-relaxed font-medium relative z-10">{result.expertCommentary}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className={`lg:col-span-3 bg-slate-900 rounded-2xl border border-white/5 shadow-2xl overflow-hidden relative transition-all duration-500 ${cooldown > 0 ? 'opacity-30 grayscale blur-[1px]' : 'opacity-100'}`}>
              <form onSubmit={performAudit} className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Fingerprint className="w-3 h-3" /> Audit Subject</label>
                    <input type="text" placeholder="+60 1x-xxxx xxxx" className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-3 h-3" /> Origin Vector</label>
                    <input type="text" placeholder="District" className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white" value={location} onChange={(e) => setLocation(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Calendar className="w-3 h-3" /> Date</label>
                    <input type="date" className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white font-mono" value={dateCalled} onChange={(e) => setDateCalled(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Clock className="w-3 h-3" /> Time</label>
                    <input type="time" className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white font-mono" value={timeCalled} onChange={(e) => setTimeCalled(e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Claimed Identity Context</label>
                  <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                    {CALLER_CATEGORIES.map((cat) => (
                      <button key={cat.id} type="button" onClick={() => setSelectedCategory(cat.id)} className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all uppercase tracking-wider ${selectedCategory === cat.id ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/20'}`}>
                        <span>{cat.icon}</span> {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={loading || isWarmingUp || !phoneNumber || cooldown > 0} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${loading || isWarmingUp || cooldown > 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/20'}`}>
                  {isWarmingUp ? (
                    <><Cpu className="w-6 h-6 animate-pulse" /> <span>Buffer Lock Engaged...</span></>
                  ) : loading ? (
                    <><RefreshCw className="w-6 h-6 animate-spin" /> <span>Syncing with Global IP Pool...</span></>
                  ) : (
                    <><Zap className="w-5 h-5" /> <span>{cooldown > 0 ? `Rate Limit Block (${cooldown}s)` : 'Initialize Trace Sequence'}</span></>
                  )}
                </button>
              </form>
            </div>

            <div className="lg:col-span-1 bg-slate-900 rounded-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden min-h-[400px]">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
                <div className="flex flex-col">
                  <h2 className="text-sm font-black text-white uppercase tracking-tight">Malaysia Trends</h2>
                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">Daily Ledger</span>
                </div>
                <button onClick={manualIntelSync} disabled={loadingTrends || cooldown > 0} className="p-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl transition-all group border border-blue-400/10" title="Sync Ledger Now">
                  {loadingTrends ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative">
                {malaysiaTrends.length > 0 ? malaysiaTrends.map((item) => (
                  <div key={item.rank} className="p-3 bg-slate-950 rounded-xl border border-white/5 flex items-center justify-between hover:bg-slate-900 transition-all group">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-slate-700 font-bold">{item.rank}</span>
                      <div>
                        <div className="text-xs font-mono font-bold text-slate-300 group-hover:text-white transition-colors">{item.phone}</div>
                        <div className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">{item.claims} Reports Identified</div>
                      </div>
                    </div>
                    <div className={`text-[10px] font-black font-mono px-2 py-1 rounded ${item.score > 90 ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-500'}`}>{item.score}</div>
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <Info className="w-10 h-10 text-slate-800" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-600 uppercase leading-relaxed">No Data Cached</p>
                      <p className="text-[8px] text-slate-700 uppercase tracking-widest">Shared IP pool requires manual sync</p>
                    </div>
                    <button onClick={manualIntelSync} className="w-full text-[10px] font-black text-blue-500 border border-blue-500/20 px-3 py-2.5 rounded-xl hover:bg-blue-500/10 transition-all uppercase tracking-widest">Initial Sync</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-amber-950/20 border border-amber-500/20 rounded-xl flex items-center gap-4 animate-in fade-in duration-300">
              <div className="p-2 bg-amber-500/10 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-500" /></div>
              <div className="flex flex-col">
                <p className="text-amber-200/90 text-xs font-bold uppercase tracking-tight">{error}</p>
                <p className="text-amber-500/60 text-[9px] font-bold uppercase mt-1 leading-tight">Shared IP throttling adaptation active. Auto-sync is currently deferred to protect your audit quota.</p>
              </div>
            </div>
          )}
        </section>

        <section className="bg-slate-900 rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg"><Database className="w-5 h-5 text-slate-400" /></div>
              <h2 className="text-lg font-bold text-white uppercase tracking-tight">Personal Audit Vault</h2>
            </div>
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Stored Locally</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-950/50">
                  <th className="px-8 py-5 text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] border-b border-white/5">Subject Identifier</th>
                  <th className="px-8 py-5 text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] border-b border-white/5">Contextual Role</th>
                  <th className="px-8 py-5 text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] border-b border-white/5">Threat Index</th>
                  <th className="px-8 py-5 text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] border-b border-white/5">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.length > 0 ? history.map((h) => (
                  <tr key={h.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-5"><div className="text-xs font-mono font-bold text-slate-300 group-hover:text-blue-400 transition-colors">{h.phoneNumber}</div></td>
                    <td className="px-8 py-5 text-[9px] font-bold text-slate-500 uppercase tracking-widest">{h.reportedCategory}</td>
                    <td className="px-8 py-5 text-xs font-black font-mono text-white">{h.score}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Vaulted</span>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-700 uppercase text-[10px] font-bold tracking-[0.3em]">No Intelligence Collected</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 bg-slate-950 py-12 px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/10 rounded-lg"><ShieldCheck className="w-5 h-5 text-blue-600" /></div>
          <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">BITARA LAB SIGNAL INTELLIGENCE</span>
        </div>
        <div className="text-[9px] text-slate-700 font-mono uppercase tracking-widest flex items-center gap-4">
          <span>Shared Mode Protocol V2.6.1</span>
          <span className="w-1 h-1 bg-slate-800 rounded-full" />
          <span>Priority Buffer Layer Active</span>
        </div>
      </footer>
    </div>
  );
};

export default Home;
