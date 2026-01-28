"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Battery, BrickWall, Cpu, Hammer, BookOpen, Headphones, GraduationCap, X, CheckCircle, XCircle, Volume2, MapPin, Zap, Cloud, Waves } from 'lucide-react';

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
  isOptimistic?: boolean; // 標記是否為剛蓋好的 (用於動畫)
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

// --- 2. 建築外觀與特效設定 (對應資料庫的新清單) ---
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

// 預設外觀 (防呆用)
const DEFAULT_ASSET = { emoji: '📦', color: 'from-gray-400 to-gray-600', scale: 'scale-100' };

export default function Home() {
  const [team, setTeam] = useState<Team | null>(null);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [myBuildings, setMyBuildings] = useState<BuiltBuilding[]>([]);
  
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- 初始化資料與即時監聽 ---
  useEffect(() => {
    async function initData() {
      // 1. 抓團隊
      const { data: teamData } = await supabase.from('teams').select('*').limit(1).single();
      if (teamData) setTeam(teamData as Team);

      // 2. 抓商店圖鑑 (依照價格排序)
      const { data: bpData } = await supabase.from('building_blueprints').select('*').order('cost_bricks', { ascending: true });
      if (bpData) setBlueprints(bpData as Blueprint[]);

      // 3. 抓已蓋建築
      if (teamData) {
        const { data: builtData } = await supabase
          .from('team_buildings')
          .select(`*, blueprint:building_blueprints(*)`)
          .eq('team_id', teamData.id)
          .order('built_at', { ascending: true }); // 舊的在後面(視覺層次感)
        if (builtData) setMyBuildings(builtData as any);
      }
    }
    initData();

    // 4. 開啟 Realtime 監聽 (資源變動自動更新)
    const channel = supabase.channel('team_update')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams' }, (payload) => {
        setTeam(payload.new as Team);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // --- 功能：文字轉語音 ---
  const speakText = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // --- 功能：開始訓練 (從資料庫隨機抓題) ---
  const startTraining = async (type: 'listening' | 'reading' | 'vocab') => {
    setLoading(true);
    // 從 Supabase 抓取該類型的題目
    const { data, error } = await supabase.from('questions').select('*').eq('type', type);

    if (error || !data || data.length === 0) {
      alert("題庫讀取失敗或是還沒有該類型的題目！請先去後台 ( /admin ) 匯入。");
      setLoading(false);
      return;
    }

    // 隨機選一題
    const randomQ = data[Math.floor(Math.random() * data.length)] as Question;
    
    setSelectedOption(null);
    setShowResult(false);
    setActiveQuestion(randomQ);
    setLoading(false);

    // 聽力題自動播放
    if (type === 'listening') {
      setTimeout(() => speakText(randomQ.question), 500);
    }
  };

  // --- 功能：送出答案 ---
  const submitAnswer = async () => {
    if (!team || !activeQuestion || selectedOption === null) return;
    
    setShowResult(true);

    if (selectedOption === activeQuestion.answer) {
      // 計算獎勵
      let reward = { elec: 0, brick: 0, chip: 0 };
      if (activeQuestion.type === 'listening') reward.elec = 20;
      if (activeQuestion.type === 'reading') reward.brick = 20;
      if (activeQuestion.type === 'vocab') reward.chip = 20;

      // 樂觀更新 (UI 先動)
      const newTeam = {
        ...team,
        res_electricity: team.res_electricity + reward.elec,
        res_bricks: team.res_bricks + reward.brick,
        res_chips: team.res_chips + reward.chip,
      };
      setTeam(newTeam);
      
      // 背景同步資料庫
      await supabase.from('teams').update({
        res_electricity: newTeam.res_electricity,
        res_bricks: newTeam.res_bricks,
        res_chips: newTeam.res_chips,
      }).eq('id', team.id);
    }
  };

  // --- 功能：建造建築 (樂觀更新 + 動畫) ---
  const handleBuild = async (bp: Blueprint) => {
    if (!team) return;

    // 1. 檢查資源
    if (team.res_electricity < bp.cost_electricity || team.res_bricks < bp.cost_bricks || team.res_chips < bp.cost_chips) {
      alert("資源不足！快去訓練中心答題賺資源！");
      return;
    }

    if (!confirm(`確定要建造「${bp.name}」嗎？`)) return;
    setLoading(true);

    // 2. 扣除資源 (UI 先動)
    const newTeamState = {
      ...team,
      res_electricity: team.res_electricity - bp.cost_electricity,
      res_bricks: team.res_bricks - bp.cost_bricks,
      res_chips: team.res_chips - bp.cost_chips,
    };
    setTeam(newTeamState);

    // 3. 蓋房子 (UI 先動，加入 isOptimistic 標記以觸發彈跳動畫)
    const optimisticBuilding: any = {
      id: 'temp-' + Date.now(),
      blueprint_id: bp.id,
      built_at: new Date().toISOString(),
      blueprint: bp,
      isOptimistic: true 
    };
    setMyBuildings([...myBuildings, optimisticBuilding]);

    try {
      // 4. 背景同步
      // 同步資源
      await supabase.from('teams').update({
        res_electricity: newTeamState.res_electricity,
        res_bricks: newTeamState.res_bricks,
        res_chips: newTeamState.res_chips,
      }).eq('id', team.id);

      // 寫入建築紀錄
      await supabase.from('team_buildings').insert({
        team_id: team.id,
        blueprint_id: bp.id
      });
    } catch (error) {
      console.error(error);
      window.location.reload(); // 失敗則重整頁面回朔
    } finally {
      setLoading(false);
    }
  };

  // 讀取畫面
  if (!team) return <div className="min-h-screen bg-sky-900 flex items-center justify-center text-white animate-pulse text-xl">🌊 正在前往多益島...</div>;

  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden">
      
      {/* === 1. 島嶼場景區 (Hero Scene) === */}
      <section className="relative w-full h-[60vh] min-h-[500px] bg-gradient-to-b from-sky-400 to-sky-800 overflow-hidden flex flex-col items-center justify-center">
        
        {/* 背景裝飾：漂浮雲朵 */}
        <div className="absolute top-10 left-10 text-white/40 animate-float" style={{animationDuration: '6s'}}><Cloud size={64} fill="white"/></div>
        <div className="absolute top-20 right-20 text-white/30 animate-float" style={{animationDuration: '8s'}}><Cloud size={48} fill="white"/></div>
        <div className="absolute top-40 left-1/4 text-white/20 animate-float" style={{animationDuration: '10s'}}><Cloud size={32} fill="white"/></div>

        {/* 頂部資訊列 (漂浮在空中) */}
        <div className="absolute top-6 z-20 flex flex-col items-center gap-2 w-full px-4">
           {/* 隊伍名稱與等級 */}
           <h1 className="text-2xl font-bold flex items-center gap-2 text-white drop-shadow-md bg-black/20 px-4 py-1 rounded-full backdrop-blur-sm">
             <MapPin className="text-yellow-300"/> {team.name} <span className="text-xs bg-yellow-500 text-yellow-900 px-2 rounded-full font-bold">Lv.{myBuildings.length + 1}</span>
           </h1>
           
           {/* 資源顯示膠囊 */}
           <div className="flex gap-2 bg-white/90 text-slate-900 p-2 rounded-2xl shadow-xl border-2 border-white/50">
             <ResourcePill icon={<Battery size={16} className="text-yellow-600"/>} value={team.res_electricity} label="電力"/>
             <ResourcePill icon={<BrickWall size={16} className="text-red-600"/>} value={team.res_bricks} label="磚塊"/>
             <ResourcePill icon={<Cpu size={16} className="text-blue-600"/>} value={team.res_chips} label="晶片"/>
           </div>
        </div>

        {/* === 島嶼本體 (The Island) === */}
        <div className="relative z-10 w-[90vw] max-w-3xl h-[300px] mt-20">
          {/* 土地 (Ground) - 綠色橢圓 */}
          <div className="absolute inset-0 bg-[#4ade80] rounded-[50%] border-b-[20px] border-[#15803d] shadow-2xl transform rotate-1 scale-y-90"></div>
          {/* 沙灘邊緣 - 黃色橢圓 */}
          <div className="absolute -inset-2 bg-[#fde047] rounded-[50%] -z-10 transform scale-y-90"></div>

          {/* 建築物放置區 */}
          <div className="absolute inset-0 flex flex-wrap justify-center items-center content-center gap-2 sm:gap-4 p-8 md:p-16">
            {myBuildings.length === 0 ? (
               <div className="text-green-800 font-bold opacity-50 animate-pulse text-center">
                 這裡還是一片空地...<br/>快去蓋第一棟建築吧！
               </div>
            ) : (
              myBuildings.map((b, idx) => {
                const asset = BUILDING_ASSETS[b.blueprint?.name || ''] || DEFAULT_ASSET;
                const isNew = b.isOptimistic;
                
                return (
                  <div key={b.id} 
                       className={`flex flex-col items-center transition-all duration-500 group ${isNew ? 'animate-bounce-in' : 'hover:-translate-y-2'}`}
                       style={{ zIndex: 10 + idx }} // 讓後面的建築稍微蓋住前面的，更有層次
                  >
                    {/* 建築 Emoji */}
                    <div className={`text-[3.5rem] md:text-[5rem] drop-shadow-2xl filter ${asset.scale} relative cursor-help`}>
                      {asset.emoji}
                      {/* 建築底下的陰影 */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-4 bg-black/20 rounded-full blur-sm -z-10"></div>
                      
                      {/* 懸停顯示名稱 Tooltip */}
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

        {/* 海洋波浪裝飾 (底部動畫) */}
        <div className="absolute bottom-0 w-full overflow-hidden">
           <Waves className="text-white/20 w-full h-32 scale-y-50 animate-float" />
        </div>
      </section>

      {/* === 2. 下方操作面板區 === */}
      <div className="max-w-5xl mx-auto px-4 -mt-10 relative z-20 pb-20">
        <div className="bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl p-6 md:p-8">
          
          {/* 區域 A: 訓練中心 */}
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-300">
              <BookOpen className="text-purple-400"/> 資源採集 (答題)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TrainCard title="聽力" desc="獲得電力 ⚡" icon={<Headphones size={32}/>} color="bg-yellow-500" onClick={() => startTraining('listening')} />
              <TrainCard title="閱讀" desc="獲得磚塊 🧱" icon={<BookOpen size={32}/>} color="bg-red-500" onClick={() => startTraining('reading')} />
              <TrainCard title="單字" desc="獲得晶片 💾" icon={<GraduationCap size={32}/>} color="bg-blue-500" onClick={() => startTraining('vocab')} />
            </div>
          </section>

          {/* 區域 B: 建築商店 (更新為多欄位 + 捲動設計) */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-orange-300">
              <Hammer className="text-orange-400"/> 建設島嶼 (商店)
            </h2>
            
            {/* 商店列表容器：RWD 網格 + 垂直捲動 */}
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
                        ? 'bg-slate-800 border-slate-700 hover:border-orange-500 hover:bg-slate-750 hover:shadow-lg hover:-translate-y-1' 
                        : 'bg-slate-900/50 border-slate-800 opacity-50 cursor-not-allowed grayscale-[0.5]'
                    }`}
                  >
                    {/* 上半部：圖示與名稱 */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-4xl bg-slate-900 p-3 rounded-xl border border-slate-700 shadow-inner group-hover:scale-110 transition">{asset.emoji}</div>
                      {canAfford && <span className="text-[10px] font-bold bg-orange-500 text-white px-2 py-1 rounded-full animate-pulse">可建造</span>}
                    </div>
                    
                    {/* 中間：名稱與描述 */}
                    <div className="mb-3">
                      <h3 className="font-bold text-lg text-slate-200">{bp.name}</h3>
                      <p className="text-xs text-slate-500 line-clamp-1">{bp.description}</p>
                    </div>

                    {/* 下半部：造價 */}
                    <div className="mt-auto flex flex-wrap gap-2 text-xs font-mono border-t border-slate-700/50 pt-2">
                       <span className={team.res_electricity >= bp.cost_electricity ? 'text-yellow-400' : 'text-red-400'}>⚡{bp.cost_electricity}</span>
                       <span className={team.res_bricks >= bp.cost_bricks ? 'text-red-400' : 'text-red-600'}>🧱{bp.cost_bricks}</span>
                       <span className={team.res_chips >= bp.cost_chips ? 'text-blue-400' : 'text-red-400'}>💾{bp.cost_chips}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* === 3. 答題 Modal (彈出視窗) === */}
      {activeQuestion && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-slate-800 w-full max-w-lg rounded-3xl border border-slate-700 shadow-2xl p-6 relative animate-in fade-in zoom-in max-h-[90vh] overflow-y-auto">
            
            {/* 關閉按鈕 */}
            <button onClick={() => { setActiveQuestion(null); window.speechSynthesis.cancel(); }} className="absolute top-4 right-4 text-slate-400 p-2 hover:bg-slate-700 rounded-full transition">
              <X size={20} />
            </button>
            
            {/* 題目類型標籤 */}
            <div className="mb-6">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                activeQuestion.type === 'listening' ? 'bg-yellow-500/20 text-yellow-300' : 
                activeQuestion.type === 'reading' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
              }`}>
                {activeQuestion.type.toUpperCase()}
              </span>
            </div>
            
            {/* 題目內容 */}
            <div className="mb-8">
              {activeQuestion.type === 'listening' ? (
                <div className="text-center bg-slate-900/50 p-6 rounded-2xl border border-slate-700">
                   <button onClick={() => speakText(activeQuestion.question)} className="bg-yellow-500 text-white p-6 rounded-full shadow-lg hover:scale-105 transition mb-4 animate-bounce-in">
                     <Volume2 size={40}/>
                   </button>
                   <p className="text-slate-400 text-sm font-bold">點擊播放</p>
                   {/* 答題後顯示聽力稿 */}
                   {showResult && (
                     <div className="mt-4 text-left border-t border-slate-600 pt-4 animate-in fade-in">
                       <p className="font-bold mb-1">{activeQuestion.question}</p>
                       <p className="text-sm text-slate-400">{activeQuestion.question_zh}</p>
                     </div>
                   )}
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-bold mb-2 leading-relaxed whitespace-pre-wrap">{activeQuestion.question}</h3>
                  {showResult && <p className="text-sm text-slate-400 animate-in fade-in">{activeQuestion.question_zh}</p>}
                </div>
              )}
            </div>

            {/* 選項列表 */}
            <div className="space-y-3 mb-6">
              {activeQuestion.options.map((opt, idx) => {
                const isSel = selectedOption === idx; 
                const isCor = idx === activeQuestion.answer;
                let style = "border-slate-700 bg-slate-800 hover:bg-slate-700";
                
                if (showResult) {
                  // 公布答案後的樣式
                  if (isCor) style = "border-green-500 bg-green-500/20 text-green-200";
                  else if (isSel) style = "border-red-500 bg-red-500/20 text-red-200";
                  else style = "opacity-50 grayscale border-slate-800";
                } else if (isSel) {
                  // 選中時的樣式
                  style = "border-orange-500 bg-orange-500/20 text-orange-200";
                }

                return (
                  <button key={idx} disabled={showResult} onClick={() => setSelectedOption(idx)} className={`w-full p-4 rounded-xl border-2 text-left transition-all ${style}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold"><span className="mr-3 opacity-50">{String.fromCharCode(65+idx)}.</span>{opt}</span>
                      {showResult && isCor && <CheckCircle className="text-green-500" size={20}/>}
                      {showResult && isSel && !isCor && <XCircle className="text-red-500" size={20}/>}
                    </div>
                    {showResult && <div className="text-xs mt-1 ml-6 opacity-70">{activeQuestion.options_zh[idx]}</div>}
                  </button>
                )
              })}
            </div>

            {/* 送出按鈕 / 結果解析 */}
            {!showResult ? (
              <button onClick={submitAnswer} disabled={selectedOption === null} className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 disabled:opacity-50 transition shadow-lg">
                送出答案
              </button>
            ) : (
              <div className="animate-in slide-in-from-bottom-2">
                <div className="bg-slate-900 p-4 rounded-xl mb-4 text-sm text-slate-300 border border-slate-700 shadow-inner">
                  <span className="font-bold text-white block mb-1">💡 解析：</span>
                  {activeQuestion.explanation}
                </div>
                <button 
                  onClick={() => { setActiveQuestion(null); window.speechSynthesis.cancel(); }} 
                  className={`w-full py-3 font-bold rounded-xl text-white shadow-lg transition hover:scale-[1.02] ${selectedOption === activeQuestion.answer ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gradient-to-r from-orange-500 to-red-600'}`}
                >
                  {selectedOption === activeQuestion.answer ? "🎉 答對了！領取獎勵" : "💪 下一題會更好"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// --- 4. 小元件 (Components) ---

// 頂部資源膠囊
function ResourcePill({ icon, value, label }: any) {
  return (
    <div className="flex items-center gap-1.5 px-1">
      <div className="p-1.5 bg-slate-100 rounded-full shadow-sm">{icon}</div>
      <div className="flex flex-col leading-none">
        <span className="font-bold text-sm text-slate-800">{value}</span>
        <span className="text-[10px] text-slate-500 font-bold">{label}</span>
      </div>
    </div>
  );
}

// 訓練按鈕卡片
function TrainCard({ title, desc, icon, color, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center p-5 rounded-2xl bg-slate-800 border border-slate-700 hover:bg-slate-750 transition-all active:scale-95 hover:-translate-y-1 hover:shadow-xl group">
      <div className={`p-4 rounded-full mb-3 text-white shadow-lg ${color} group-hover:scale-110 transition duration-300`}>{icon}</div>
      <div className="font-bold text-lg text-white">{title}</div>
      <div className="text-xs text-slate-400 font-mono">{desc}</div>
    </button>
  );
}