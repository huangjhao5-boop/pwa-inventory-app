import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { LocalDatabaseService } from '../../services/db';
import { cloudSync } from '../../services/firebase';
import {
  SlidersHorizontal,
  Volume2,
  Timer,
  User,
  RotateCcw,
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  KeyRound,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    saveFirebaseConfig,
    clearFirebaseConfig,
    isCloudConnected,
    addToast,
    refreshData,
  } = useInventory();

  const [operatorInput, setOperatorInput] = useState(settings.activeOperator);
  const [debounceMs, setDebounceMs] = useState(settings.debounceMs || 1500);

  // Firebase Config Form
  const [firebaseJson, setFirebaseJson] = useState(() => {
    const existing = cloudSync.getConfig();
    return existing ? JSON.stringify(existing, null, 2) : '';
  });
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [showFirebaseHelp, setShowFirebaseHelp] = useState(false);

  const handleSaveOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorInput.trim()) return;
    updateSettings({ activeOperator: operatorInput.trim() });
    addToast('success', `作業員コードを「${operatorInput.trim()}」に更新しました`);
  };

  const handleDebounceChange = (val: number) => {
    setDebounceMs(val);
    updateSettings({ debounceMs: val });
  };

  const handleSaveFirebaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseJson.trim()) {
      clearFirebaseConfig();
      return;
    }

    try {
      // Parse JSON or raw config object
      let parsed = JSON.parse(firebaseJson);
      // Support nested firebaseConfig if copied directly from console
      if (parsed.firebaseConfig) parsed = parsed.firebaseConfig;

      if (!parsed.apiKey || !parsed.projectId) {
        addToast('error', 'apiKey と projectId は必須です');
        return;
      }

      setIsTestingCloud(true);
      const testResult = await cloudSync.testConnection(parsed);
      setIsTestingCloud(false);

      if (testResult.success) {
        saveFirebaseConfig(parsed);
      } else {
        addToast('error', `接続エラー: ${testResult.message}`);
      }
    } catch (err: any) {
      setIsTestingCloud(false);
      addToast('error', `JSON 形式が正しくありません: ${err.message}`);
    }
  };

  const handleResetDemoData = async () => {
    if (window.confirm('初期デモデータ（ボルト、圧着端子など）を再読み込みしますか？')) {
      const db = await (await import('../../services/db')).getDB();
      const tx = db.transaction(['items', 'logs', 'offline_queue'], 'readwrite');
      await tx.objectStore('items').clear();
      await tx.objectStore('logs').clear();
      await tx.objectStore('offline_queue').clear();
      await tx.done;
      await LocalDatabaseService.initSeedData();
      await refreshData();
      addToast('success', 'デモデータを再初期化しました');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-20 md:pb-8">
      {/* Page Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex items-center gap-3">
        <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl">
          <SlidersHorizontal className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-extrabold text-lg sm:text-xl text-white">
            系統設定與雲端同步 (Settings & Cloud Sync)
          </h2>
          <p className="text-xs text-slate-400">
            Firebase 即時跨裝置資料庫連線、防呆參數與作業員設定
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Section 1: Firebase Cloud Connection */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-sm sm:text-base text-slate-200">
                ☁️ Firebase 雲端資料庫同步設定
              </h3>
            </div>
            {isCloudConnected ? (
              <span className="flex items-center gap-1 px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-xs font-bold shadow">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>雲端同步已連線 (Connected)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 px-3 py-1 bg-amber-950 text-amber-300 border border-amber-800 rounded-full text-xs font-bold shadow">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>本地單機模式 (IndexedDB)</span>
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            設定 Firebase 之後，手機掃描的庫存增減、PC端的品目修改將會**即時同步**到所有設備！未連線時會自動切換為離線模式。
          </p>

          <form onSubmit={handleSaveFirebaseConfig} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                  <span>貼上 Firebase Config JSON:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowFirebaseHelp(!showFirebaseHelp)}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showFirebaseHelp ? '收起說明' : '如何取得 Firebase 設定？'}</span>
                </button>
              </div>

              {showFirebaseHelp && (
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1.5 mb-2 leading-relaxed">
                  <p className="font-bold text-amber-400">💡 30秒取得 Firebase 設定教學：</p>
                  <p>1. 前往 <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">Firebase Console</a> 建立或開啟專案。</p>
                  <p>2. 點擊「專案設定 (Project settings)」 → 點擊下方「新增 Web 應用程式 (網頁應用)」圖示。</p>
                  <p>3. 複製 const firebaseConfig 裡的大括號內容貼在此處即可！</p>
                </div>
              )}

              <textarea
                rows={5}
                value={firebaseJson}
                onChange={(e) => setFirebaseJson(e.target.value)}
                placeholder={`{\n  "apiKey": "AIzaSy...",\n  "authDomain": "your-app.firebaseapp.com",\n  "projectId": "your-app-id",\n  "storageBucket": "your-app.appspot.com"\n}`}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs font-mono text-white focus:outline-none focus:border-blue-500 placeholder-slate-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end">
              {isCloudConnected && (
                <button
                  type="button"
                  onClick={() => {
                    clearFirebaseConfig();
                    setFirebaseJson('');
                  }}
                  className="px-3.5 py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold transition"
                >
                  解除雲端連線
                </button>
              )}

              <button
                type="submit"
                disabled={isTestingCloud}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-blue-950 transition flex items-center gap-1.5"
              >
                <Cloud className="w-4 h-4" />
                <span>{isTestingCloud ? '連線測試中...' : '儲存並啟用雲端同步'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Section 2: Operator Setting */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            <span>担当作業員（オペレーターID）設定</span>
          </h3>
          <p className="text-xs text-slate-400">
            入出庫トランザクションに記録される作業員名・コードです（名札バーコードをスキャンしても瞬時切替可能）。
          </p>
          <form onSubmit={handleSaveOperator} className="flex gap-2 max-w-md">
            <input
              type="text"
              value={operatorInput}
              onChange={(e) => setOperatorInput(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
              placeholder="例: OP-現場01 / 山田"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition"
            >
              更新
            </button>
          </form>
        </div>

        {/* Section 3: Scan Poka-Yoke Debounce */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <Timer className="w-4 h-4 text-amber-400" />
              <span>重複スキャン防止 (Debounce 防重刷)</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-amber-300 font-bold text-xs">
              {(debounceMs / 1000).toFixed(1)} 秒
            </span>
          </div>
          <p className="text-xs text-slate-400">
            同一バーコードが連続で誤認識されるのを防ぐためのロック時間です（推奨: 1.5秒）。
          </p>
          <input
            type="range"
            min="500"
            max="4000"
            step="250"
            value={debounceMs}
            onChange={(e) => handleDebounceChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.5秒 (高速)</span>
            <span>1.5秒 (標準)</span>
            <span>4.0秒 (慎重)</span>
          </div>
        </div>

        {/* Section 4: Feedback Options */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>触覚・音響フィードバック</span>
          </h3>

          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-2xl cursor-pointer">
              <div>
                <div className="font-bold text-xs sm:text-sm text-white">Web Audio ビープ音</div>
                <div className="text-[11px] text-slate-400">成功時の高音チャイム / エラー時の低音アラート</div>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-2xl cursor-pointer">
              <div>
                <div className="font-bold text-xs sm:text-sm text-white">スマホ振動 (Haptic)</div>
                <div className="text-[11px] text-slate-400">端末のバイブレーション機能との連動</div>
              </div>
              <input
                type="checkbox"
                checked={settings.vibrationEnabled}
                onChange={(e) => updateSettings({ vibrationEnabled: e.target.checked })}
                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700"
              />
            </label>
          </div>
        </div>

        {/* Section 5: Database & Reset */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Database className="w-4 h-4 text-rose-400" />
            <span>データベース初期化</span>
          </h3>
          <p className="text-xs text-slate-400">
            テスト用データをクリアし、JIS規格部品等の初期サンプルマスターを再構築します。
          </p>
          <button
            onClick={handleResetDemoData}
            className="flex items-center gap-2 px-4 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-bold transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>初期サンプルデータに戻す</span>
          </button>
        </div>
      </div>
    </div>
  );
};
