import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import {
  Boxes,
  Wifi,
  WifiOff,
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
    pendingSyncCount,
    isSyncing,
    triggerManualSync,
  } = useInventory();

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 py-2.5 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Brand */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl shadow-inner">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-1.5 leading-tight">
              スマート在庫管理
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                PWA
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              現場優先・オフライン堅牢型システム
            </p>
          </div>
        </div>

        {/* Right: Controls & Status Badges */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Online / Offline Sync Badge */}
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">オンライン</span>
              </span>
            ) : (
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
                title="未同期ログをアップロード"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>未同期 {pendingSyncCount}件</span>
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
            title={settings.soundEnabled ? '音声をミュート' : '音声を有効化'}
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Operator Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-medium">{settings.activeOperator}</span>
          </div>

          {/* Mode Switcher: 現場 ⇄ PC管理 */}
          <button
            onClick={() =>
              updateSettings({
                viewMode: settings.viewMode === 'FIELD' ? 'PC_ADMIN' : 'FIELD',
              })
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
              settings.viewMode === 'FIELD'
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-400/30'
            }`}
          >
            {settings.viewMode === 'FIELD' ? (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span>現場モード</span>
              </>
            ) : (
              <>
                <Monitor className="w-3.5 h-3.5" />
                <span>PC管理</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
