import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { LocalDatabaseService } from '../../services/db';
import { cloudSync, DiagnosticResult } from '../../services/firebase';
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
  KeyRound,
  Stethoscope,
  Activity,
  Sparkles,
  ShieldCheck,
  Code,
  ChevronDown,
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
  const [geminiKeyInput, setGeminiKeyInput] = useState(
    settings.geminiApiKey || 'AQ.Ab8RN6K-0iI-v6dqX7QDe5r00o5iNZH_EVDd812ALgyzZS07Mw'
  );

  // Collapsible Developer Firebase Config
  const [showAdvancedCloud, setShowAdvancedCloud] = useState(false);
  const [firebaseJson, setFirebaseJson] = useState(() => {
    const existing = cloudSync.getConfig();
    return existing ? JSON.stringify(existing, null, 2) : '';
  });
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [showFirebaseHelp, setShowFirebaseHelp] = useState(false);

  // Diagnostic Results
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[] | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  const handleSaveOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorInput.trim()) return;
    updateSettings({ activeOperator: operatorInput.trim() });
    addToast('success', `作業者名を「${operatorInput.trim()}」に更新しました`);
  };

  const handleSaveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ geminiApiKey: geminiKeyInput.trim() });
    addToast('success', geminiKeyInput.trim() ? 'Gemini AI APIキーを保存しました' : 'Gemini AI APIキーを解除しました');
  };

  const handleDebounceChange = (val: number) => {
    setDebounceMs(val);
    updateSettings({ debounceMs: val });
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    setDiagnosticResults(null);
    const { success, results } = await cloudSync.runFullDiagnostics();
    setDiagnosticResults(results);
    setIsRunningDiagnostics(false);
    if (success) {
      addToast('success', 'Firebase クラウド接続・リアルタイム同期テスト完了');
      refreshData();
    } else {
      addToast('error', '診断で問題を検出しました');
    }
  };

  const handleSaveFirebaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseJson.trim()) {
      clearFirebaseConfig();
      return;
    }

    try {
      let parsed = JSON.parse(firebaseJson);
      if (parsed.firebaseConfig) parsed = parsed.firebaseConfig;

      if (!parsed.apiKey || !parsed.projectId) {
        addToast('error', 'apiKey と projectId は必須です');
        return;
      }

      setIsTestingCloud(true);
      const testResult = await cloudSync.runFullDiagnostics();
      setIsTestingCloud(false);

      if (testResult.success) {
        saveFirebaseConfig(parsed);
      } else {
        addToast('error', '接続に失敗しました');
        setDiagnosticResults(testResult.results);
      }
    } catch (err: any) {
      setIsTestingCloud(false);
      addToast('error', `JSON 形式エラー: ${err.message}`);
    }
  };

  const handleResetDemoData = async () => {
    if (window.confirm('初期デモデータ（JIS端子、結束バンド等）を再構築しますか？')) {
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
            システム設定 & 動作環境
          </h2>
          <p className="text-xs text-slate-400">
            担当作業員、AI視覚認識、スキャン設定
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Section 0: System & Author Attribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm sm:text-base text-white">
                スマート在庫管理システム (v2.0)
              </div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">
                システム開発・設計者 (Author): <span className="text-blue-400 font-extrabold text-sm ml-1">k-kaw</span>
              </div>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-400 px-3 py-1 bg-slate-950 rounded-xl border border-slate-800">
            © 2026 k-kaw. All Rights Reserved.
          </span>
        </div>

        {/* Section 1: Operator Setting */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            <span>担当作業員（オペレーター名）設定</span>
          </h3>
          <p className="text-xs text-slate-400">
            入出庫トランザクションログに記録される作業者名です。
          </p>
          <form onSubmit={handleSaveOperator} className="flex gap-2 max-w-md">
            <input
              type="text"
              value={operatorInput}
              onChange={(e) => setOperatorInput(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
              placeholder="例: 現場担当-01 / 山田"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition"
            >
              更新
            </button>
          </form>
        </div>

        {/* Section 2: Gemini AI Vision Setting */}
        <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm sm:text-base text-white">
                ✨ Gemini AI マルチモーダル視覚認識 & 自己学習
              </h3>
            </div>
            <span className="text-xs text-indigo-300 bg-indigo-900/50 px-2.5 py-0.5 rounded-full border border-indigo-700">
              {settings.geminiApiKey ? 'AI 認識有効' : '未設定 (自己学習・OCR併用)'}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Google Gemini API キーを設定すると、撮影した部品や銘板ラベルから品名・型番・メーカーを高精度に自動判定します（ユーザーの修正も自動学習して次回以降の精度が向上します）。
          </p>

          <form onSubmit={handleSaveGeminiKey} className="flex gap-2">
            <input
              type="password"
              value={geminiKeyInput}
              onChange={(e) => setGeminiKeyInput(e.target.value)}
              placeholder="AIzaSy... (Gemini API Key)"
              className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition"
            >
              保存
            </button>
          </form>
        </div>

        {/* Section 3: PC Approval Inbound Toggle */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">
                入荷２段階承認フロー（現場スキャン → PC正式承認）
              </h3>
            </div>
            <input
              type="checkbox"
              checked={settings.requirePcApprovalForInbound}
              onChange={(e) => updateSettings({ requirePcApprovalForInbound: e.target.checked })}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 bg-slate-800 border-slate-700"
            />
          </div>
          <p className="text-xs text-slate-400">
            有効時、現場でのスキャン入荷は「承認待ち」に一時保存され、PC管理画面で正式承認した時点で在庫に反映されます。
          </p>
        </div>

        {/* Section 4: Cloud Status (Safe Clean Indicator) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-sm text-slate-200">
                ☁️ リアルタイム・クラウド同期状態
              </h3>
            </div>
            {isCloudConnected ? (
              <span className="flex items-center gap-1 px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-xs font-bold shadow">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>クラウド同期中 (Connected)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 px-3 py-1 bg-amber-950 text-amber-300 border border-amber-800 rounded-full text-xs font-bold shadow">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>ローカル単機モード (IndexedDB)</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Firebase データベース（`pwa-inventory-app-9c88d`）と自動リアルタイム連携中。PC側で削除・変更された品目は現場端末へ即座に自動反映されます。
          </p>

          {/* Collapsible Advanced Cloud Settings to prevent accidental clicks */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowAdvancedCloud(!showAdvancedCloud)}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 font-semibold transition"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedCloud ? 'rotate-180' : ''}`} />
              <span>{showAdvancedCloud ? '詳細設定を閉じる' : '⚙️ 詳細設定・接続診断（クリックして展開）'}</span>
            </button>

            {showAdvancedCloud && (
              <div className="mt-3 p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Stethoscope className="w-4 h-4 text-emerald-400" />
                    接続ヘルスチェック
                  </span>
                  <button
                    type="button"
                    onClick={handleRunDiagnostics}
                    disabled={isRunningDiagnostics}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-50 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
                    <span>{isRunningDiagnostics ? '診断中...' : '接続診断実行'}</span>
                  </button>
                </div>

                {diagnosticResults && (
                  <div className="space-y-1.5 pt-1">
                    {diagnosticResults.map((res, i) => (
                      <div key={i} className={`p-2 rounded-lg border text-xs ${
                        res.status === 'SUCCESS' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-rose-950/60 border-rose-700 text-rose-200'
                      }`}>
                        <div className="flex justify-between font-bold">
                          <span>{res.step}</span>
                          <span>{res.status === 'SUCCESS' ? '✓ 成功' : '✕ エラー'}</span>
                        </div>
                        <div>{res.message}</div>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSaveFirebaseConfig} className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5" />
                      Firebase Config JSON:
                    </label>
                    <button type="button" onClick={() => setShowFirebaseHelp(!showFirebaseHelp)} className="text-[11px] text-blue-400">
                      {showFirebaseHelp ? '閉じる' : 'ヘルプ'}
                    </button>
                  </div>
                  {showFirebaseHelp && (
                    <p className="text-[11px] text-slate-400 bg-slate-900 p-2 rounded-lg">
                      Firebase Console のプロジェクト設定 → Webアプリ構成（firebaseConfig）を貼り付けて保存します。
                    </p>
                  )}
                  <textarea
                    rows={3}
                    value={firebaseJson}
                    onChange={(e) => setFirebaseJson(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="submit" disabled={isTestingCloud} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow">
                      設定を保存
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Scan Debounce */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <Timer className="w-4 h-4 text-amber-400" />
              <span>重複スキャン防止時間 (Debounce)</span>
            </h3>
            <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-amber-300 font-bold text-xs">
              {(debounceMs / 1000).toFixed(1)} 秒
            </span>
          </div>
          <input
            type="range"
            min="500"
            max="4000"
            step="250"
            value={debounceMs}
            onChange={(e) => handleDebounceChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        {/* Section 6: Feedback Options */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span>音声・振動フィードバック</span>
          </h3>

          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-2xl cursor-pointer">
              <div>
                <div className="font-bold text-xs sm:text-sm text-white">ビープ音通知</div>
                <div className="text-[11px] text-slate-400">読取成功・エラー時のチャイム音</div>
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
                <div className="font-bold text-xs sm:text-sm text-white">バイブレーション</div>
                <div className="text-[11px] text-slate-400">端末振動によるスキャン確認</div>
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

        {/* Section 7: Database Reset */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Database className="w-4 h-4 text-rose-400" />
            <span>データベース初期化</span>
          </h3>
          <button
            onClick={handleResetDemoData}
            className="flex items-center gap-2 px-4 py-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-bold transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>初期サンプルデータにリセット</span>
          </button>
        </div>
      </div>
    </div>
  );
};
