import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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
import { cloudSync, FirebaseConfigOptions } from '../services/firebase';
import { VisualKnowledgeService } from '../utils/visualKnowledgeService';

// ─────────────── Types ───────────────

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
}

export interface InventoryContextType {
  items: ItemMaster[];
  logs: InventoryLog[];
  pendingInbounds: PendingInbound[];
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  toasts: ToastMessage[];
  addToast: (type: 'success' | 'error' | 'info' | 'warning', text: string) => void;
  removeToast: (id: string) => void;

  isOnline: boolean;
  isCloudConnected: boolean;
  setIsCloudConnected: (connected: boolean) => void;
  pendingSyncCount: number;
  pendingCount: number;
  isSyncing: boolean;
  triggerManualSync: () => Promise<void>;
  triggerSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
  saveFirebaseConfig: (config: FirebaseConfigOptions) => void;
  clearFirebaseConfig: () => void;

  isBottomSheetOpen: boolean;
  activeScannedItem: ItemMaster | null;
  activeScannedCode: string | null;
  openBottomSheet: (code: string) => Promise<void>;
  closeBottomSheet: () => void;

  batchScanList: BatchScanItem[];
  addToBatch: (item: ItemMaster, actionType: 'IN' | 'OUT', unit: string, multiplier: number, quantity: number) => void;
  updateBatchItem: (id: string, updates: Partial<BatchScanItem>) => void;
  updateBatchItemQty: (id: string, newQty: number) => void;
  removeFromBatch: (id: string) => void;
  removeBatchItem: (id: string) => void;
  clearBatch: () => void;
  clearBatchList: () => void;
  commitBatch: () => Promise<void>;
  commitBatchList: () => Promise<boolean>;

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

  approvePendingInbound: (pending: PendingInbound) => Promise<void>;
  batchApprovePendingInbounds: (pendings: PendingInbound[]) => Promise<void>;
  rejectPendingInbound: (id: string) => Promise<void>;

  isQRModalOpen: boolean;
  isQRGeneratorOpen: boolean;
  qrModalItem: ItemMaster | null;
  qrGeneratorTarget: ItemMaster | null;
  openQRGenerator: (item: ItemMaster) => void;
  closeQRGenerator: () => void;
}

// ─────────────── Defaults ───────────────

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  debounceMs: 1500,
  activeOperator: '現場担当-01',
  offlineMode: false,
  viewMode: 'FIELD',
  autoTorch: false,
  requirePcApprovalForInbound: true,
};

const InventoryContext = createContext<InventoryContextType | null>(null);

// ─────────────── Provider ───────────────

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ItemMaster[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [pendingInbounds, setPendingInbounds] = useState<PendingInbound[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('SCAN');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Bottom sheet state
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [activeScannedItem, setActiveScannedItem] = useState<ItemMaster | null>(null);
  const [activeScannedCode, setActiveScannedCode] = useState<string | null>(null);

  // Batch state
  const [batchScanList, setBatchScanList] = useState<BatchScanItem[]>([]);

  // QR modal state
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrModalItem, setQrModalItem] = useState<ItemMaster | null>(null);

  // Keep items ref for fast lookups without stale closure
  const itemsRef = useRef<ItemMaster[]>([]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // ─── Toast ───
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]); // max 4 toasts
    setTimeout(() => removeToast(id), 3800);
  }, [removeToast]);

  // ─── Network ───
  const refreshPendingCount = useCallback(async () => {
    try {
      const queue = await LocalDatabaseService.getOfflineQueue();
      setPendingCount(queue.length);
    } catch { /* ignore */ }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const queue = await LocalDatabaseService.getOfflineQueue();
      let synced = 0;
      for (const item of queue) {
        let ok = false;
        if (item.type === 'LOG') ok = await cloudSync.syncLogToCloud(item.payload);
        else if (item.type === 'ITEM') ok = await cloudSync.syncItemToCloud(item.payload);
        else if (item.type === 'PENDING_INBOUND') ok = await cloudSync.syncPendingInboundToCloud(item.payload);
        if (ok) {
          await LocalDatabaseService.removeOfflineQueueItem(item.id);
          synced++;
        }
      }
      await refreshPendingCount();
      if (synced > 0) addToast('success', `未送信データ ${synced}件 をクラウドに同期しました`);
    } catch (e) {
      console.error('Sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount, addToast]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); triggerSync(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync]);

  // ─── Data Load ───
  const refreshData = useCallback(async () => {
    try {
      await LocalDatabaseService.initSeedData();
      const [storedItems, storedLogs, storedPendings, savedSettings] = await Promise.all([
        LocalDatabaseService.getAllItems(),
        LocalDatabaseService.getAllLogs(),
        LocalDatabaseService.getAllPendingInbounds(),
        LocalDatabaseService.getSettings(),
      ]);

      setItems(storedItems);
      setLogs(storedLogs);
      setPendingInbounds(storedPendings);
      if (savedSettings && Object.keys(savedSettings).length > 0) {
        setSettings((prev) => ({ ...prev, ...savedSettings }));
        if (savedSettings.viewMode === 'PC_ADMIN') {
          setActiveTab('ITEMS');
        }
      }

      const cloudEnabled = cloudSync.isCloudEnabled();
      setIsCloudConnected(cloudEnabled);

      if (cloudEnabled) {
        try {
          const [cloudItems, cloudPendings] = await Promise.all([
            cloudSync.fetchAllCloudItems(),
            cloudSync.fetchAllPendingInbounds(),
          ]);

          if (cloudItems.length > 0) {
            await LocalDatabaseService.saveItemsBatch(cloudItems);
            setItems(cloudItems);
          } else if (storedItems.length > 0) {
            for (const item of storedItems) {
              cloudSync.syncItemToCloud(item);
            }
          }

          if (cloudPendings.length > 0) {
            await LocalDatabaseService.savePendingInboundsBatch(cloudPendings);
            setPendingInbounds(cloudPendings);
          }
        } catch (e) {
          console.warn('Cloud initial fetch failed:', e);
        }
      }

      await refreshPendingCount();
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }, [refreshPendingCount]);

  // ─── Realtime Listeners ───
  useEffect(() => {
    refreshData().then(() => {
      if (cloudSync.isCloudEnabled()) {
        let initialLoad = true;
        setTimeout(() => { initialLoad = false; }, 3000);

        cloudSync.listenCloudChanges(
          (remoteItem, isDeleted) => {
            if (isDeleted) {
              setItems((prev) => {
                const target = prev.find((i) => i.id === remoteItem.id);
                if (target) {
                  VisualKnowledgeService.removeItem(target.code);
                }
                return prev.filter((i) => i.id !== remoteItem.id);
              });
              LocalDatabaseService.deleteItem(remoteItem.id);
            } else {
              if (initialLoad) return;
              setItems((prev) => {
                const idx = prev.findIndex((i) => i.id === remoteItem.id);
                if (idx >= 0) {
                  if (remoteItem.updatedAt > prev[idx].updatedAt) {
                    const next = [...prev];
                    next[idx] = remoteItem;
                    return next;
                  }
                  return prev;
                }
                return [remoteItem, ...prev];
              });
              LocalDatabaseService.saveItem(remoteItem);
            }
          },
          (remoteLog) => {
            if (initialLoad) return;
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
              if (initialLoad) return;
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
    });
    return () => cloudSync.stopListening();
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    for (const [key, val] of Object.entries(newSettings)) {
      await LocalDatabaseService.saveSetting(key, val);
    }
  }, []);

  const saveFirebaseConfig = useCallback((config: FirebaseConfigOptions) => {
    const ok = cloudSync.saveConfig(config);
    setIsCloudConnected(ok);
    if (ok) {
      addToast('success', 'Firebase クラウドデータベースに接続しました');
      refreshData();
    } else {
      addToast('error', 'Firebase 設定が無効です');
    }
  }, [addToast, refreshData]);

  const clearFirebaseConfig = useCallback(() => {
    cloudSync.clearConfig();
    setIsCloudConnected(false);
    addToast('info', 'ローカル単機モードに切り替えました');
  }, [addToast]);

  // ─── Bottom Sheet ───
  const openBottomSheet = useCallback(async (code: string) => {
    const found = itemsRef.current.find((i) => i.code === code || i.qrCode === code);
    setActiveScannedCode(code);
    setActiveScannedItem(found || null);
    setIsBottomSheetOpen(true);
  }, []);

  const closeBottomSheet = useCallback(() => {
    setIsBottomSheetOpen(false);
    setActiveScannedItem(null);
    setActiveScannedCode(null);
    setActiveTab(settings.viewMode === 'PC_ADMIN' ? 'ITEMS' : 'SCAN');
  }, [settings.viewMode]);

  // ─── Item CRUD ───
  const saveItem = useCallback(async (item: ItemMaster) => {
    try {
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.id === item.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = item;
          return next;
        }
        return [item, ...prev];
      });

      await LocalDatabaseService.saveItem(item);

      if (cloudSync.isCloudEnabled()) {
        cloudSync.syncItemToCloud(item).catch((e) => {
          console.warn('Cloud sync failed, queuing:', e);
          LocalDatabaseService.addToOfflineQueue({
            id: `q-item-${item.id}-${Date.now()}`,
            type: 'ITEM',
            payload: item,
            retryCount: 0,
            createdAt: Date.now(),
          });
        });
      }
      addToast('success', `品目「${item.name}」を保存しました`);
    } catch (err) {
      console.error('Failed to save item:', err);
      addToast('error', '品目の保存に失敗しました');
    }
  }, [addToast]);

  const importItems = useCallback(async (newItems: ItemMaster[]) => {
    try {
      setItems((prev) => {
        const map = new Map(prev.map((i) => [i.id, i]));
        newItems.forEach((i) => map.set(i.id, i));
        return Array.from(map.values());
      });
      await LocalDatabaseService.saveItemsBatch(newItems);
      if (cloudSync.isCloudEnabled()) {
        newItems.forEach((item) => cloudSync.syncItemToCloud(item));
      }
      addToast('success', `${newItems.length}件の品目をインポートしました`);
    } catch (err) {
      console.error('Failed to import items:', err);
      addToast('error', 'インポートに失敗しました');
    }
  }, [addToast]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      const targetItem = itemsRef.current.find((i) => i.id === id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      await LocalDatabaseService.deleteItem(id);
      
      if (targetItem) {
        VisualKnowledgeService.removeItem(targetItem.code);
      }

      if (cloudSync.isCloudEnabled()) {
        cloudSync.deleteItemFromCloud(id).catch((e) => console.warn('Cloud delete item failed:', e));
      }
      addToast('info', '品目を削除しました');
    } catch (err) {
      console.error('Failed to delete item:', err);
      addToast('error', '削除に失敗しました');
    }
  }, [addToast]);

  // ─── Transaction Recording ───
  const recordTransaction = useCallback(async (
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

        setPendingInbounds((prev) => [pendingObj, ...prev]);

        LocalDatabaseService.savePendingInbound(pendingObj);
        if (cloudSync.isCloudEnabled()) {
          cloudSync.syncPendingInboundToCloud(pendingObj).catch(() => {
            LocalDatabaseService.addToOfflineQueue({
              id: `q-pending-${pendingId}`,
              type: 'PENDING_INBOUND',
              payload: pendingObj,
              retryCount: 0,
              createdAt: Date.now(),
            });
          });
        }

        addToast('info', `📥 入荷承認待ちに登録しました: ${item.name} (+${quantity} ${unit})`);
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

      const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

      setItems((prev) => prev.map((i) => (i.id === item.id ? updatedItem : i)));
      setLogs((prev) => [log, ...prev]);
      closeBottomSheet();
      addToast(
        'success',
        `${type === 'IN' ? '入荷' : '出庫'}完了: ${item.name} (${delta > 0 ? '+' : ''}${quantity} ${unit})`
      );

      Promise.all([
        LocalDatabaseService.saveItem(updatedItem),
        LocalDatabaseService.addLog(log),
      ]).then(() => {
        if (cloudSync.isCloudEnabled()) {
          cloudSync.syncItemToCloud(updatedItem).catch(() => {
            LocalDatabaseService.addToOfflineQueue({
              id: `q-item-${updatedItem.id}-${Date.now()}`,
              type: 'ITEM',
              payload: updatedItem,
              retryCount: 0,
              createdAt: Date.now(),
            });
          });
          cloudSync.syncLogToCloud(log).catch(() => {
            LocalDatabaseService.addToOfflineQueue({
              id: `q-log-${log.id}`,
              type: 'LOG',
              payload: log,
              retryCount: 0,
              createdAt: Date.now(),
            });
          });
        }
      });

      return true;
    } catch (err) {
      console.error('Failed to record transaction:', err);
      addToast('error', '操作に失敗しました');
      return false;
    }
  }, [settings, addToast, closeBottomSheet]);

  // ─── Pending Inbound Approval ───
  const approvePendingInbound = useCallback(async (pending: PendingInbound) => {
    try {
      let item = itemsRef.current.find((i) => i.code === pending.itemCode);

      if (!item) {
        item = {
          id: `item-${pending.itemCode}-${Date.now()}`,
          code: pending.itemCode,
          name: pending.itemName,
          spec: pending.spec || '',
          category: pending.category || '配線・電気資材',
          supplier: pending.supplier,
          imageUrl: pending.imageUrl,
          baseUnit: pending.unit,
          currentStock: 0,
          safetyStock: 10,
          location: pending.location || '端子ボックス (A-01)',
          unitConversions: [{ unit: pending.unit, multiplier: 1 }],
          updatedAt: new Date().toISOString(),
        };
      }

      const newStock = item.currentStock + pending.baseQuantity;
      const updatedItem: ItemMaster = {
        ...item,
        name: pending.itemName || item.name,
        spec: pending.spec || item.spec,
        supplier: pending.supplier ?? item.supplier,
        location: pending.location || item.location,
        currentStock: newStock,
        updatedAt: new Date().toISOString(),
      };

      const log: InventoryLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        itemId: updatedItem.id,
        itemCode: updatedItem.code,
        itemName: updatedItem.name,
        type: 'IN',
        delta: pending.baseQuantity,
        quantity: pending.quantity,
        unit: pending.unit,
        multiplier: pending.multiplier,
        baseQuantity: pending.baseQuantity,
        operator: `${pending.operator} (PC承認済)`,
        timestamp: new Date().toISOString(),
        note: `PC正式承認入荷 | ${pending.note || ''}`.trim(),
        synced: cloudSync.isCloudEnabled(),
      };

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

      addToast('success', `正式入庫完了: ${updatedItem.name} +${pending.quantity} ${pending.unit}`);

      Promise.all([
        LocalDatabaseService.saveItem(updatedItem),
        LocalDatabaseService.addLog(log),
        LocalDatabaseService.deletePendingInbound(pending.id),
      ]).then(() => {
        if (cloudSync.isCloudEnabled()) {
          cloudSync.syncItemToCloud(updatedItem);
          cloudSync.syncLogToCloud(log);
          cloudSync.deletePendingInboundFromCloud(pending.id);
        }
      });
    } catch (err) {
      console.error('Failed to approve pending inbound:', err);
      addToast('error', '入荷承認に失敗しました');
    }
  }, [addToast]);

  const batchApprovePendingInbounds = useCallback(async (pendings: PendingInbound[]) => {
    for (const p of pendings) {
      await approvePendingInbound(p);
    }
    addToast('success', `${pendings.length}件の入荷を一括承認しました`);
  }, [approvePendingInbound, addToast]);

  const rejectPendingInbound = useCallback(async (id: string) => {
    try {
      setPendingInbounds((prev) => prev.filter((p) => p.id !== id));
      LocalDatabaseService.deletePendingInbound(id);
      if (cloudSync.isCloudEnabled()) cloudSync.deletePendingInboundFromCloud(id);
      addToast('info', '入荷申請を却下しました');
    } catch (err) {
      addToast('error', '却下に失敗しました');
    }
  }, [addToast]);

  // ─── Batch ───
  const addToBatch = useCallback((item: ItemMaster, actionType: 'IN' | 'OUT', unit: string, multiplier: number, quantity: number) => {
    const baseQty = quantity * multiplier;
    setBatchScanList((prev) => [{
      id: `batch-${Date.now()}-${Math.random()}`,
      item, actionType, selectedUnit: unit, multiplier,
      enteredQuantity: quantity, calculatedBaseQuantity: baseQty, scannedAt: Date.now(),
    }, ...prev]);
  }, []);

  const updateBatchItem = useCallback((id: string, updates: Partial<BatchScanItem>) => {
    setBatchScanList((prev) => prev.map((bi) => {
      if (bi.id !== id) return bi;
      const merged = { ...bi, ...updates };
      const conv = bi.item.unitConversions?.find((c) => c.unit === merged.selectedUnit) || { multiplier: 1 };
      merged.multiplier = conv.multiplier;
      merged.calculatedBaseQuantity = (merged.enteredQuantity || 1) * conv.multiplier;
      return merged;
    }));
  }, []);

  const updateBatchItemQty = useCallback((id: string, newQty: number) => {
    setBatchScanList((prev) => prev.map((bi) => {
      if (bi.id !== id) return bi;
      const qty = Math.max(1, newQty);
      return { ...bi, enteredQuantity: qty, calculatedBaseQuantity: qty * bi.multiplier };
    }));
  }, []);

  const removeFromBatch = useCallback((id: string) => {
    setBatchScanList((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearBatch = useCallback(() => setBatchScanList([]), []);

  const commitBatch = useCallback(async () => {
    if (batchScanList.length === 0) return;
    for (const bi of batchScanList) {
      await recordTransaction(bi.item, bi.actionType, bi.enteredQuantity, bi.selectedUnit, bi.multiplier, '連続スキャン一括実行');
    }
    clearBatch();
  }, [batchScanList, recordTransaction, clearBatch]);

  const commitBatchList = useCallback(async (): Promise<boolean> => {
    try { await commitBatch(); return true; }
    catch { return false; }
  }, [commitBatch]);

  // ─── QR Modal ───
  const openQRGenerator = useCallback((item: ItemMaster) => {
    setQrModalItem(item); setIsQRModalOpen(true);
  }, []);
  const closeQRGenerator = useCallback(() => {
    setIsQRModalOpen(false); setQrModalItem(null);
  }, []);

  return (
    <InventoryContext.Provider value={{
      items, logs, pendingInbounds, activeTab, setActiveTab,
      settings, updateSettings, toasts, addToast, removeToast,
      isOnline, isCloudConnected, setIsCloudConnected,
      pendingSyncCount: pendingCount, pendingCount, isSyncing,
      triggerManualSync: triggerSync, triggerSync, refreshPendingCount,
      saveFirebaseConfig, clearFirebaseConfig,
      isBottomSheetOpen, activeScannedItem, activeScannedCode,
      openBottomSheet, closeBottomSheet,
      batchScanList, addToBatch, updateBatchItem, updateBatchItemQty,
      removeFromBatch, removeBatchItem: removeFromBatch,
      clearBatch, clearBatchList: clearBatch, commitBatch, commitBatchList,
      recordTransaction, saveItem, importItems, deleteItem, refreshData,
      approvePendingInbound, batchApprovePendingInbounds, rejectPendingInbound,
      isQRModalOpen, isQRGeneratorOpen: isQRModalOpen,
      qrModalItem, qrGeneratorTarget: qrModalItem,
      openQRGenerator, closeQRGenerator,
    }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used within an InventoryProvider');
  return context;
};
