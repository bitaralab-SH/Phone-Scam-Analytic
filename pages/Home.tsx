
import React, { useState, useEffect } from 'react';
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
  Timer
} from 'lucide-react';
import { AnalysisResult, CallerCategory } from '../types.ts';

const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbw6YaL6KPZ31iKAFBHaopAT-swutKSCijbk7m-7rNvPzqv84Xto6He2PLXbFWSUa4fD/exec';
const CACHE_KEY_TRENDS = 'bitara_malaysia_trends';

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
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [malaysiaTrends, setMalaysiaTrends] = useState<TrendingTrend[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  useEffect(() => {
    initIntelligence();
    const saved = localStorage.getItem('bitara_audit_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
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

  const initIntelligence = () => {
    const cached = localStorage.getItem(CACHE_KEY_TRENDS);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        
        // Caching Logic: Fetch at 1:00 AM daily and keep for 24 hours
        const now = new Date();
        const last1AM = new Date();
        last1AM.setHours(1, 0, 0, 0);
        
        // If current time is before 1 AM today, the "current" 1 AM window started yesterday
        if (now.getHours() < 1) {
          last1AM.setDate(last1AM.getDate() - 1);
        }

        // If the data was cached before the most recent 1:00 AM milestone, it's stale
        if (timestamp > last1AM.getTime()) {
          setMalaysiaTrends(data);
          return;
        }
      } catch (e) {
        localStorage.removeItem(CACHE_KEY_TRENDS);
      }
    }
    fetchDynamicTrends();
  };

  const fetchDynamicTrends = async (force: boolean = false) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey || (loadingTrends && !force)) return;

    setLoadingTrends(true);
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const prompt = `Predict top 10 trending scam phone patterns in Malaysia. Respond ONLY in JSON array: [{"rank": 1, "phone": "+60 1x-****", "claims": 150, "score": 95, "hotspot": "High"}]`;

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
      console.error("Intelligence trends fetch failed", err);
    } finally {
      setLoadingTrends(false);
    }
  };

  const performAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || cooldown > 0) return;

    setLoading(true);
    setError(null);
    const apiKey = process.env.API_KEY;

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const prompt = `Perform Audit on ${phoneNumber} (Location: ${location}, Category: ${selectedCategory}, Time: ${timeCalled}). Respond ONLY in JSON: {"score": 85, "level": "High", "confidence": 0.9, "probability": 0.88, "freqHour": 12, "freqWeekLocation": 45, "factors": ["VOIP Origin", "High Velocity"], "expertCommentary": "Analysis shows pattern match for job scam."}`;

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
      
      // Sync to Google Sheet (Non-blocking)
      fetch(SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(newResult),
      }).catch(err => console.error("Sheet sync failed", err));

    } catch (err: any) {
      const errMsg = err.message || JSON.stringify(err);
      if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        setCooldown(60);
        setError("Rate limit reached. System is in 60s cooldown.");
      } else {
        setError(`Trace Error: ${errMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

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
            {cooldown > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <Timer className="w-3 h-3 text-amber-500 animate-pulse" />
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{cooldown}s Cooldown</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">Live Node</span>
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
              Data updated daily at 01:00 AM.
            </p>
          </div>

          <div className={`bg-slate-900 rounded-2xl border border-white/5 shadow-2xl overflow-hidden relative transition-all duration-500 ${cooldown > 0 ? 'opacity-30 grayscale blur-[1px]' : 'opacity-100'}`}>
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

              <button type="submit" disabled={loading || !phoneNumber || cooldown > 0} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${loading || cooldown > 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-900/20'}`}>
                {loading ? <><RefreshCw className="w-6 h-6 animate-spin" /> <span>Analyzing Signals...</span></> : <><Zap className="w-5 h-5" /> <span>{cooldown > 0 ? `Cooldown (${cooldown}s)` : 'Initialize Trace Sequence'}</span></>}
              </button>
            </form>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-950/20 border border-red-500/20 rounded-xl flex items-center gap-3 animate-in fade-in duration-300">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-red-200/70 text-xs font-mono">{error}</p>
            </div>
          )}
        </section>

        {result && (
          <section className="mb-12 animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
              <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-white/5 shadow-2xl h-[550px] flex flex-col overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg"><BarChart3 className="w-5 h-5 text-blue-400" /></div>
                    <div>
                      <h2 className="text-lg font-bold text-white uppercase">Audit Outcome Layer</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Statistical correlation analysis</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trace ID</div>
                    <div className="text-xs font-mono text-blue-400 font-bold">{result.id}</div>
                  </div>
                </div>

                <div className="flex-1 p-8 grid grid-cols-1 md:grid-cols-12 gap-10">
                  <div className="md:col-span-4 flex flex-col items-center justify-center space-y-6">
                    <RiskMeter score={result.score} level={result.level} size={240} />
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Risk Intensity</div>
                      <div className={`text-3xl font-black uppercase tracking-tighter ${result.level === 'Critical' ? 'text-red-500' : result.level === 'High' ? 'text-orange-500' : result.level === 'Medium' ? 'text-amber-500' : 'text-emerald-500'}`}>{result.level}</div>
                    </div>
                  </div>
                  <div className="md:col-span-8 flex flex-col justify-center space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Trust %', val: `${Math.round(result.confidence * 100)}%`, icon: <ShieldCheck className="w-3 h-3 text-blue-400" /> },
                        { label: 'Scam Prob.', val: `${Math.round(result.probability * 100)}%`, icon: <AlertTriangle className="w-3 h-3 text-red-400" /> },
                        { label: '±1hr Burst', val: result.freqHour, icon: <Clock className="w-3 h-3 text-amber-400" /> },
                        { label: '7d Vector', val: result.freqWeekLocation, icon: <MapPin className="w-3 h-3 text-indigo-400" /> }
                      ].map((m, i) => (
                        <div key={i} className="bg-slate-950 p-4 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2 mb-1">{m.icon} <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{m.label}</span></div>
                          <div className="text-xl font-black text-white font-mono">{m.val}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-950/80 p-6 rounded-xl border-l-2 border-l-blue-500 h-[200px] overflow-y-auto custom-scrollbar">
                      <div className="flex items-center gap-2 mb-3"><Terminal className="w-3 h-3 text-blue-500" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dossier Commentary</span></div>
                      <p className="text-sm text-slate-300 leading-relaxed font-medium">{result.expertCommentary}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1 bg-slate-900 rounded-2xl border border-white/5 shadow-2xl h-[550px] flex flex-col">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white uppercase tracking-tight">Malaysia Intel</h2>
                  <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded uppercase tracking-tighter">Daily Ledger</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative">
                  {loadingTrends && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10">
                      <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                    </div>
                  )}
                  {malaysiaTrends.map((item) => (
                    <div key={item.rank} className="p-3 bg-slate-950 rounded-xl border border-white/5 flex items-center justify-between hover:bg-slate-900 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-slate-700 font-bold">{item.rank}</span>
                        <div>
                          <div className="text-xs font-mono font-bold text-slate-300">{item.phone}</div>
                          <div className="text-[8px] font-bold text-slate-600 uppercase">{item.claims} Signals</div>
                        </div>
                      </div>
                      <div className={`text-xs font-black font-mono px-2 py-1 rounded ${item.score > 90 ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-500'}`}>{item.score}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="bg-slate-900 rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg"><Database className="w-5 h-5 text-slate-400" /></div>
              <h2 className="text-lg font-bold text-white uppercase">Community Signal Log</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-950/50">
                  <th className="px-8 py-4 text-[9px] font-bold text-slate-600 uppercase border-b border-white/5">Subject Trace</th>
                  <th className="px-8 py-4 text-[9px] font-bold text-slate-600 uppercase border-b border-white/5">Context</th>
                  <th className="px-8 py-4 text-[9px] font-bold text-slate-600 uppercase border-b border-white/5">Score</th>
                  <th className="px-8 py-4 text-[9px] font-bold text-slate-600 uppercase border-b border-white/5">Consensus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.length > 0 ? history.map((h) => (
                  <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-8 py-4"><div className="text-xs font-mono font-bold text-slate-300">{h.phoneNumber}</div></td>
                    <td className="px-8 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">{h.reportedCategory}</td>
                    <td className="px-8 py-4 text-xs font-black font-mono text-white">{h.score}</td>
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Logged</span>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={4} className="px-8 py-16 text-center text-slate-700 uppercase text-[10px] font-bold tracking-widest">No Intelligence Collected</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 bg-slate-950 py-12 px-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <span className="text-[11px] font-black text-white uppercase tracking-widest">BITARA LAB SIGNAL INTELLIGENCE</span>
        </div>
        <div className="text-[9px] text-slate-700 font-mono">PROBABILISTIC CONSENSUS ENGINE V2.5.5-STABLE</div>
      </footer>
    </div>
  );
};

export default Home;
