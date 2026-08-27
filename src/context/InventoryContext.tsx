import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  ItemMaster,
  InventoryLog,
  ActionType,
  AppSettings,
  BatchScanItem,
  TabKey,
  PendingInbound,
} from '../types/inventory';
import { LocalDatabaseService } from '../services/db';
import { useNetworkSync } from '../hooks/useNetworkSync';
import { cloudSync, FirebaseConfigOptions } from '../services/firebase';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
  message?: string;
}

export interface InventoryContextType {
  // State
  items: ItemMaster[];
  logs: InventoryLog[];
  pendingInbounds: PendingInbound[];
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  toasts: ToastMessage[];
  addToast: (type: 'success' | 'error' | 'info' | 'warning', text: string) => void;
  removeToast: (id: string) => void;

  // Network & Sync
  isOnline: boolean;
  isCloudConnected: boolean;
  setIsCloudConnected: (connected: boolean) => void;
  pendingSyncCount: number;
  pendingCount: number;
  isSyncing: boolean;
  triggerManualSync: () => Promise<void>;
  triggerSync: () => Promise<void>;
  saveFirebaseConfig: (config: FirebaseConfigOptions) => void;
  clearFirebaseConfig: () => void;

  // Mobile BottomSheet Actions
  isBottomSheetOpen: boolean;
  activeScannedItem: ItemMaster | null;
  activeScannedCode: string | null;
  openBottomSheet: (code: string) => Promise<void>;
  closeBottomSheet: () => void;

  // Batch Scan Mode
  batchScanList: BatchScanItem[];
  addToBatch: (item: ItemMaster, actionType: 'IN' | 'OUT', unit: string, multiplier: number, quantity: number) => void;
  updateBatchItemQty: (id: string, newQty: number) => void;
  updateBatchItem: (id: string, updates: Partial<BatchScanItem>) => void;
  removeFromBatch: (id: string) => void;
  removeBatchItem: (id: string) => void;
  clearBatch: () => void;
  clearBatchList: () => void;
  commitBatch: () => Promise<void>;
  commitBatchList: () => Promise<boolean>;

  // Transactions & Master CRUD
  recordTransaction: (
    item: ItemMaster,
    type: ActionType,
    quantity: number,
    unit: string,
    multiplier: number,
    note?: string,
    isPendingApproval?: boolean
  ) => Promise<boolean>;
  saveItem: (item: ItemMaster) => Promise<void>;
  importItems: (items: ItemMaster[]) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;

  // Pending Inbound Approvals (PC 端正式入庫)
  approvePendingInbound: (pending: PendingInbound) => Promise<void>;
  batchApprovePendingInbounds: (pendings: PendingInbound[]) => Promise<void>;
  rejectPendingInbound: (id: string) => Promise<void>;

  // QR Modal
  isQRModalOpen: boolean;
  isQRGeneratorOpen: boolean;
  qrModalItem: ItemMaster | null;
  qrGeneratorTarget: ItemMaster | null;
  openQRGenerator: (item: ItemMaster) => void;
  closeQRGenerator: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  debounceMs: 1500,
  activeOperator: 'OP-現場01',
  offlineMode: false,
  viewMode: 'FIELD',
  autoTorch: false,
  requirePcApprovalForInbound: true,
};

const InventoryContext = createContext<InventoryContextType | null>(null);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ItemMaster[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [pendingInbounds, setPendingInbounds] = useState<PendingInbound[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('SCAN');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Mobile BottomSheet State
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [activeScannedItem, setActiveScannedItem] = useState<ItemMaster | null>(null);
  const [activeScannedCode, setActiveScannedCode] = useState<string | null>(null);

  // QR Modal State
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrModalItem, setQrModalItem] = useState<ItemMaster | null>(null);

  // Batch Mode List
  const [batchScanList, setBatchScanList] = useState<BatchScanItem[]>([]);

  // Toast Helpers
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, text, message: text }]);
    setTimeout(() => {
      removeToast(id);
    }, 3500);
  }, [removeToast]);

  // Network Sync Hook
  const {
    isOnline,
    pendingCount,
    isSyncing,
    refreshPendingCount,
    triggerSync,
  } = useNetworkSync((count) => {
    addToast('success', `離線資料已自動補傳 ${count} 筆`);
  });

  const [isCloudConnected, setIsCloudConnected] = useState(() => cloudSync.isCloudEnabled());

  // Load Data
  const refreshData = useCallback(async () => {
    try {
      await LocalDatabaseService.initSeedData();
      let [storedItems, storedLogs, storedPendings, savedSettings] = await Promise.all([
        LocalDatabaseService.getAllItems(),
        LocalDatabaseService.getAllLogs(),
        LocalDatabaseService.getAllPendingInbounds(),
        LocalDatabaseService.getSettings(),
      ]);

      if (cloudSync.isCloudEnabled()) {
        const [cloudItems, cloudPendings] = await Promise.all([
          cloudSync.fetchAllCloudItems(),
          cloudSync.fetchAllPendingInbounds(),
        ]);

        if (cloudItems.length > 0) {
          await LocalDatabaseService.saveItemsBatch(cloudItems);
          storedItems = await LocalDatabaseService.getAllItems();
        } else if (storedItems.length > 0) {
          for (const item of storedItems) {
            await cloudSync.syncItemToCloud(item);
          }
        }

        if (cloudPendings.length > 0) {
          await LocalDatabaseService.savePendingInboundsBatch(cloudPendings);
          storedPendings = await LocalDatabaseService.getAllPendingInbounds();
        }
      }

      setItems(storedItems);
      setLogs(storedLogs);
      setPendingInbounds(storedPendings);
      if (savedSettings && Object.keys(savedSettings).length > 0) {
        setSettings((prev) => ({ ...prev, ...savedSettings }));
      }
      setIsCloudConnected(cloudSync.isCloudEnabled());
      await refreshPendingCount();
    } catch (e) {
      console.error('Failed to load inventory data:', e);
    }
  }, [refreshPendingCount]);

  // Realtime Cloud Listener
  useEffect(() => {
    refreshData();

    if (cloudSync.isCloudEnabled()) {
      cloudSync.listenCloudChanges(
        (remoteItem) => {
          setItems((prev) => {
            const idx = prev.findIndex((i) => i.id === remoteItem.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = remoteItem;
              return next;
            }
            return [remoteItem, ...prev];
          });
          LocalDatabaseService.saveItem(remoteItem);
        },
        (remoteLog) => {
          setLogs((prev) => {
            if (prev.some((l) => l.id === remoteLog.id)) return prev;
            return [remoteLog, ...prev];
          });
          LocalDatabaseService.addLog(remoteLog);
        },
        (remotePending, isDeleted) => {
          if (isDeleted) {
            setPendingInbounds((prev) => prev.filter((p) => p.id !== remotePending.id));
            LocalDatabaseService.deletePendingInbound(remotePending.id);
          } else {
            setPendingInbounds((prev) => {
              const idx = prev.findIndex((p) => p.id === remotePending.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = remotePending;
                return next;
              }
              return [remotePending, ...prev];
            });
            LocalDatabaseService.savePendingInbound(remotePending);
          }
        }
      );
    }

    return () => {
      cloudSync.stopListening();
    };
  }, [refreshData]);

  const updateSettings = useCallback(
    async (newSettings: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...newSettings };
        Object.entries(newSettings).forEach(([key, val]) => {
          LocalDatabaseService.saveSetting(key, val);
        });
        return next;
      });
    },
    []
  );

  const saveFirebaseConfig = useCallback(
    (config: FirebaseConfigOptions) => {
      const ok = cloudSync.saveConfig(config);
      setIsCloudConnected(ok);
      if (ok) {
        addToast('success', 'Firebase 雲端資料庫已連線！');
        refreshData();
      } else {
        addToast('error', 'Firebase 設定無效，已回復本地單機模式');
      }
    },
    [addToast, refreshData]
  );

  const clearFirebaseConfig = useCallback(() => {
    cloudSync.clearConfig();
    setIsCloudConnected(false);
    addToast('info', '已切換為純本地單機模式');
  }, [addToast]);

  const openBottomSheet = useCallback(
    async (code: string) => {
      const found = items.find((i) => i.code === code || i.qrCode === code);
      setActiveScannedCode(code);
      setActiveScannedItem(found || null);
      setIsBottomSheetOpen(true);
    },
    [items]
  );

  const closeBottomSheet = useCallback(() => {
    setIsBottomSheetOpen(false);
    setActiveScannedItem(null);
    setActiveScannedCode(null);
  }, []);

  const saveItem = useCallback(
    async (item: ItemMaster) => {
      try {
        await LocalDatabaseService.saveItem(item);
        setItems((prev) => {
          const idx = prev.findIndex((i) => i.id === item.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = item;
            return next;
          }
          return [item, ...prev];
        });
        if (cloudSync.isCloudEnabled()) {
          await cloudSync.syncItemToCloud(item);
        }
        addToast('success', `品目「${item.name}」已儲存`);
      } catch (err) {
        console.error('Failed to save item:', err);
        addToast('error', '儲存品目失敗');
      }
    },
    [addToast]
  );

  const importItems = useCallback(
    async (newItems: ItemMaster[]) => {
      try {
        await LocalDatabaseService.saveItemsBatch(newItems);
        setItems((prev) => {
          const map = new Map(prev.map((i) => [i.id, i]));
          newItems.forEach((i) => map.set(i.id, i));
          return Array.from(map.values());
        });
        if (cloudSync.isCloudEnabled()) {
          for (const item of newItems) {
            await cloudSync.syncItemToCloud(item);
          }
        }
        addToast('success', `成功匯入 ${newItems.length} 筆品目！`);
      } catch (err) {
        console.error('Failed to import items:', err);
        addToast('error', '匯入失敗');
      }
    },
    [addToast]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      try {
        await LocalDatabaseService.deleteItem(id);
        setItems((prev) => prev.filter((i) => i.id !== id));
        addToast('info', '品目已刪除');
      } catch (err) {
        console.error('Failed to delete item:', err);
        addToast('error', '刪除失敗');
      }
    },
    [addToast]
  );

  const recordTransaction = useCallback(
    async (
      item: ItemMaster,
      type: ActionType,
      quantity: number,
      unit: string,
      multiplier: number,
      note?: string,
      isPendingApproval?: boolean
    ): Promise<boolean> => {
      try {
        const baseQty = quantity * multiplier;

        const shouldBePending =
          type === 'IN' && (isPendingApproval !== undefined ? isPendingApproval : settings.requirePcApprovalForInbound);

        if (shouldBePending) {
          const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const pendingObj: PendingInbound = {
            id: pendingId,
            itemCode: item.code,
            itemName: item.name,
            spec: item.spec,
            category: item.category,
            supplier: item.supplier,
            imageUrl: item.imageUrl,
            quantity,
            unit,
            multiplier,
            baseQuantity: baseQty,
            location: item.location,
            operator: settings.activeOperator,
            scannedAt: new Date().toISOString(),
            status: 'PENDING',
            note,
          };

          await LocalDatabaseService.savePendingInbound(pendingObj);
          setPendingInbounds((prev) => [pendingObj, ...prev]);

          if (cloudSync.isCloudEnabled()) {
            await cloudSync.syncPendingInboundToCloud(pendingObj);
          }

          addToast(
            'info',
            `已加入待審核入庫（+${quantity} ${unit}），請於 PC 端進行正式確認！`
          );
          closeBottomSheet();
          return true;
        }

        let delta = 0;
        if (type === 'IN') delta = baseQty;
        else if (type === 'OUT') delta = -baseQty;

        const newStock = Math.max(0, item.currentStock + delta);
        const updatedItem: ItemMaster = {
          ...item,
          currentStock: newStock,
          updatedAt: new Date().toISOString(),
        };

        const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const log: InventoryLog = {
          id: logId,
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          type,
          delta,
          quantity,
          unit,
          multiplier,
          baseQuantity: baseQty,
          operator: settings.activeOperator,
          timestamp: new Date().toISOString(),
          note,
          synced: cloudSync.isCloudEnabled(),
        };

        await Promise.all([
          LocalDatabaseService.saveItem(updatedItem),
          LocalDatabaseService.addLog(log),
        ]);

        setItems((prev) => prev.map((i) => (i.id === item.id ? updatedItem : i)));
        setLogs((prev) => [log, ...prev]);

        if (cloudSync.isCloudEnabled()) {
          await Promise.all([
            cloudSync.syncLogToCloud(log),
            cloudSync.syncItemToCloud(updatedItem),
          ]);
        }

        addToast(
          'success',
          `${type === 'IN' ? '入庫' : '出庫'}成功: ${item.name} (${delta > 0 ? '+' : ''}${quantity} ${unit})`
        );
        closeBottomSheet();
        return true;
      } catch (err) {
        console.error('Failed to record transaction:', err);
        addToast('error', '操作失敗');
        return false;
      }
    },
    [settings, addToast, closeBottomSheet]
  );

  const approvePendingInbound = useCallback(
    async (pending: PendingInbound) => {
      try {
        let item = items.find((i) => i.code === pending.itemCode);
        if (!item) {
          item = {
            id: `item-${pending.itemCode}`,
            code: pending.itemCode,
            name: pending.itemName,
            spec: pending.spec || '',
            category: pending.category || '一般部品',
            supplier: pending.supplier,
            imageUrl: pending.imageUrl,
            baseUnit: pending.unit,
            currentStock: 0,
            safetyStock: 10,
            location: pending.location || '1號盒 (A-01)',
            unitConversions: [{ unit: pending.unit, multiplier: 1 }],
            updatedAt: new Date().toISOString(),
          };
        }

        const newStock = item.currentStock + pending.baseQuantity;
        const updatedItem: ItemMaster = {
          ...item,
          name: pending.itemName || item.name,
          spec: pending.spec || item.spec,
          supplier: pending.supplier || item.supplier,
          location: pending.location || item.location,
          currentStock: newStock,
          updatedAt: new Date().toISOString(),
        };

        const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const log: InventoryLog = {
          id: logId,
          itemId: updatedItem.id,
          itemCode: updatedItem.code,
          itemName: updatedItem.name,
          type: 'IN',
          delta: pending.baseQuantity,
          quantity: pending.quantity,
          unit: pending.unit,
          multiplier: pending.multiplier,
          baseQuantity: pending.baseQuantity,
          operator: `${pending.operator} (PC已審核)`,
          timestamp: new Date().toISOString(),
          note: pending.note || 'PC 端正式核准入庫',
          synced: cloudSync.isCloudEnabled(),
        };

        await Promise.all([
          LocalDatabaseService.saveItem(updatedItem),
          LocalDatabaseService.addLog(log),
          LocalDatabaseService.deletePendingInbound(pending.id),
        ]);

        setItems((prev) => {
          const idx = prev.findIndex((i) => i.id === updatedItem.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updatedItem;
            return next;
          }
          return [updatedItem, ...prev];
        });

        setLogs((prev) => [log, ...prev]);
        setPendingInbounds((prev) => prev.filter((p) => p.id !== pending.id));

        if (cloudSync.isCloudEnabled()) {
          await Promise.all([
            cloudSync.syncItemToCloud(updatedItem),
            cloudSync.syncLogToCloud(log),
            cloudSync.deletePendingInboundFromCloud(pending.id),
          ]);
        }

        addToast('success', `品目「${updatedItem.name}」已正式入庫 (+${pending.quantity} ${pending.unit})！`);
      } catch (err) {
        console.error('Failed to approve pending inbound:', err);
        addToast('error', '審核入庫失敗');
      }
    },
    [items, addToast]
  );

  const batchApprovePendingInbounds = useCallback(
    async (pendings: PendingInbound[]) => {
      try {
        for (const p of pendings) {
          await approvePendingInbound(p);
        }
        addToast('success', `已批次正式入庫 ${pendings.length} 筆項目！`);
      } catch (err) {
        console.error('Batch approve error:', err);
        addToast('error', '批次審核失敗');
      }
    },
    [approvePendingInbound, addToast]
  );

  const rejectPendingInbound = useCallback(
    async (id: string) => {
      try {
        await LocalDatabaseService.deletePendingInbound(id);
        setPendingInbounds((prev) => prev.filter((p) => p.id !== id));
        if (cloudSync.isCloudEnabled()) {
          await cloudSync.deletePendingInboundFromCloud(id);
        }
        addToast('info', '已駁回該筆現場入庫申請');
      } catch (err) {
        console.error('Failed to reject pending inbound:', err);
        addToast('error', '駁回失敗');
      }
    },
    [addToast]
  );

  // Batch Mode Operations
  const addToBatch = useCallback(
    (item: ItemMaster, actionType: 'IN' | 'OUT', unit: string, multiplier: number, quantity: number) => {
      const baseQty = quantity * multiplier;
      const newItem: BatchScanItem = {
        id: `batch-${Date.now()}-${Math.random()}`,
        item,
        actionType,
        selectedUnit: unit,
        multiplier,
        enteredQuantity: quantity,
        calculatedBaseQuantity: baseQty,
        scannedAt: Date.now(),
      };
      setBatchScanList((prev) => [newItem, ...prev]);
      addToast('info', `已加入批次清單: ${item.name} (${actionType === 'IN' ? '+' : '-'}${quantity} ${unit})`);
    },
    [addToast]
  );

  const updateBatchItemQty = useCallback((id: string, newQty: number) => {
    setBatchScanList((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const validQty = Math.max(1, newQty);
        return {
          ...item,
          enteredQuantity: validQty,
          calculatedBaseQuantity: validQty * item.multiplier,
        };
      })
    );
  }, []);

  const updateBatchItem = useCallback((id: string, updates: Partial<BatchScanItem>) => {
    setBatchScanList((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        if (updates.enteredQuantity !== undefined || updates.selectedUnit !== undefined) {
          const conv = item.item.unitConversions?.find((c) => c.unit === updated.selectedUnit) || { multiplier: 1 };
          updated.multiplier = conv.multiplier;
          updated.calculatedBaseQuantity = (updated.enteredQuantity || 1) * conv.multiplier;
        }
        return updated;
      })
    );
  }, []);

  const removeFromBatch = useCallback((id: string) => {
    setBatchScanList((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearBatch = useCallback(() => {
    setBatchScanList([]);
  }, []);

  const commitBatch = useCallback(async () => {
    if (batchScanList.length === 0) return;
    try {
      for (const batchItem of batchScanList) {
        await recordTransaction(
          batchItem.item,
          batchItem.actionType,
          batchItem.enteredQuantity,
          batchItem.selectedUnit,
          batchItem.multiplier,
          '批次檢品一括送信'
        );
      }
      clearBatch();
      addToast('success', '批次作業已全部完成！');
    } catch (err) {
      console.error('Batch commit failed:', err);
      addToast('error', '批次送出失敗');
    }
  }, [batchScanList, recordTransaction, clearBatch, addToast]);

  const commitBatchList = useCallback(async (): Promise<boolean> => {
    try {
      await commitBatch();
      return true;
    } catch {
      return false;
    }
  }, [commitBatch]);

  const openQRGenerator = useCallback((item: ItemMaster) => {
    setQrModalItem(item);
    setIsQRModalOpen(true);
  }, []);

  const closeQRGenerator = useCallback(() => {
    setIsQRModalOpen(false);
    setQrModalItem(null);
  }, []);

  return (
    <InventoryContext.Provider
      value={{
        items,
        logs,
        pendingInbounds,
        activeTab,
        setActiveTab,
        settings,
        updateSettings,
        toasts,
        addToast,
        removeToast,
        isOnline,
        isCloudConnected,
        setIsCloudConnected,
        pendingSyncCount: pendingCount,
        pendingCount,
        isSyncing,
        triggerManualSync: triggerSync,
        triggerSync,
        saveFirebaseConfig,
        clearFirebaseConfig,
        isBottomSheetOpen,
        activeScannedItem,
        activeScannedCode,
        openBottomSheet,
        closeBottomSheet,
        batchScanList,
        addToBatch,
        updateBatchItemQty,
        updateBatchItem,
        removeFromBatch,
        removeBatchItem: removeFromBatch,
        clearBatch,
        clearBatchList: clearBatch,
        commitBatch,
        commitBatchList,
        recordTransaction,
        saveItem,
        importItems,
        deleteItem,
        refreshData,
        approvePendingInbound,
        batchApprovePendingInbounds,
        rejectPendingInbound,
        isQRModalOpen,
        isQRGeneratorOpen: isQRModalOpen,
        qrModalItem,
        qrGeneratorTarget: qrModalItem,
        openQRGenerator,
        closeQRGenerator,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
