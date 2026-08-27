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
  HelpCircle,
  KeyRound,
  Stethoscope,
  Activity,
  Sparkles,
  ShieldCheck,
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
  const [geminiKeyInput, setGeminiKeyInput] = useState(settings.geminiApiKey || '');

  // Firebase Config Form
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
      addToast('success', 'Firebase クラウド接続・読み書きテストが完了しました');
      refreshData();
    } else {
      addToast('error', '診断で問題を検出しました。詳細をご確認ください');
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
        addToast('error', '接続に失敗しました。診断結果をご確認ください');
        setDiagnosticResults(testResult.results);
      }
    } catch (err: any) {
      setIsTestingCloud(false);
      addToast('error', `JSON 形式エラー: ${err.message}`);
    }
  };

  const handleResetDemoData = async () => {
    if (window.confirm('初期デモデータ（端子、結束バンド、ヒューズ等）を再読み込みしますか？')) {
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
            システム設定 & クラウド・AI診断
          </h2>
          <p className="text-xs text-slate-400">
            Firebase リアルタイム同期、Gemini AI 視覚認識、スキャン設定
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Section 0: Gemini AI Vision Setting */}
        <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm sm:text-base text-white">
                ✨ Gemini AI マルチモーダル視覚認識
              </h3>
            </div>
            <span className="text-xs text-indigo-300 bg-indigo-900/50 px-2.5 py-0.5 rounded-full border border-indigo-700">
              {settings.geminiApiKey ? 'AI 認識有効' : '未設定 (OCRフォールバック)'}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Google Gemini API キーを設定すると、部品写真・銘板ラベル・端子パックを撮影した際に、AIが品名・メーカー・規格型番・数量を高精度に自動認識して入力します。
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

        {/* Section 1: PC Approval Inbound Toggle */}
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
            有効時、現場でのスキャン入荷は「承認待ち」に一時保存され、PC側で正式承認した時点で在庫に反映されます。
          </p>
        </div>

        {/* Section 2: Firebase Cloud Connection & Diagnostics */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-sm sm:text-base text-slate-200">
                ☁️ Firebase クラウドデータベース接続
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
            Firebase プロジェクト（`pwa-inventory-app-9c88d`）が設定されています。接続状態を確認する場合は「🔍 接続・権限のヘルスチェック」を実行してください。
          </p>

          {/* Quick Diagnostics Action */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs sm:text-sm text-slate-200">
                  リアルタイム接続診断 (Diagnostics)
                </span>
              </div>
              <button
                type="button"
                onClick={handleRunDiagnostics}
                disabled={isRunningDiagnostics}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5"
              >
                <Activity className={`w-3.5 h-3.5 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
                <span>{isRunningDiagnostics ? '診断中...' : '🔍 接続・権限のヘルスチェック'}</span>
              </button>
            </div>

            {/* Diagnostic Output Results */}
            {diagnosticResults && (
              <div className="pt-2 border-t border-slate-800 space-y-2 animate-in fade-in">
                {diagnosticResults.map((res, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1 ${
                      res.status === 'SUCCESS'
                        ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                        : 'bg-rose-950/60 border-rose-700 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{res.step}</span>
                      <span>{res.status === 'SUCCESS' ? '✓ 成功' : '✕ エラー'}</span>
                    </div>
                    <div>{res.message}</div>
                    {res.details && (
                      <div className="mt-1 p-2 bg-black/60 rounded-lg text-amber-300 font-semibold leading-relaxed border border-amber-500/30">
                        👉 推奨対応: {res.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSaveFirebaseConfig} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                  <span>Firebase Config JSON 設定:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowFirebaseHelp(!showFirebaseHelp)}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showFirebaseHelp ? '閉じる' : '設定方法ヘルプ'}</span>
                </button>
              </div>

              {showFirebaseHelp && (
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1.5 mb-2 leading-relaxed">
                  <p className="font-bold text-amber-400">💡 Firebase 設定取得手順：</p>
                  <p>1. <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">Firebase Console</a> でプロジェクトを開きます。</p>
                  <p>2. 「プロジェクト設定」→「ウェブアプリ」の構成コード（firebaseConfig）をコピーして貼り付けます。</p>
                </div>
              )}

              <textarea
                rows={4}
                value={firebaseJson}
                onChange={(e) => setFirebaseJson(e.target.value)}
                placeholder={`{\n  "apiKey": "AIzaSy...",\n  "projectId": "pwa-inventory-app-9c88d"\n}`}
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
                  単機モードに切り替え
                </button>
              )}

              <button
                type="submit"
                disabled={isTestingCloud}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-blue-950 transition flex items-center gap-1.5"
              >
                <Cloud className="w-4 h-4" />
                <span>{isTestingCloud ? '接続テスト中...' : '設定を保存'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Section 3: Operator Setting */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            <span>担当作業員（オペレーターID）設定</span>
          </h3>
          <p className="text-xs text-slate-400">
            入出庫トランザクションに記録される作業者名です。
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

        {/* Section 4: Scan Debounce */}
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
          <p className="text-xs text-slate-400">
            同一バーコードの連続誤認識を防ぐロック時間です（推奨: 1.5秒）。
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

        {/* Section 5: Feedback Options */}
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

        {/* Section 6: Database Reset */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Database className="w-4 h-4 text-rose-400" />
            <span>データベース初期化</span>
          </h3>
          <p className="text-xs text-slate-400">
            テストデータをクリアし、JIS規格電気パーツ等の初期サンプルマスターを再構築します。
          </p>
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
