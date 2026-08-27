import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { TabKey } from '../../types/inventory';
import {
  ScanLine,
  ListChecks,
  Layers,
  History,
  Printer,
  Settings,
  Search,
  Inbox,
} from 'lucide-react';

export const NavigationTabs: React.FC = () => {
  const { activeTab, setActiveTab, batchScanList, pendingInbounds, settings } = useInventory();
  const isFieldMode = settings.viewMode === 'FIELD';

  const pendingCount = pendingInbounds.filter((p) => p.status === 'PENDING').length;

  // 現場模式精簡選單
  const fieldTabs: { key: TabKey; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { key: 'SCAN', label: '📷 即時掃描', icon: ScanLine },
    { key: 'BATCH', label: '📋 批次核對', icon: ListChecks, badge: batchScanList.length },
    { key: 'ITEMS', label: '🔍 快速查庫存', icon: Search },
    { key: 'SETTINGS', label: '⚙️ 系統設定', icon: Settings },
  ];

  // PC 管理模式完整選單 (包含待審核入庫)
  const adminTabs: { key: TabKey; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { key: 'APPROVAL', label: '📥 待審核入庫', icon: Inbox, badge: pendingCount },
    { key: 'ITEMS', label: '📦 品目主檔管理', icon: Layers },
    { key: 'PRINT', label: '🖨️ A4 標籤列印', icon: Printer },
    { key: 'LOGS', label: '📜 出入庫歷史記錄', icon: History },
    { key: 'SCAN', label: '📷 掃描驗收', icon: ScanLine },
    { key: 'BATCH', label: '📋 批次檢品', icon: ListChecks, badge: batchScanList.length },
    { key: 'SETTINGS', label: '☁️ 雲端與參數設定', icon: Settings },
  ];

  const currentTabs = isFieldMode ? fieldTabs : adminTabs;

  return (
    <>
      {/* Desktop / Tablet Top Tabs */}
      <nav className="hidden md:block bg-slate-900/60 border-b border-slate-800 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-black transition ${
                    isActive
                      ? isFieldMode
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-950'
                        : 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-400 text-slate-950 animate-pulse">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            {isFieldMode ? '🎯 現場極速模式啟用中' : '🖥️ PC 管理總覽啟用中'}
          </div>
        </div>
      </nav>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl">
        {currentTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition ${
                isActive
                  ? isFieldMode
                    ? 'text-blue-400 font-black'
                    : 'text-indigo-400 font-black'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-slate-950">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{tab.label.replace(/^[^\s]+\s/, '')}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
