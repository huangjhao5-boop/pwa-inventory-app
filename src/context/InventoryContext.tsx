import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import {
  ItemMaster,
  InventoryLog,
  ActionType,
  AppSettings,
  BatchScanItem,
  TabKey,
  PendingInbound,
  LinkedBarcode,
  StorageBoxConfig,
  DEFAULT_STORAGE_BOXES,
  CheckedOutItem,
  ReturnCondition,
  RETURN_CONDITIONS,
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
  checkedOutList: CheckedOutItem[];
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  toasts: ToastMessage[];
  addToast: (type: 'success' | 'error' | 'info' | 'warning', text: string) => void;
  removeToast: (id: string) => void;

  // Storage Boxes configuration & cascading rename
  boxConfigs: StorageBoxConfig[];
  updateBoxConfig: (oldName: string, newConfig: StorageBoxConfig) => Promise<boolean>;
  addBoxConfig: (newConfig: StorageBoxConfig) => Promise<boolean>;
  deleteBoxConfig: (boxName: string) => Promise<boolean>;
  batchMoveItemsToBox: (itemIds: string[], targetBoxName: string) => Promise<boolean>;
  clearOldLogs: (beforeDate: Date) => Promise<number>;

  // Checked-out items tracking & return
  recordPcOutbound: (params: {
    item: ItemMaster;
    quantity: number;
    unit: string;
    multiplier: number;
    operator: string;
    destination?: string;
    note?: string;
    trackAsCheckedOut?: boolean;
  }) => Promise<boolean>;
  returnCheckedOutItem: (
    checkoutId: string,
    params: {
      returnCondition: ReturnCondition;
      returnedBaseQty: number;
      isOpenPackage: boolean;
      returnNote?: string;
    }
  ) => Promise<boolean>;
  markCheckedOutAsConsumed: (checkoutId: string, note?: string) => Promise<boolean>;
  deleteCheckedOutRecord: (checkoutId: string) => Promise<boolean>;

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
  activeMatchedBarcode?: LinkedBarcode;
  findItemByCode: (code: string) => { item: ItemMaster | null; matchedBarcode?: LinkedBarcode };
  linkBarcodeToItem: (itemId: string, linked: LinkedBarcode) => Promise<boolean>;
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
  activeOperator: 'M.K(TW)',
  recentOperators: ['M.K(TW)', '現場作業員-A', '電気工事担当'],
  offlineMode: false,
  viewMode: 'FIELD',
  autoTorch: false,
  requirePcApprovalForInbound: true,
  geminiApiKey: 'AQ.Ab8RN6K-0iI-v6dqX7QDe5r00o5iNZH_EVDd812ALgyzZS07Mw',
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
  const [activeMatchedBarcode, setActiveMatchedBarcode] = useState<LinkedBarcode | undefined>(undefined);

  // Batch state
  const [batchScanList, setBatchScanList] = useState<BatchScanItem[]>([]);

  // QR modal state
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrModalItem, setQrModalItem] = useState<ItemMaster | null>(null);

  // Storage Box Configuration State
  const [boxConfigs, setBoxConfigs] = useState<StorageBoxConfig[]>(() => {
    try {
      const saved = localStorage.getItem('smart_inventory_box_configs');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return DEFAULT_STORAGE_BOXES;
  });

  const saveBoxConfigsToStorage = (configs: StorageBoxConfig[]) => {
    setBoxConfigs(configs);
    try {
      localStorage.setItem('smart_inventory_box_configs', JSON.stringify(configs));
    } catch (e) {
      console.error('Failed to save box configs:', e);
    }
  };

  // ─── Checked-Out / Dispatched Items State (現場持出・未返却リスト) ───
  const [checkedOutList, setCheckedOutList] = useState<CheckedOutItem[]>(() => {
    try {
      const saved = localStorage.getItem('smart_inventory_checked_out_list');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return [];
  });

  const saveCheckedOutListToStorage = (list: CheckedOutItem[]) => {
    setCheckedOutList(list);
    try {
      localStorage.setItem('smart_inventory_checked_out_list', JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save checked out list:', e);
    }
  };

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

  // ─── Storage Box CRUD & Cascading Location Rename ───
  const updateBoxConfig = useCallback(async (oldName: string, newConfig: StorageBoxConfig): Promise<boolean> => {
    try {
      // 1. Update boxConfigs list
      const existingIdx = boxConfigs.findIndex((b) => b.name === oldName);
      let updatedConfigs = [...boxConfigs];
      if (existingIdx >= 0) {
        updatedConfigs[existingIdx] = newConfig;
      } else {
        updatedConfigs.push(newConfig);
      }
      saveBoxConfigsToStorage(updatedConfigs);

      // 2. Cascading location rename: If box name changed, update all items currently located in oldName!
      if (oldName !== newConfig.name) {
        const affectedItems = itemsRef.current.filter((item) => item.location === oldName);
        if (affectedItems.length > 0) {
          const updatedItemsList = itemsRef.current.map((item) => {
            if (item.location === oldName) {
              return { ...item, location: newConfig.name, updatedAt: new Date().toISOString() };
            }
            return item;
          });
          setItems(updatedItemsList);

          // Persist each modified item
          for (const item of affectedItems) {
            const updated = { ...item, location: newConfig.name, updatedAt: new Date().toISOString() };
            await LocalDatabaseService.saveItem(updated);
            if (cloudSync.isCloudEnabled()) {
              cloudSync.syncItemToCloud(updated);
            }
          }
          addToast('success', `保管箱名を「${newConfig.name}」に変更し、所属する${affectedItems.length}件の品目を自動連動更新しました！`);
        } else {
          addToast('success', `保管箱「${newConfig.name}」の設定を更新しました`);
        }
      } else {
        addToast('success', `保管箱「${newConfig.name}」のアイコン・色を更新しました`);
      }
      return true;
    } catch (err) {
      console.error('Failed to update box config:', err);
      addToast('error', '保管箱の更新に失敗しました');
      return false;
    }
  }, [boxConfigs, addToast]);

  const addBoxConfig = useCallback(async (newConfig: StorageBoxConfig): Promise<boolean> => {
    try {
      if (boxConfigs.some((b) => b.name.trim() === newConfig.name.trim())) {
        addToast('warning', `同名の保管箱「${newConfig.name}」が既に存在します`);
        return false;
      }
      const updated = [...boxConfigs, newConfig];
      saveBoxConfigsToStorage(updated);
      addToast('success', `新しい保管箱「${newConfig.name}」を追加しました`);
      return true;
    } catch (err) {
      addToast('error', '保管箱の追加に失敗しました');
      return false;
    }
  }, [boxConfigs, addToast]);

  const deleteBoxConfig = useCallback(async (boxName: string): Promise<boolean> => {
    try {
      const updated = boxConfigs.filter((b) => b.name !== boxName);
      saveBoxConfigsToStorage(updated);
      addToast('info', `保管箱「${boxName}」を削除しました`);
      return true;
    } catch (err) {
      addToast('error', '保管箱の削除に失敗しました');
      return false;
    }
  }, [boxConfigs, addToast]);

  const batchMoveItemsToBox = useCallback(async (itemIds: string[], targetBoxName: string): Promise<boolean> => {
    try {
      if (itemIds.length === 0 || !targetBoxName.trim()) return false;
      const targetBox = targetBoxName.trim();
      const updatedList = itemsRef.current.map((item) => {
        if (itemIds.includes(item.id)) {
          return { ...item, location: targetBox, updatedAt: new Date().toISOString() };
        }
        return item;
      });
      setItems(updatedList);

      for (const id of itemIds) {
        const item = updatedList.find((i) => i.id === id);
        if (item) {
          await LocalDatabaseService.saveItem(item);
          if (cloudSync.isCloudEnabled()) {
            cloudSync.syncItemToCloud(item);
          }
        }
      }

      addToast('success', `${itemIds.length} 件の品目を「${targetBox}」に一括移動しました！`);
      return true;
    } catch (err) {
      console.error('Failed to batch move items:', err);
      addToast('error', '品目の一括移動に失敗しました');
      return false;
    }
  }, [addToast]);

  const clearOldLogs = useCallback(async (beforeDate: Date): Promise<number> => {
    try {
      const cutoffTime = beforeDate.getTime();
      const keepLogs = logs.filter((l) => new Date(l.timestamp).getTime() >= cutoffTime);
      const deleteCount = logs.length - keepLogs.length;

      setLogs(keepLogs);
      addToast('success', `${deleteCount} 件の過去ログをクリーンアップしました`);
      return deleteCount;
    } catch (err) {
      console.error('Failed to clear old logs:', err);
      addToast('error', 'ログのクリーンアップに失敗しました');
      return 0;
    }
  }, [logs, addToast]);

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

          // 安全な雙向マージ（ローカルで新規追加された品目が消えるのを防止）
          const itemMap = new Map<string, ItemMaster>();
          storedItems.forEach((item) => itemMap.set(item.id, item));

          cloudItems.forEach((cItem) => {
            const local = itemMap.get(cItem.id);
            if (!local || (cItem.updatedAt && cItem.updatedAt >= local.updatedAt)) {
              itemMap.set(cItem.id, cItem);
            }
          });

          // クラウドに未同期のローカル品目をバックグラウンドでクラウドへ同期
          for (const [id, item] of itemMap.entries()) {
            if (!cloudItems.some((ci) => ci.id === id)) {
              cloudSync.syncItemToCloud(item).catch(() => {});
            }
          }

          const finalItems = Array.from(itemMap.values());
          await LocalDatabaseService.saveItemsBatch(finalItems);
          setItems(finalItems);

          // 承認待ちデータの安全なマージ
          const pendingMap = new Map<string, PendingInbound>();
          storedPendings.forEach((p) => pendingMap.set(p.id, p));
          cloudPendings.forEach((cp) => pendingMap.set(cp.id, cp));

          for (const [id, pend] of pendingMap.entries()) {
            if (!cloudPendings.some((cp) => cp.id === id)) {
              cloudSync.syncPendingInboundToCloud(pend).catch(() => {});
            }
          }

          const finalPendings = Array.from(pendingMap.values());
          await LocalDatabaseService.savePendingInboundsBatch(finalPendings);
          setPendingInbounds(finalPendings);
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
    setSettings((prev) => {
      const next = { ...prev, ...newSettings };
      if (newSettings.activeOperator && newSettings.activeOperator.trim()) {
        const trimmed = newSettings.activeOperator.trim();
        const currentList = prev.recentOperators || ['M.K(TW)', '現場作業員-A'];
        if (!currentList.includes(trimmed)) {
          next.recentOperators = [trimmed, ...currentList.filter((n) => n !== trimmed)].slice(0, 10);
        }
      }
      return next;
    });
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

  // ─── Barcode Resolution & Linking ───
  const findItemByCode = useCallback((code: string): { item: ItemMaster | null; matchedBarcode?: LinkedBarcode } => {
    if (!code) return { item: null };
    const cleanCode = code.trim();

    for (const item of itemsRef.current) {
      if (item.code === cleanCode || item.qrCode === cleanCode) {
        return { item };
      }
      if (item.aliasCodes?.includes(cleanCode)) {
        return { item };
      }
      const matchedLinked = item.linkedBarcodes?.find((b) => b.code === cleanCode);
      if (matchedLinked) {
        return { item, matchedBarcode: matchedLinked };
      }
    }
    return { item: null };
  }, []);

  // ─── Bottom Sheet ───
  const openBottomSheet = useCallback(async (code: string) => {
    const { item, matchedBarcode } = findItemByCode(code);
    setActiveScannedCode(code);
    setActiveScannedItem(item || null);
    setActiveMatchedBarcode(matchedBarcode);
    setIsBottomSheetOpen(true);
  }, [findItemByCode]);

  const closeBottomSheet = useCallback(() => {
    setIsBottomSheetOpen(false);
    setActiveScannedItem(null);
    setActiveScannedCode(null);
    setActiveMatchedBarcode(undefined);
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

  const linkBarcodeToItem = useCallback(async (itemId: string, linked: LinkedBarcode): Promise<boolean> => {
    try {
      const target = itemsRef.current.find((i) => i.id === itemId);
      if (!target) {
        addToast('error', '紐付け対象の品目が見つかりませんでした');
        return false;
      }

      const currentLinks = target.linkedBarcodes || [];
      const currentAliases = target.aliasCodes || [];
      const cleanCode = linked.code.trim();

      if (
        target.code === cleanCode ||
        target.qrCode === cleanCode ||
        currentLinks.some((l) => l.code === cleanCode)
      ) {
        addToast('info', `バーコード「${cleanCode}」は既に登録・紐付け済みです`);
        return true;
      }

      const updatedLinks = [...currentLinks, { ...linked, code: cleanCode }];
      const updatedAliases = Array.from(new Set([...currentAliases, cleanCode]));

      const updatedItem: ItemMaster = {
        ...target,
        linkedBarcodes: updatedLinks,
        aliasCodes: updatedAliases,
        updatedAt: new Date().toISOString(),
      };

      await saveItem(updatedItem);
      addToast('success', `🔗 バーコード「${cleanCode}」を「${target.name}」(${linked.unit || target.baseUnit}) に紐付けました`);
      return true;
    } catch (err) {
      console.error('Failed to link barcode:', err);
      addToast('error', 'バーコードの紐付けに失敗しました');
      return false;
    }
  }, [saveItem, addToast]);

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

      // 在庫0または在庫不足時の出庫バリデーションガード
      if (type === 'OUT') {
        if (item.currentStock <= 0) {
          addToast('error', `⚠️ 在庫が0のため出庫できません！ (品名: ${item.name})`);
          return false;
        }
        if (baseQty > item.currentStock) {
          addToast('error', `⚠️ 出庫数量 (${baseQty} ${item.baseUnit}) が現在庫 (${item.currentStock} ${item.baseUnit}) を超過しています！`);
          return false;
        }
      }

      const shouldBePending =
        (type === 'IN' || type === 'OUT') && (isPendingApproval !== undefined ? isPendingApproval : settings.requirePcApprovalForInbound);

      if (shouldBePending) {
        const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const pendingObj: PendingInbound = {
          id: pendingId,
          type,
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

        addToast(
          'info',
          type === 'OUT'
            ? `📤 出庫承認待ちに登録しました: ${item.name} (-${quantity} ${unit})`
            : `📥 入荷承認待ちに登録しました: ${item.name} (+${quantity} ${unit})`
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

  // ─── PC Outbound & Checked-Out Items Management ───
  const recordPcOutbound = useCallback(
    async (params: {
      item: ItemMaster;
      quantity: number;
      unit: string;
      multiplier: number;
      operator: string;
      destination?: string;
      note?: string;
      trackAsCheckedOut?: boolean;
    }): Promise<boolean> => {
      const {
        item,
        quantity,
        unit,
        multiplier,
        operator,
        destination,
        note,
        trackAsCheckedOut = true,
      } = params;

      const baseQuantity = Math.round(quantity * multiplier);
      if (item.currentStock < baseQuantity) {
        addToast(
          'error',
          `⚠️ 在庫不足: 出庫数量 (${baseQuantity}${item.baseUnit}) が現在庫 (${item.currentStock}${item.baseUnit}) を超過しています！`
        );
        return false;
      }

      const outNote = [
        destination ? `現場/用途: ${destination}` : '',
        note ? `メモ: ${note}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      const success = await recordTransaction(item, 'OUT', quantity, unit, multiplier, outNote);
      if (!success) return false;

      if (trackAsCheckedOut) {
        const newRecord: CheckedOutItem = {
          id: `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          spec: item.spec,
          supplier: item.supplier,
          imageUrl: item.imageUrl,
          location: item.location,
          outQuantity: quantity,
          outUnit: unit,
          multiplier,
          outBaseQuantity: baseQuantity,
          operator: operator.trim() || settings.activeOperator || '現場作業員',
          destination: destination?.trim() || '現場持出',
          checkedOutAt: new Date().toISOString(),
          status: 'CHECKED_OUT',
        };

        const updated = [newRecord, ...checkedOutList];
        saveCheckedOutListToStorage(updated);
      }

      addToast(
        'success',
        `「${item.name}」${quantity} ${unit}（${baseQuantity}${item.baseUnit}）を払出・持出記録しました`
      );
      return true;
    },
    [recordTransaction, checkedOutList, settings.activeOperator, addToast]
  );

  const returnCheckedOutItem = useCallback(
    async (
      checkoutId: string,
      params: {
        returnCondition: ReturnCondition;
        returnedBaseQty: number;
        isOpenPackage: boolean;
        returnNote?: string;
      }
    ): Promise<boolean> => {
      const target = checkedOutList.find((c) => c.id === checkoutId);
      if (!target) return false;

      const { returnCondition, returnedBaseQty, isOpenPackage, returnNote } = params;
      const targetItem = itemsRef.current.find((i) => i.id === target.itemId);

      // Return stock into inventory
      if (returnedBaseQty > 0 && targetItem) {
        const condLabel = RETURN_CONDITIONS.find((r) => r.key === returnCondition)?.label || '';
        const noteStr = [
          `【現場返却】${condLabel}`,
          isOpenPackage ? '📦 開封品あり(残量端数)' : '未開封全量',
          returnNote ? `メモ: ${returnNote}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        await recordTransaction(
          targetItem,
          'IN',
          returnedBaseQty,
          targetItem.baseUnit,
          1,
          noteStr
        );
      }

      // Update CheckedOutItem status
      const updated = checkedOutList.map((c) => {
        if (c.id === checkoutId) {
          return {
            ...c,
            status: 'RETURNED' as const,
            returnedAt: new Date().toISOString(),
            returnedBaseQuantity: returnedBaseQty,
            returnCondition,
            isPackageOpened: isOpenPackage,
            returnNote,
          };
        }
        return c;
      });

      saveCheckedOutListToStorage(updated);
      addToast(
        'success',
        `「${target.itemName}」の返却・棚戻しを完了しました（戻し数量: ${returnedBaseQty}${targetItem?.baseUnit || ''}）`
      );
      return true;
    },
    [checkedOutList, recordTransaction, addToast]
  );

  const markCheckedOutAsConsumed = useCallback(
    async (checkoutId: string, note?: string): Promise<boolean> => {
      const target = checkedOutList.find((c) => c.id === checkoutId);
      if (!target) return false;

      const updated = checkedOutList.map((c) => {
        if (c.id === checkoutId) {
          return {
            ...c,
            status: 'CONSUMED' as const,
            returnedAt: new Date().toISOString(),
            returnedBaseQuantity: 0,
            returnNote: note || '現場で全量使用完了',
          };
        }
        return c;
      });

      saveCheckedOutListToStorage(updated);
      addToast('info', `「${target.itemName}」を現場消費完了（返却なし）として記録しました`);
      return true;
    },
    [checkedOutList, addToast]
  );

  const deleteCheckedOutRecord = useCallback(
    async (checkoutId: string): Promise<boolean> => {
      const updated = checkedOutList.filter((c) => c.id !== checkoutId);
      saveCheckedOutListToStorage(updated);
      addToast('info', '持出記録を削除しました');
      return true;
    },
    [checkedOutList, addToast]
  );

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

      const isOut = pending.type === 'OUT';
      if (isOut && item.currentStock < pending.baseQuantity) {
        addToast('error', `⚠️ 出庫承認エラー: 出庫数量 (${pending.baseQuantity}) が現在庫 (${item.currentStock}) を超過しています！`);
        return;
      }

      const delta = isOut ? -pending.baseQuantity : pending.baseQuantity;
      const newStock = Math.max(0, item.currentStock + delta);
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
        type: isOut ? 'OUT' : 'IN',
        delta,
        quantity: pending.quantity,
        unit: pending.unit,
        multiplier: pending.multiplier,
        baseQuantity: pending.baseQuantity,
        operator: `${pending.operator} (PC承認済)`,
        timestamp: new Date().toISOString(),
        note: `PC正式${isOut ? '出庫' : '入庫'}承認 | ${pending.note || ''}`.trim(),
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

      addToast(
        'success',
        isOut
          ? `正式出庫承認完了: ${updatedItem.name} -${pending.quantity} ${pending.unit} (残: ${newStock})`
          : `正式入庫承認完了: ${updatedItem.name} +${pending.quantity} ${pending.unit} (残: ${newStock})`
      );

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
      items, logs, pendingInbounds, checkedOutList, activeTab, setActiveTab,
      settings, updateSettings, toasts, addToast, removeToast,
      boxConfigs, updateBoxConfig, addBoxConfig, deleteBoxConfig, batchMoveItemsToBox, clearOldLogs,
      recordPcOutbound, returnCheckedOutItem, markCheckedOutAsConsumed, deleteCheckedOutRecord,
      isOnline, isCloudConnected, setIsCloudConnected,
      pendingSyncCount: pendingCount, pendingCount, isSyncing,
      triggerManualSync: triggerSync, triggerSync, refreshPendingCount,
      saveFirebaseConfig, clearFirebaseConfig,
      isBottomSheetOpen, activeScannedItem, activeScannedCode, activeMatchedBarcode,
      findItemByCode, linkBarcodeToItem,
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
