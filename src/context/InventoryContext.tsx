import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  ItemMaster,
  InventoryLog,
  BatchScanItem,
  AppSettings,
  ActionType,
  TabKey
} from '../types/inventory';
import { LocalDatabaseService } from '../services/db';
import { CloudSyncService } from '../services/firebase';
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
  pendingSyncCount: number;
  isSyncing: boolean;

  // Setters & Nav
  setActiveTab: (tab: TabKey) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
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

  // Modal / Sheet States
  const [activeScannedItem, setActiveScannedItem] = useState<ItemMaster | null>(null);
  const [activeScannedCode, setActiveScannedCode] = useState<string | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isQRGeneratorOpen, setIsQRGeneratorOpen] = useState(false);
  const [qrGeneratorTarget, setQRGeneratorTarget] = useState<ItemMaster | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Poka-Yoke Debouncer
  const debouncerRef = React.useRef(new PokaYokeDebouncer(1500));

  // Network Sync Hook
  const { isOnline, pendingCount: pendingSyncCount, isSyncing, refreshPendingCount, triggerSync } =
    useNetworkSync((syncedCount) => {
      addToast('success', `${syncedCount} 件のオフラインデータを同期しました`);
      refreshData();
    });

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

  // Load Data
  const refreshData = useCallback(async () => {
    try {
      await LocalDatabaseService.initSeedData();
      CloudSyncService.init();
      const [storedItems, storedLogs, savedSettings] = await Promise.all([
        LocalDatabaseService.getAllItems(),
        LocalDatabaseService.getAllLogs(),
        LocalDatabaseService.getSettings(),
      ]);
      setItems(storedItems);
      setLogs(storedLogs);
      if (savedSettings && Object.keys(savedSettings).length > 0) {
        setSettings((prev) => ({ ...prev, ...savedSettings }));
      }
      await refreshPendingCount();
    } catch (e) {
      console.error('Failed to load inventory data:', e);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle Scanning (Camera or Laser Barcode Gun)
  const handleCodeScanned = useCallback(
    async (rawCode: string): Promise<boolean> => {
      if (!rawCode || !rawCode.trim()) return false;

      // 1. Debounce 防重刷檢查
      const debounceCheck = debouncerRef.current.shouldAllowScan(rawCode);
      if (!debounceCheck.allowed) {
        audioHaptics.playAlert(settings.soundEnabled, settings.vibrationEnabled);
        addToast('warning', debounceCheck.reason || '連続スキャン制限中');
        return false;
      }

      // 2. 雙軌解析
      const parsed = DualModeCodeParser.parse(rawCode);
      console.log('Scanned & Parsed:', parsed);

      // ロケーションまたは作業員バーコードの場合
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

        // 批次檢品模式中，若在 BATCH Tab 則直接追加至批次清單
        if (activeTab === 'BATCH') {
          addToBatchList(matched, 'IN', 1, matched.baseUnit);
          addToast('success', `【追加】${matched.name} (+1 ${matched.baseUnit})`);
          return true;
        }

        // 單筆模式：彈出 Bottom Sheet
        setActiveScannedItem(matched);
        setActiveScannedCode(rawCode);
        setIsBottomSheetOpen(true);
        return true;
      } else {
        // 未登録品目
        audioHaptics.playAlert(settings.soundEnabled, settings.vibrationEnabled);
        setActiveScannedItem(null);
        setActiveScannedCode(itemCodeToLookup);
        setIsBottomSheetOpen(true); // 讓使用者可點【新規追加】
        addToast('warning', `未登録の品目コードです: ${itemCodeToLookup}`);
        return false;
      }
    },
    [settings, activeTab, updateSettings, addToast]
  );

  // Hardware Scanner Hook (Laser gun / PDA)
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
          delta = baseQuantity - item.currentStock; // 調整差額
        } else if (type === 'ORDER') {
          delta = 0; // 発注依頼は在庫自体は変動させない
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
          synced: isOnline,
        };

        await LocalDatabaseService.addLog(log);
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
    [settings, isOnline, addToast, refreshData]
  );

  // Batch List Methods
  const addToBatchList = useCallback(
    (item: ItemMaster, actionType: 'IN' | 'OUT', quantity = 1, unit?: string) => {
      const selectedUnit = unit || item.baseUnit;
      const conv = item.unitConversions?.find((c) => c.unit === selectedUnit);
      const multiplier = conv ? conv.multiplier : 1;

      setBatchScanList((prev) => {
        // 同一品目・同一動作であれば数量を加算
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
      await refreshData();
      addToast('success', `${itemsToSave.length} 件の品目をインポートしました`);
      return itemsToSave.length;
    },
    [addToast, refreshData]
  );

  // QR Modal
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
        pendingSyncCount,
        isSyncing,
        setActiveTab,
        updateSettings,
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
