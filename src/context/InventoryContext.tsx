import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  ItemMaster,
  InventoryLog,
  BatchScanItem,
  AppSettings,
  ActionType,
  TabKey,
} from '../types/inventory';
import { LocalDatabaseService } from '../services/db';
import { cloudSync, FirebaseConfigOptions } from '../services/firebase';
import { PokaYokeDebouncer } from '../utils/pokaYoke';
import { DualModeCodeParser } from '../utils/qrParser';
import { audioHaptics } from '../utils/audioHaptics';
import { useNetworkSync } from '../hooks/useNetworkSync';
import { useHardwareScanner } from '../hooks/useHardwareScanner';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface InventoryContextType {
  items: ItemMaster[];
  logs: InventoryLog[];
  batchScanList: BatchScanItem[];
  settings: AppSettings;
  activeTab: TabKey;
  activeScannedItem: ItemMaster | null;
  activeScannedCode: string | null;
  isBottomSheetOpen: boolean;
  isQRGeneratorOpen: boolean;
  qrGeneratorTarget: ItemMaster | null;
  toasts: ToastMessage[];
  isOnline: boolean;
  isCloudConnected: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;

  // Setters & Nav
  setActiveTab: (tab: TabKey) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  saveFirebaseConfig: (config: FirebaseConfigOptions) => boolean;
  clearFirebaseConfig: () => void;
  closeBottomSheet: () => void;
  openQRGenerator: (item?: ItemMaster) => void;
  closeQRGenerator: () => void;
  addToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;

  // Scanning & Actions
  handleCodeScanned: (rawCode: string) => Promise<boolean>;
  recordTransaction: (
    item: ItemMaster,
    type: ActionType,
    quantity: number,
    unit: string,
    multiplier: number,
    note?: string
  ) => Promise<boolean>;

  // Batch Scan List Actions
  addToBatchList: (item: ItemMaster, actionType: 'IN' | 'OUT', quantity?: number, unit?: string) => void;
  updateBatchItem: (id: string, updates: Partial<BatchScanItem>) => void;
  removeBatchItem: (id: string) => void;
  clearBatchList: () => void;
  commitBatchList: () => Promise<boolean>;

  // Master Items CRUD
  saveItem: (item: ItemMaster) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  importItems: (newItems: Partial<ItemMaster>[]) => Promise<number>;
  refreshData: () => Promise<void>;
  triggerManualSync: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  debounceMs: 1500,
  activeOperator: 'OP-現場01',
  offlineMode: false,
  viewMode: 'FIELD',
  autoTorch: false,
};

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ItemMaster[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [batchScanList, setBatchScanList] = useState<BatchScanItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<TabKey>('SCAN');
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(cloudSync.isCloudEnabled());

  // Modal / Sheet States
  const [activeScannedItem, setActiveScannedItem] = useState<ItemMaster | null>(null);
  const [activeScannedCode, setActiveScannedCode] = useState<string | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isQRGeneratorOpen, setIsQRGeneratorOpen] = useState(false);
  const [qrGeneratorTarget, setQRGeneratorTarget] = useState<ItemMaster | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Poka-Yoke Debouncer
  const debouncerRef = React.useRef(new PokaYokeDebouncer(1500));

  // Toast Helpers
  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Settings update
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      LocalDatabaseService.saveSettings(updated);
      if (newSettings.debounceMs) {
        debouncerRef.current.setCooldown(newSettings.debounceMs);
      }
      return updated;
    });
  }, []);

  // Network Sync Hook
  const { isOnline, pendingCount: pendingSyncCount, isSyncing, refreshPendingCount, triggerSync } =
    useNetworkSync((syncedCount) => {
      addToast('success', `${syncedCount} 件のオフラインデータをクラウドへ同期しました`);
      refreshData();
    });

  // Load Data
  const refreshData = useCallback(async () => {
    try {
      await LocalDatabaseService.initSeedData();
      let [storedItems, storedLogs, savedSettings] = await Promise.all([
        LocalDatabaseService.getAllItems(),
        LocalDatabaseService.getAllLogs(),
        LocalDatabaseService.getSettings(),
      ]);

      // クラウド同期が有効な場合、Firestore から最新品目を取得
      if (cloudSync.isCloudEnabled()) {
        const cloudItems = await cloudSync.fetchAllCloudItems();
        if (cloudItems.length > 0) {
          await LocalDatabaseService.saveItemsBatch(cloudItems);
          storedItems = await LocalDatabaseService.getAllItems();
        } else if (storedItems.length > 0) {
          // クラウドが空の場合は初期ローカルデータをクラウドに投入
          for (const item of storedItems) {
            await cloudSync.syncItemToCloud(item);
          }
        }
      }

      setItems(storedItems);
      setLogs(storedLogs);
      if (savedSettings && Object.keys(savedSettings).length > 0) {
        setSettings((prev) => ({ ...prev, ...savedSettings }));
      }
      setIsCloudConnected(cloudSync.isCloudEnabled());
      await refreshPendingCount();
    } catch (e) {
      console.error('Failed to load inventory data:', e);
    }
  }, [refreshPendingCount]);

  // Realtime Cloud Listener Setup
  useEffect(() => {
    refreshData();

    if (cloudSync.isCloudEnabled()) {
      cloudSync.listenCloudChanges(
        (remoteItem) => {
          LocalDatabaseService.saveItem(remoteItem);
          setItems((prev) => {
            const index = prev.findIndex((i) => i.id === remoteItem.id);
            if (index >= 0) {
              const next = [...prev];
              next[index] = remoteItem;
              return next;
            }
            return [remoteItem, ...prev];
          });
        },
        (remoteLog) => {
          LocalDatabaseService.addLog(remoteLog);
          setLogs((prev) => {
            if (prev.some((l) => l.id === remoteLog.id)) return prev;
            return [remoteLog, ...prev];
          });
        }
      );
    }

    return () => {
      cloudSync.stopListening();
    };
  }, [refreshData]);

  const saveFirebaseConfig = useCallback((config: FirebaseConfigOptions): boolean => {
    const success = cloudSync.saveConfig(config);
    setIsCloudConnected(success);
    if (success) {
      addToast('success', 'クラウド(Firebase)接続が有効になりました！');
      refreshData();
    } else {
      addToast('error', 'Firebase 接続の初期化に失敗しました');
    }
    return success;
  }, [addToast, refreshData]);

  const clearFirebaseConfig = useCallback(() => {
    cloudSync.clearConfig();
    setIsCloudConnected(false);
    addToast('info', 'クラウド接続を解除し、ローカル(IndexedDB)モードに切り替えました');
  }, [addToast]);

  // Handle Scanning
  const handleCodeScanned = useCallback(
    async (rawCode: string): Promise<boolean> => {
      if (!rawCode || !rawCode.trim()) return false;

      const debounceCheck = debouncerRef.current.shouldAllowScan(rawCode);
      if (!debounceCheck.allowed) {
        audioHaptics.playAlert(settings.soundEnabled, settings.vibrationEnabled);
        addToast('warning', debounceCheck.reason || '連続スキャン制限中');
        return false;
      }

      const parsed = DualModeCodeParser.parse(rawCode);

      if (parsed.type === 'OPERATOR' && parsed.operatorCode) {
        updateSettings({ activeOperator: parsed.operatorCode });
        audioHaptics.playSuccess(settings.soundEnabled, settings.vibrationEnabled);
        addToast('info', `作業員を「${parsed.operatorCode}」に切り替えました`);
        return true;
      }

      const itemCodeToLookup = parsed.itemCode || parsed.rawText;
      const matched = await LocalDatabaseService.getItemByCode(itemCodeToLookup);

      if (matched) {
        audioHaptics.playSuccess(settings.soundEnabled, settings.vibrationEnabled);

        if (activeTab === 'BATCH') {
          addToBatchList(matched, 'IN', 1, matched.baseUnit);
          addToast('success', `【追加】${matched.name} (+1 ${matched.baseUnit})`);
          return true;
        }

        setActiveScannedItem(matched);
        setActiveScannedCode(rawCode);
        setIsBottomSheetOpen(true);
        return true;
      } else {
        // 未登録品目: 自動で新規ポップアップ
        audioHaptics.playAlert(settings.soundEnabled, settings.vibrationEnabled);
        setActiveScannedItem(null);
        setActiveScannedCode(itemCodeToLookup);
        setIsBottomSheetOpen(true);
        addToast('warning', `未登録コードです。写真撮影または1クリックで登録できます。`);
        return false;
      }
    },
    [settings, activeTab, updateSettings, addToast]
  );

  // Hardware Scanner Hook
  useHardwareScanner({
    onScan: (code) => {
      handleCodeScanned(code);
    },
    enabled: true,
  });

  // Single Item Transaction
  const recordTransaction = useCallback(
    async (
      item: ItemMaster,
      type: ActionType,
      quantity: number,
      unit: string,
      multiplier: number,
      note?: string
    ): Promise<boolean> => {
      try {
        const baseQuantity = quantity * multiplier;
        let delta = 0;
        if (type === 'IN') {
          delta = baseQuantity;
        } else if (type === 'OUT') {
          delta = -baseQuantity;
        } else if (type === 'AUDIT') {
          delta = baseQuantity - item.currentStock;
        } else if (type === 'ORDER') {
          delta = 0;
        }

        const log: InventoryLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          type,
          delta,
          quantity,
          unit,
          multiplier,
          baseQuantity,
          operator: settings.activeOperator,
          timestamp: new Date().toISOString(),
          note,
          synced: isOnline && isCloudConnected,
        };

        await LocalDatabaseService.addLog(log);

        // クラウドへ即座に送信
        if (isCloudConnected && isOnline) {
          const updatedItem = {
            ...item,
            currentStock: Math.max(0, item.currentStock + delta),
            updatedAt: log.timestamp,
          };
          await Promise.all([
            cloudSync.syncLogToCloud(log),
            cloudSync.syncItemToCloud(updatedItem),
          ]);
        }

        audioHaptics.playSuccess(settings.soundEnabled, settings.vibrationEnabled);

        const actionName =
          type === 'IN'
            ? '入荷完了'
            : type === 'OUT'
            ? '払出完了'
            : type === 'AUDIT'
            ? '棚卸完了'
            : '発注依頼登録';

        addToast('success', `${item.name}：${actionName} (${quantity} ${unit} / 基準: ${baseQuantity} ${item.baseUnit})`);
        
        await refreshData();
        setIsBottomSheetOpen(false);
        setActiveScannedItem(null);
        setActiveScannedCode(null);
        debouncerRef.current.reset();
        return true;
      } catch (e) {
        console.error('Failed to record transaction:', e);
        audioHaptics.playAlert(settings.soundEnabled, settings.vibrationEnabled);
        addToast('error', 'トランザクションの記録に失敗しました');
        return false;
      }
    },
    [settings, isOnline, isCloudConnected, addToast, refreshData]
  );

  // Batch List Methods
  const addToBatchList = useCallback(
    (item: ItemMaster, actionType: 'IN' | 'OUT', quantity = 1, unit?: string) => {
      const selectedUnit = unit || item.baseUnit;
      const conv = item.unitConversions?.find((c) => c.unit === selectedUnit);
      const multiplier = conv ? conv.multiplier : 1;

      setBatchScanList((prev) => {
        const existingIndex = prev.findIndex(
          (p) => p.item.id === item.id && p.actionType === actionType && p.selectedUnit === selectedUnit
        );
        if (existingIndex >= 0) {
          const updated = [...prev];
          const current = updated[existingIndex];
          const newQty = current.enteredQuantity + quantity;
          updated[existingIndex] = {
            ...current,
            enteredQuantity: newQty,
            calculatedBaseQuantity: newQty * multiplier,
            scannedAt: Date.now(),
          };
          return updated;
        }

        const newItem: BatchScanItem = {
          id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          item,
          actionType,
          selectedUnit,
          multiplier,
          enteredQuantity: quantity,
          calculatedBaseQuantity: quantity * multiplier,
          scannedAt: Date.now(),
        };
        return [newItem, ...prev];
      });
    },
    []
  );

  const updateBatchItem = useCallback((id: string, updates: Partial<BatchScanItem>) => {
    setBatchScanList((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        if (updates.enteredQuantity !== undefined || updates.selectedUnit !== undefined) {
          const conv = updated.item.unitConversions?.find((c) => c.unit === updated.selectedUnit);
          const mult = conv ? conv.multiplier : 1;
          updated.multiplier = mult;
          updated.calculatedBaseQuantity = updated.enteredQuantity * mult;
        }
        return updated;
      })
    );
  }, []);

  const removeBatchItem = useCallback((id: string) => {
    setBatchScanList((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearBatchList = useCallback(() => {
    setBatchScanList([]);
  }, []);

  const commitBatchList = useCallback(async (): Promise<boolean> => {
    if (batchScanList.length === 0) {
      addToast('warning', '検品清単が空です');
      return false;
    }

    try {
      for (const batchItem of batchScanList) {
        await recordTransaction(
          batchItem.item,
          batchItem.actionType,
          batchItem.enteredQuantity,
          batchItem.selectedUnit,
          batchItem.multiplier,
          `【一括検品・バッチ処理】${batchItem.enteredQuantity}${batchItem.selectedUnit}`
        );
      }
      setBatchScanList([]);
      addToast('success', `全 ${batchScanList.length} 件の一括処理が完了しました！`);
      return true;
    } catch (e) {
      console.error('Batch commit failed:', e);
      addToast('error', '一括処理中にエラーが発生しました');
      return false;
    }
  }, [batchScanList, recordTransaction, addToast]);

  // Master Items CRUD
  const saveItem = useCallback(
    async (item: ItemMaster) => {
      await LocalDatabaseService.saveItem(item);
      if (cloudSync.isCloudEnabled()) {
        await cloudSync.syncItemToCloud(item);
      }
      addToast('success', `品目「${item.name}」を保存しました`);
      await refreshData();
    },
    [addToast, refreshData]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      await LocalDatabaseService.deleteItem(id);
      addToast('info', '品目を削除しました');
      await refreshData();
    },
    [addToast, refreshData]
  );

  const importItems = useCallback(
    async (newItems: Partial<ItemMaster>[]): Promise<number> => {
      const itemsToSave: ItemMaster[] = newItems.map((p, idx) => ({
        id: p.id || `item-${Date.now()}-${idx}`,
        code: p.code || `CODE-${idx}`,
        name: p.name || '名称未設定',
        spec: p.spec || '',
        category: p.category || '一般',
        supplier: p.supplier || '',
        imageUrl: p.imageUrl || undefined,
        baseUnit: p.baseUnit || '個',
        currentStock: p.currentStock || 0,
        safetyStock: p.safetyStock || 0,
        location: p.location || 'A-01',
        qrCode: p.qrCode || `INV:v1:${p.code}`,
        unitConversions: p.unitConversions || [{ unit: p.baseUnit || '個', multiplier: 1 }],
        updatedAt: new Date().toISOString(),
        note: p.note || '',
      }));

      await LocalDatabaseService.saveItemsBatch(itemsToSave);
      if (cloudSync.isCloudEnabled()) {
        for (const item of itemsToSave) {
          await cloudSync.syncItemToCloud(item);
        }
      }
      await refreshData();
      addToast('success', `${itemsToSave.length} 件の品目をインポートしました`);
      return itemsToSave.length;
    },
    [addToast, refreshData]
  );

  const openQRGenerator = useCallback((item?: ItemMaster) => {
    setQRGeneratorTarget(item || null);
    setIsQRGeneratorOpen(true);
  }, []);

  const closeQRGenerator = useCallback(() => {
    setIsQRGeneratorOpen(false);
    setQRGeneratorTarget(null);
  }, []);

  const closeBottomSheet = useCallback(() => {
    setIsBottomSheetOpen(false);
    setActiveScannedItem(null);
    setActiveScannedCode(null);
    debouncerRef.current.reset();
  }, []);

  return (
    <InventoryContext.Provider
      value={{
        items,
        logs,
        batchScanList,
        settings,
        activeTab,
        activeScannedItem,
        activeScannedCode,
        isBottomSheetOpen,
        isQRGeneratorOpen,
        qrGeneratorTarget,
        toasts,
        isOnline,
        isCloudConnected,
        pendingSyncCount,
        isSyncing,
        setActiveTab,
        updateSettings,
        saveFirebaseConfig,
        clearFirebaseConfig,
        closeBottomSheet,
        openQRGenerator,
        closeQRGenerator,
        addToast,
        removeToast,
        handleCodeScanned,
        recordTransaction,
        addToBatchList,
        updateBatchItem,
        removeBatchItem,
        clearBatchList,
        commitBatchList,
        saveItem,
        deleteItem,
        importItems,
        refreshData,
        triggerManualSync: triggerSync,
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
