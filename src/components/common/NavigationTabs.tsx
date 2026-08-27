import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { TabKey } from '../../types/inventory';
import {
  ScanLine,
  ListChecks,
  Package,
  History,
  Printer,
  SlidersHorizontal,
} from 'lucide-react';

export const NavigationTabs: React.FC = () => {
  const { activeTab, setActiveTab, batchScanList } = useInventory();

  const tabs: { key: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: 'SCAN', label: 'スキャン', icon: ScanLine },
    { key: 'BATCH', label: '批次検品', icon: ListChecks },
    { key: 'ITEMS', label: '品目マスター', icon: Package },
    { key: 'LOGS', label: '入出庫履歴', icon: History },
    { key: 'PRINT', label: 'ラベル印刷', icon: Printer },
    { key: 'SETTINGS', label: '設定', icon: SlidersHorizontal },
  ];

  return (
    <>
      {/* Desktop / Tablet Navigation Bar */}
      <nav className="hidden md:flex items-center justify-center gap-1.5 p-2 max-w-5xl mx-auto my-3 bg-slate-900/60 backdrop-blur rounded-2xl border border-slate-800/80 shadow-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.key === 'BATCH' && batchScanList.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                  {batchScanList.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile Bottom Navigation Bar (Fixed bottom for single-hand reach) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/90 pb-safe px-1 py-1.5 flex items-center justify-around shadow-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl relative transition-all active:scale-90 ${
                isActive
                  ? 'text-blue-400 font-bold'
                  : 'text-slate-400 hover:text-slate-300 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {tab.key === 'BATCH' && batchScanList.length > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1 rounded-full text-[9px] font-extrabold bg-amber-500 text-slate-950 min-w-[15px] text-center">
                    {batchScanList.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
