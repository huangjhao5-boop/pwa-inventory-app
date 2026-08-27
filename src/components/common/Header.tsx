import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import {
  Boxes,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  Volume2,
  VolumeX,
  Smartphone,
  Monitor,
  User,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    settings,
    updateSettings,
    isOnline,
    isCloudConnected,
    pendingSyncCount,
    isSyncing,
    triggerManualSync,
    setActiveTab,
  } = useInventory();

  const isFieldMode = settings.viewMode === 'FIELD';

  return (
    <header className={`sticky top-0 z-30 backdrop-blur-md border-b px-3 py-2.5 sm:px-6 transition-colors ${
      isFieldMode
        ? 'bg-slate-900/95 border-blue-900/50'
        : 'bg-slate-950/95 border-indigo-900/50'
    }`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Brand & Mode Title */}
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl border shadow-inner ${
            isFieldMode
              ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
              : 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
          }`}>
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-slate-100 flex items-center gap-1.5 leading-tight">
              スマート在庫管理
              <span className={`text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full border ${
                isFieldMode
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              }`}>
                {isFieldMode ? '📱 現場作業モード' : '💻 PC 管理モード'}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {isFieldMode
                ? '片手高速スキャン・リアルタイム入出庫・バーコードリーダー対応'
                : '品目マスタ管理・A4ラベル一括印刷・CSVインポート/エクスポート'}
            </p>
          </div>
        </div>

        {/* Right: Mode Toggle, Cloud Status & Settings */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cloud Connection Badge */}
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition ${
              isCloudConnected
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60 shadow-sm'
                : 'bg-amber-950/80 text-amber-300 border-amber-700/60 hover:bg-amber-900/60 shadow-sm'
            }`}
            title={isCloudConnected ? 'Firebase クラウド同期中' : 'ローカル単機モード（クリックして設定）'}
          >
            {isCloudConnected ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">🟢 クラウド同期中</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">🟡 ローカルモード</span>
              </>
            )}
          </button>

          {/* Online / Offline Sync Badge */}
          <div className="flex items-center gap-1.5">
            {!isOnline && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60">
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span>オフライン</span>
              </span>
            )}

            {/* Pending Sync Button */}
            {pendingSyncCount > 0 && (
              <button
                onClick={() => triggerManualSync()}
                disabled={isSyncing || !isOnline}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 active:scale-95 transition"
                title="未送信ログの送信"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>同期 {pendingSyncCount}件</span>
              </button>
            )}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            className={`p-1.5 rounded-lg border transition ${
              settings.soundEnabled
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-900/50 text-slate-500 border-slate-800 line-through'
            }`}
            title={settings.soundEnabled ? 'サウンド有効' : 'ミュート'}
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Operator Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-medium">{settings.activeOperator}</span>
          </div>

          {/* Prominent Mode Switcher: 現場 ⇄ PC管理 */}
          <button
            onClick={() => {
              const nextMode = isFieldMode ? 'PC_ADMIN' : 'FIELD';
              updateSettings({ viewMode: nextMode });
              if (nextMode === 'PC_ADMIN') {
                setActiveTab('ITEMS');
              } else {
                setActiveTab('SCAN');
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition shadow-md active:scale-95 ${
              isFieldMode
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-400/40'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/40'
            }`}
          >
            {isFieldMode ? (
              <>
                <Monitor className="w-4 h-4" />
                <span>PC管理画面へ</span>
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4" />
                <span>現場スキャンへ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
