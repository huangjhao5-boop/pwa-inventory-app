import React from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Header } from './components/common/Header';
import { NavigationTabs } from './components/common/NavigationTabs';
import { ToastContainer } from './components/common/Toast';
import { PWAInstallBanner } from './components/common/PWAInstallBanner';
import { CameraScanner } from './components/scanner/CameraScanner';
import { BatchScanView } from './components/mobile/BatchScanView';
import { ActionBottomSheet } from './components/mobile/ActionBottomSheet';
import { QRGeneratorModal } from './components/scanner/QRGeneratorModal';
import { ItemMasterTable } from './components/pc/ItemMasterTable';
import { PendingApprovalView } from './components/pc/PendingApprovalView';
import { AiTrainingStudio } from './components/pc/AiTrainingStudio';
import { LabelPrinter } from './components/pc/LabelPrinter';
import { TransactionHistory } from './components/pc/TransactionHistory';
import { CheckedOutItemsView } from './components/pc/CheckedOutItemsView';
import { SettingsView } from './components/common/SettingsView';
import { ScanLine, Layers, ListChecks, Inbox } from 'lucide-react';

const MainContent: React.FC = () => {
  const { activeTab, setActiveTab, items, batchScanList, pendingInbounds, settings } = useInventory();
  const isFieldMode = settings.viewMode === 'FIELD';
  const pendingCount = pendingInbounds.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <PWAInstallBanner />
      <Header />
      <NavigationTabs />

      {/* Main View Container */}
      <main className="flex-1 px-3 py-2 sm:px-6 max-w-7xl w-full mx-auto">
        {/* Tab 1: Single Scan View */}
        {activeTab === 'SCAN' && (
          <div className="space-y-4 pb-20 md:pb-6">
            <div className="text-center max-w-md mx-auto space-y-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center justify-center gap-2">
                <ScanLine className="w-5 h-5 text-blue-400" />
                <span>現場カメラ読取（超高速スキャン）</span>
              </h2>
              <p className="text-xs text-slate-400">
                バーコードやQRコードを枠内にかざすと自動で入出庫メニューが開きます
              </p>
            </div>

            <CameraScanner />

            {/* Quick Helper Cards */}
            <div className="max-w-lg mx-auto grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setActiveTab('BATCH')}
                className="p-3.5 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 rounded-2xl flex flex-col items-start gap-1 transition text-left group shadow"
              >
                <div className="flex items-center justify-between w-full">
                  <ListChecks className="w-5 h-5 text-amber-400 group-hover:scale-110 transition" />
                  {batchScanList.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                      {batchScanList.length}件
                    </span>
                  )}
                </div>
                <strong className="text-xs font-bold text-slate-200">連続検品モード</strong>
                <span className="text-[10px] text-slate-500">複数商品を連続で読み取り一括送信</span>
              </button>

              {!isFieldMode ? (
                <button
                  onClick={() => setActiveTab('APPROVAL')}
                  className="p-3.5 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 rounded-2xl flex flex-col items-start gap-1 transition text-left group shadow"
                >
                  <div className="flex items-center justify-between w-full">
                    <Inbox className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition" />
                    {pendingCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
                        {pendingCount}件待機中
                      </span>
                    )}
                  </div>
                  <strong className="text-xs font-bold text-slate-200">入荷承認待ち</strong>
                  <span className="text-[10px] text-slate-500">現場からの入荷申請をPCで確認</span>
                </button>
              ) : (
                <button
                  onClick={() => setActiveTab('ITEMS')}
                  className="p-3.5 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 rounded-2xl flex flex-col items-start gap-1 transition text-left group shadow"
                >
                  <Layers className="w-5 h-5 text-blue-400 group-hover:scale-110 transition" />
                  <strong className="text-xs font-bold text-slate-200">品目在庫検索 ({items.length})</strong>
                  <span className="text-[10px] text-slate-500">ボックス名と現在庫の確認</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Batch Verification List */}
        {activeTab === 'BATCH' && <BatchScanView />}

        {/* Tab: Pending Inbound Approval (PC 端正式入庫審核) */}
        {activeTab === 'APPROVAL' && <PendingApprovalView />}

        {/* Tab 3: Item Master Management */}
        {activeTab === 'ITEMS' && <ItemMasterTable />}

        {/* Tab: Checked-Out & Return Management (現場持出・未返却管理) */}
        {activeTab === 'CHECKOUT' && <CheckedOutItemsView />}

        {/* Tab: AI Training Studio (現場AI学習・対答案スタジオ) */}
        {activeTab === 'AI_STUDIO' && <AiTrainingStudio />}

        {/* Tab 4: Transaction Logs */}
        {activeTab === 'LOGS' && <TransactionHistory />}

        {/* Tab 5: Label Printer */}
        {activeTab === 'PRINT' && <LabelPrinter />}

        {/* Tab 6: Settings */}
        {activeTab === 'SETTINGS' && <SettingsView />}
      </main>

      {/* Global Modals & Sheets */}
      <ActionBottomSheet />
      <QRGeneratorModal />
      <ToastContainer />
    </div>
  );
};

export function App() {
  return (
    <InventoryProvider>
      <MainContent />
    </InventoryProvider>
  );
}

export default App;
