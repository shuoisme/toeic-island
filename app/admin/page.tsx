"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Database, UploadCloud, FileJson, CheckCircle, Trash2 } from 'lucide-react';

// 定義匯入的資料格式 (對應你的資料庫結構)
interface ImportQuestion {
  type: 'listening' | 'reading' | 'vocab';
  question: string;
  question_zh: string;
  options: string[];
  options_zh: string[];
  answer: number;
  explanation: string;
}

export default function AdminPage() {
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'parsing' | 'uploading' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<ImportQuestion[]>([]);
  
  // ★ 管理員密碼設定 (簡易防護)
  const [password, setPassword] = useState('');
  const ADMIN_SECRET = "10221022"; // 你可以改成自己喜歡的密碼

  // 1. 解析 JSON
  const handleParse = () => {
    try {
      setStatus('parsing');
      setLogs([]);
      
      const parsed = JSON.parse(jsonInput);
      
      if (!Array.isArray(parsed)) throw new Error("格式錯誤：必須是陣列 Array [...]");
      if (parsed.length === 0) throw new Error("陣列是空的！");
      
      // 檢查第一題結構
      const first = parsed[0];
      if (!first.question || !first.options || typeof first.answer !== 'number') {
        throw new Error("資料欄位缺漏：請檢查 question, options, answer 是否都有");
      }

      setPreviewData(parsed);
      setLogs(prev => [...prev, `✅ 解析成功！共 ${parsed.length} 題，請確認預覽後上傳。`]);
      setStatus('idle');
    } catch (error: any) {
      setStatus('error');
      setLogs(prev => [...prev, `❌ 解析失敗: ${error.message}`]);
    }
  };

  // 2. 執行上傳
  const handleUpload = async () => {
    if (password !== ADMIN_SECRET) {
      alert("密碼錯誤！");
      return;
    }

    if (!confirm(`確定要匯入 ${previewData.length} 筆題目嗎？`)) return;

    setStatus('uploading');
    let successCount = 0;
    let failCount = 0;

    // 分批上傳 (一次 50 筆，避免塞車)
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < previewData.length; i += BATCH_SIZE) {
      const batch = previewData.slice(i, i + BATCH_SIZE);
      setLogs(prev => [...prev, `🚀 上傳中... 第 ${i + 1} ~ ${i + batch.length} 筆`]);

      const { error } = await supabase.from('questions').insert(batch);

      if (error) {
        console.error(error);
        setLogs(prev => [...prev, `❌ 上傳失敗: ${error.message}`]);
        failCount += batch.length;
      } else {
        successCount += batch.length;
      }
    }

    setLogs(prev => [...prev, `🏁 完成！成功: ${successCount}, 失敗: ${failCount}`]);
    setStatus('success');
    if (successCount > 0) {
      setJsonInput('');
      setPreviewData([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2 text-orange-500">
          <Database /> 多益題庫後台
        </h1>

        {/* 密碼欄 */}
        <div className="mb-6 bg-slate-900 p-4 rounded-xl border border-slate-700 flex gap-4 items-center">
          <label>管理密碼：</label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-1"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 左邊：輸入區 */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileJson /> 1. 貼上 JSON
            </h2>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='[{"type":"reading", "question":"...", ...}]'
              className="w-full h-64 bg-slate-800 text-sm text-slate-300 p-4 rounded-lg border border-slate-600 outline-none"
            />
            <button 
              onClick={handleParse}
              className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-bold w-full"
            >
              解析格式
            </button>
          </div>

          {/* 右邊：執行區 */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 flex flex-col">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <UploadCloud /> 2. 執行匯入
            </h2>
            <div className="flex-1 bg-black/30 rounded-lg p-4 mb-4 overflow-y-auto max-h-64 text-xs text-green-400 whitespace-pre-wrap">
              {logs.length === 0 ? "等待操作..." : logs.join('\n')}
            </div>
            {previewData.length > 0 && (
              <p className="mb-4 text-sm">📊 準備匯入：<span className="text-orange-400 font-bold">{previewData.length}</span> 題</p>
            )}
            <button 
              onClick={handleUpload}
              disabled={previewData.length === 0 || status === 'uploading'}
              className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:text-slate-500 rounded font-bold"
            >
              {status === 'uploading' ? '上傳中...' : '確認寫入資料庫'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}