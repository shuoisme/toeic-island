"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Battery, BrickWall, Cpu, Hammer, BookOpen, Headphones, GraduationCap, X, CheckCircle, XCircle, Volume2, MapPin, Zap, Cloud, Waves, Sun, Moon } from 'lucide-react';

// --- 1. 定義資料型別 ---
interface Team {
  id: string;
  name: string;
  res_electricity: number;
  res_bricks: number;
  res_chips: number;
}
interface Blueprint {
  id: number;
  name: string;
  description: string;
  cost_electricity: number;
  cost_bricks: number;
  cost_chips: number;
  icon_name: string;
}
interface BuiltBuilding {
  id: string;
  blueprint_id: number;
  built_at: string;
  blueprint?: Blueprint;
  isOptimistic?: boolean;
}
interface Question {
  id: number;
  type: 'listening' | 'reading' | 'vocab';
  question: string;
  question_zh: string;
  options: string[];
  options_zh: string[];
  answer: number;
  explanation: string;
}

// --- 2. 建築外觀設定 ---
const BUILDING_ASSETS: Record<string, { emoji: string, color: string, scale: string }> = {
  // Lv.1 荒島求生期
  '營火': { emoji: '🔥', color: 'from-orange-400 to-red-600', scale: 'scale-75' },
  '小木屋': { emoji: '🛖', color: 'from-yellow-600 to-amber-800', scale: 'scale-90' },
  '販賣機': { emoji: '🥤', color: 'from-blue-400 to-red-500', scale: 'scale-75' },
  
  // Lv.2 村莊發展期
  '漢堡店': { emoji: '🍔', color: 'from-orange-300 to-yellow-500', scale: 'scale-90' },
  '風力發電機': { emoji: '🌬️', color: 'from-cyan-300 to-blue-500', scale: 'scale-125' },
  '圖書館': { emoji: '🏛️', color: 'from-slate-300 to-slate-500', scale: 'scale-110' },
  '學校': { emoji: '🏫', color: 'from-yellow-200 to-orange-300', scale: 'scale-110' },

  // Lv.3 繁華都市期
  '廣播塔': { emoji: '🗼', color: 'from-red-500 to-orange-600', scale: 'scale-150' },
  '電影院': { emoji: '🍿', color: 'from-purple-500 to-pink-500', scale: 'scale-100' },
  '國際機場': { emoji: '✈️', color: 'from-blue-200 to-sky-500', scale: 'scale-125' },
  '摩天大樓': { emoji: '🏙️', color: 'from-indigo-300 to-purple-500', scale: 'scale-150' },

  // Lv.4 未來科幻期
  '太空火箭': { emoji: '🚀', color: 'from-gray-200 to-orange-500', scale: 'scale-150' },
  '人造衛星': { emoji: '🛰️', color: 'from-blue-900 to-purple-900', scale: 'scale-75' },
  '自由女神像': { emoji: '🗽', color: 'from-emerald-300 to-teal-600', scale: 'scale-150' },
  '外星傳送門': { emoji: '🌀', color: 'from-fuchsia-500 to-purple-600', scale: 'scale-150' },
};
const DEFAULT_ASSET = { emoji: '📦', color: 'from-gray-400 to-gray-600', scale: 'scale-100' };

export default function Home() {
  const [team, setTeam] = useState<Team | null>(null);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [myBuildings, setMyBuildings] = useState<BuiltBuilding[]>([]);
  
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // ★ 新增：日夜模式狀態 (預設為深色模式 true)
  const [isDarkMode, setIsDarkMode] = useState(true);

  // 初始化與資料監聽
  useEffect(() => {
    async function initData() {
      const { data: teamData } = await supabase.from('teams').select('*').limit(1).single();
      if (teamData) setTeam(teamData as Team);

      const { data: bpData } = await supabase.from('building_blueprints').select('*').order('cost_bricks', { ascending: true });
      if (bpData) setBlueprints(bpData as Blueprint[]);

      if (teamData) {
        const { data: builtData } = await supabase
          .from('team_buildings')
          .select(`*, blueprint:building_blueprints(*)`)
          .eq('team_id', teamData.id)
          .order('built_at', { ascending: true });
        if (builtData) setMyBuildings(builtData as any);
      }
    }
    initData();

    const channel = supabase.channel('team_update')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, (payload) => {
        setTeam(payload.new as Team);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  const startTraining = async (type: 'listening' | 'reading' | 'vocab') => {
    setLoading(true);
    const { data, error } = await supabase.from('questions').select('*').eq('type', type);

    if (error || !data || data.length === 0) {
      alert("題庫讀取失敗！請先去後台匯入。");
      setLoading(false);
      return;
    }
    const randomQ = data[Math.floor(Math.random() * data.length)] as Question;
    setSelectedOption(null);
    setShowResult(false);
    setActiveQuestion(randomQ);
    setLoading(false);
    if (type === 'listening') setTimeout(() => speakText(randomQ.question), 500);
  };

  const submitAnswer = async () => {
    if (!team || !activeQuestion || selectedOption === null) return;
    setShowResult(true);
    if (selectedOption === activeQuestion.answer) {
      let reward = { elec: 0, brick: 0, chip: 0 };
      if (activeQuestion.type === 'listening') reward.elec = 20;
      if (activeQuestion.type === 'reading') reward.brick = 20;
      if (activeQuestion.type === 'vocab') reward.chip = 20;

      const newTeam = { ...team, res_electricity: team.res_electricity + reward.elec, res_bricks: team.res_bricks + reward.brick, res_chips: team.res_chips + reward.chip };
      setTeam(newTeam);
      await supabase.from('teams').update({
        res_electricity: newTeam.res_electricity, res_bricks: newTeam.res_bricks, res_chips: newTeam.res_chips
      }).eq('id', team.id);
    }
  };

  const handleBuild = async (bp: Blueprint) => {
    if (!team) return;
    if (team.res_electricity < bp.cost_electricity || team.res_bricks < bp.cost_bricks || team.res_chips < bp.cost_chips) {
      alert("資源不足！"); return;
    }
    if (!confirm(`確定要建造「${bp.name}」嗎？`)) return;
    setLoading(true);

    const newTeamState = { ...team, res_electricity: team.res_electricity - bp.cost_electricity, res_bricks: team.res_bricks - bp.cost_bricks, res_chips: team.res_chips - bp.cost_chips };
    setTeam(newTeamState);

    const optimisticBuilding: any = { id: 'temp-' + Date.now(), blueprint_id: bp.id, built_at: new Date().toISOString(), blueprint: bp, isOptimistic: true };
    setMyBuildings([...myBuildings, optimisticBuilding]);

    try {
      await supabase.from('teams').update({
        res_electricity: newTeamState.res_electricity, res_bricks: newTeamState.res_bricks, res_chips: newTeamState.res_chips
      }).eq('id', team.id);
      await supabase.from('team_buildings').insert({ team_id: team.id, blueprint_id: bp.id });
    } catch (error) {
      console.error(error); window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  if (!team) return <div className="min-h-screen bg-sky-900 flex items-center justify-center text-white animate-pulse">🌊 正在前往多益島...</div>;

  // ★ 根據模式設定主題樣式
  const theme = {
    bg: isDarkMode ? 'bg-slate-950 text-white' : 'bg-sky-50 text-slate-900',
    panelBg: isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white/80 border-white shadow-xl backdrop-blur-md',
    cardBg: isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 shadow-md',
    textMuted: isDarkMode ? 'text-slate-400' : 'text-slate-500',
    modalBg: isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xl',
  };

  return (
    <main className={`min-h-screen font-sans overflow-x-hidden transition-colors duration-500 ${theme.bg}`}>
      
      {/* === 1. 島嶼場景 (Hero) === */}
      {/* 根據日夜切換天空顏色 */}
      <section className={`relative w-full h-[60vh] min-h-[500px] overflow-hidden flex flex-col items-center justify-center transition-all duration-1000 ${
        isDarkMode 
          ? 'bg-gradient-to-b from-slate-900 via-sky-900 to-indigo-950'  // 晚上的天空
          : 'bg-gradient-to-b from-sky-300 via-sky-200 to-sky-100'        // 白天的天空
      }`}>
        
        {/* 日夜切換按鈕 (右上角) */}
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="absolute top-6 right-6 z-50 p-3 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white hover:scale-110 transition shadow-lg"
          title="切換日夜模式"
        >
          {isDarkMode ? <Sun className="text-yellow-300" /> : <Moon className="text-slate-700" />}
        </button>

        {/* 雲朵 (白天明顯，晚上半透明) */}
        <div className={`absolute top-10 left-10 animate-float ${isDarkMode ? 'text-white/10' : 'text-white/80'}`} style={{animationDuration: '6s'}}><Cloud size={64} fill="currentColor"/></div>
        <div className={`absolute top-20 right-20 animate-float ${isDarkMode ? 'text-white/10' : 'text-white/60'}`} style={{animationDuration: '8s'}}><Cloud size={48} fill="currentColor"/></div>

        {/* 頂部資訊列 */}
        <div className="absolute top-6 z-20 flex flex-col items-center gap-2 w-full px-4">
           <h1 className="text-2xl font-bold flex items-center gap-2 text-white drop-shadow-md bg-black/20 px-4 py-1 rounded-full backdrop-blur-sm">
             <MapPin className="text-yellow-300"/> {team.name} <span className="text-xs bg-yellow-500 text-yellow-900 px-2 rounded-full font-bold">Lv.{myBuildings.length + 1}</span>
           </h1>
           <div className={`flex gap-2 p-2 rounded-2xl shadow-xl border-2 border-white/50 ${isDarkMode ? 'bg-slate-900/80 text-white' : 'bg-white/90 text-slate-900'}`}>
             <ResourcePill icon={<Battery size={16} className="text-yellow-600"/>} value={team.res_electricity} label="電力"/>
             <ResourcePill icon={<BrickWall size={16} className="text-red-600"/>} value={team.res_bricks} label="磚塊"/>
             <ResourcePill icon={<Cpu size={16} className="text-blue-600"/>} value={team.res_chips} label="晶片"/>
           </div>
        </div>

        {/* 島嶼本體 */}
        <div className="relative z-10 w-[90vw] max-w-3xl h-[300px] mt-20">
          <div className={`absolute inset-0 rounded-[50%] border-b-[20px] shadow-2xl transform rotate-1 scale-y-90 transition-colors duration-1000 ${isDarkMode ? 'bg-[#14532d] border-[#052e16]' : 'bg-[#4ade80] border-[#15803d]'}`}></div>
          <div className={`absolute -inset-2 rounded-[50%] -z-10 transform scale-y-90 transition-colors duration-1000 ${isDarkMode ? 'bg-[#854d0e]' : 'bg-[#fde047]'}`}></div>

          <div className="absolute inset-0 flex flex-wrap justify-center items-center content-center gap-2 sm:gap-4 p-8 md:p-16">
            {myBuildings.length === 0 ? (
               <div className={`font-bold opacity-50 animate-pulse text-center ${isDarkMode ? 'text-green-300' : 'text-green-800'}`}>
                 這裡還是一片空地...<br/>快去蓋第一棟建築吧！
               </div>
            ) : (
              myBuildings.map((b, idx) => {
                const asset = BUILDING_ASSETS[b.blueprint?.name || ''] || DEFAULT_ASSET;
                const isNew = b.isOptimistic;
                return (
                  <div key={b.id} className={`flex flex-col items-center transition-all duration-500 group ${isNew ? 'animate-bounce-in' : 'hover:-translate-y-2'}`} style={{ zIndex: 10 + idx }}>
                    <div className={`text-[3.5rem] md:text-[5rem] drop-shadow-2xl filter ${asset.scale} relative cursor-help`}>
                      {asset.emoji}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-4 bg-black/20 rounded-full blur-sm -z-10"></div>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap">
                        {b.blueprint?.name}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 波浪 */}
        <div className="absolute bottom-0 w-full overflow-hidden">
           <Waves className={`w-full h-32 scale-y-50 animate-float ${isDarkMode ? 'text-indigo-900/50' : 'text-white/40'}`} />
        </div>
      </section>

      {/* === 2. 操作面板區 === */}
      <div className="max-w-5xl mx-auto px-4 -mt-10 relative z-20 pb-20">
        <div className={`rounded-3xl border shadow-2xl p-6 md:p-8 transition-colors duration-500 ${theme.panelBg}`}>
          
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-500">
              <BookOpen className="text-purple-500"/> 資源採集 (答題)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TrainCard isDark={isDarkMode} title="聽力" desc="獲得電力 ⚡" icon={<Headphones size={32}/>} color="bg-yellow-500" onClick={() => startTraining('listening')} />
              <TrainCard isDark={isDarkMode} title="閱讀" desc="獲得磚塊 🧱" icon={<BookOpen size={32}/>} color="bg-red-500" onClick={() => startTraining('reading')} />
              <TrainCard isDark={isDarkMode} title="單字" desc="獲得晶片 💾" icon={<GraduationCap size={32}/>} color="bg-blue-500" onClick={() => startTraining('vocab')} />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-orange-500">
              <Hammer className="text-orange-500"/> 建設島嶼 (商店)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
              {blueprints.map((bp) => {
                const canAfford = team.res_electricity >= bp.cost_electricity && team.res_bricks >= bp.cost_bricks && team.res_chips >= bp.cost_chips;
                const asset = BUILDING_ASSETS[bp.name] || DEFAULT_ASSET;
                
                return (
                  <button
                    key={bp.id}
                    disabled={!canAfford || loading}
                    onClick={() => handleBuild(bp)}
                    className={`relative flex flex-col p-4 rounded-xl border-2 text-left transition-all group ${
                      canAfford 
                        ? `${isDarkMode ? 'bg-slate-800 hover:bg-slate-750' : 'bg-white hover:bg-sky-50'} border-transparent hover:border-orange-400 shadow-sm hover:shadow-lg hover:-translate-y-1` 
                        : 'bg-slate-500/10 border-transparent opacity-50 cursor-not-allowed grayscale'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className={`text-4xl p-3 rounded-xl border shadow-inner group-hover:scale-110 transition ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>{asset.emoji}</div>
                      {canAfford && <span className="text-[10px] font-bold bg-orange-500 text-white px-2 py-1 rounded-full animate-pulse">可建造</span>}
                    </div>
                    <div className="mb-3">
                      <h3 className={`font-bold text-lg ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{bp.name}</h3>
                      <p className={`text-xs line-clamp-1 ${theme.textMuted}`}>{bp.description}</p>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2 text-xs font-mono border-t border-slate-500/20 pt-2">
                       <span className={team.res_electricity >= bp.cost_electricity ? 'text-yellow-500' : 'text-red-500'}>⚡{bp.cost_electricity}</span>
                       <span className={team.res_bricks >= bp.cost_bricks ? 'text-red-500' : 'text-red-600'}>🧱{bp.cost_bricks}</span>
                       <span className={team.res_chips >= bp.cost_chips ? 'text-blue-500' : 'text-red-500'}>💾{bp.cost_chips}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* === 3. 答題 Modal === */}
      {activeQuestion && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-3xl border p-6 relative animate-in fade-in zoom-in max-h-[90vh] overflow-y-auto ${theme.modalBg}`}>
            <button onClick={() => { setActiveQuestion(null); window.speechSynthesis.cancel(); }} className="absolute top-4 right-4 opacity-50 hover:opacity-100 p-2 rounded-full transition"><X size={20} /></button>
            <div className="mb-6">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                activeQuestion.type === 'listening' ? 'bg-yellow-500/20 text-yellow-600' : activeQuestion.type === 'reading' ? 'bg-red-500/20 text-red-600' : 'bg-blue-500/20 text-blue-600'
              }`}>{activeQuestion.type.toUpperCase()}</span>
            </div>
            
            <div className="mb-8">
              {activeQuestion.type === 'listening' ? (
                <div className={`text-center p-6 rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                   <button onClick={() => speakText(activeQuestion.question)} className="bg-yellow-500 text-white p-6 rounded-full shadow-lg hover:scale-105 transition mb-4 animate-bounce-in"><Volume2 size={40}/></button>
                   <p className={`text-sm font-bold ${theme.textMuted}`}>點擊播放</p>
                   {showResult && <div className="mt-4 text-left border-t border-slate-500/20 pt-4 animate-in fade-in"><p className="font-bold mb-1">{activeQuestion.question}</p><p className={`text-sm ${theme.textMuted}`}>{activeQuestion.question_zh}</p></div>}
                </div>
              ) : (
                <div><h3 className="text-xl font-bold mb-2 leading-relaxed whitespace-pre-wrap">{activeQuestion.question}</h3>{showResult && <p className={`text-sm ${theme.textMuted} animate-in fade-in`}>{activeQuestion.question_zh}</p>}</div>
              )}
            </div>

            <div className="space-y-3 mb-6">
              {activeQuestion.options.map((opt, idx) => {
                const isSel = selectedOption === idx; const isCor = idx === activeQuestion.answer;
                let style = isDarkMode ? "border-slate-700 bg-slate-800 hover:bg-slate-700" : "border-slate-200 bg-slate-50 hover:bg-slate-100";
                
                if (showResult) {
                  if (isCor) style = "border-green-500 bg-green-500/20 text-green-600";
                  else if (isSel) style = "border-red-500 bg-red-500/20 text-red-600";
                  else style = "opacity-50 grayscale";
                } else if (isSel) {
                  style = "border-orange-500 bg-orange-500/20 text-orange-600";
                }
                return (
                  <button key={idx} disabled={showResult} onClick={() => setSelectedOption(idx)} className={`w-full p-4 rounded-xl border-2 text-left transition-all ${style}`}>
                    <div className="flex justify-between items-center"><span className="font-bold"><span className="mr-3 opacity-50">{String.fromCharCode(65+idx)}.</span>{opt}</span>{showResult && isCor && <CheckCircle className="text-green-500" size={20}/>}{showResult && isSel && !isCor && <XCircle className="text-red-500" size={20}/>}</div>{showResult && <div className="text-xs mt-1 ml-6 opacity-70">{activeQuestion.options_zh[idx]}</div>}
                  </button>
                )
              })}
            </div>

            {!showResult ? (
              <button onClick={submitAnswer} disabled={selectedOption === null} className={`w-full py-3 font-bold rounded-xl disabled:opacity-50 transition shadow-lg ${isDarkMode ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-700'}`}>送出答案</button>
            ) : (
              <div className="animate-in slide-in-from-bottom-2">
                <div className={`p-4 rounded-xl mb-4 text-sm border shadow-inner ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}><span className="font-bold block mb-1">💡 解析：</span>{activeQuestion.explanation}</div>
                <button onClick={() => { setActiveQuestion(null); window.speechSynthesis.cancel(); }} className={`w-full py-3 font-bold rounded-xl text-white shadow-lg transition hover:scale-[1.02] ${selectedOption === activeQuestion.answer ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-orange-500 to-red-600'}`}>{selectedOption === activeQuestion.answer ? "🎉 答對了！領取獎勵" : "💪 下一題會更好"}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// 小元件
function ResourcePill({ icon, value, label }: any) {
  return <div className="flex items-center gap-1.5 px-1"><div className="p-1.5 bg-slate-100/50 rounded-full shadow-sm">{icon}</div><div className="flex flex-col leading-none"><span className="font-bold text-sm opacity-90">{value}</span><span className="text-[10px] opacity-70 font-bold">{label}</span></div></div>
}
function TrainCard({ title, desc, icon, color, onClick, isDark }: any) {
  return <button onClick={onClick} className={`flex flex-col items-center p-5 rounded-2xl border transition-all active:scale-95 hover:-translate-y-1 hover:shadow-xl group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-750' : 'bg-white border-slate-200 hover:bg-sky-50'}`}><div className={`p-4 rounded-full mb-3 text-white shadow-lg ${color} group-hover:scale-110 transition duration-300`}>{icon}</div><div className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-800'}`}>{title}</div><div className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</div></button>
}