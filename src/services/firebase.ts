import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import { ItemMaster, InventoryLog, PendingInbound } from '../types/inventory';

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const STORAGE_KEY = 'smart_inventory_firebase_config';

function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = sanitizeForFirestore(val);
      } else if (Array.isArray(val)) {
        result[key] = val.map((item) =>
          typeof item === 'object' && item !== null ? sanitizeForFirestore(item) : item
        );
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

export interface DiagnosticResult {
  step: string;
  status: 'SUCCESS' | 'ERROR' | 'PENDING';
  message: string;
  details?: string;
}

class CloudSyncService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private unsubscribeItems: Unsubscribe | null = null;
  private unsubscribeLogs: Unsubscribe | null = null;
  private unsubscribePending: Unsubscribe | null = null;
  private isConnected = false;

  constructor() {
    this.init();
  }

  init(customConfig?: FirebaseConfigOptions) {
    try {
      const config = customConfig || this.getConfig();
      if (!config || !config.apiKey || !config.projectId) {
        this.isConnected = false;
        this.app = null;
        this.db = null;
        return false;
      }

      if (getApps().length === 0) {
        this.app = initializeApp(config);
      } else {
        this.app = getApp();
      }

      try {
        this.db = initializeFirestore(this.app, {
          ignoreUndefinedProperties: true,
        });
      } catch {
        this.db = getFirestore(this.app);
      }

      this.isConnected = true;
      return true;
    } catch (err) {
      console.error('Firebase initialization error:', err);
      this.isConnected = false;
      return false;
    }
  }

  getConfig(): FirebaseConfigOptions | null {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }

    const env = (import.meta as any).env || {};
    if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID) {
      return {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      };
    }

    return {
      apiKey: 'AIzaSyDlw1rWP925sdZZeQMdMrbRi-sYVlegjIc',
      authDomain: 'pwa-inventory-app-9c88d.firebaseapp.com',
      projectId: 'pwa-inventory-app-9c88d',
      storageBucket: 'pwa-inventory-app-9c88d.firebasestorage.app',
      messagingSenderId: '499776972100',
      appId: '1:499776972100:web:2eb1cd3319039c5cea6311',
    };
  }

  saveConfig(config: FirebaseConfigOptions): boolean {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
    return this.init(config);
  }

  clearConfig() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.app = null;
    this.db = null;
    this.isConnected = false;
  }

  isCloudEnabled(): boolean {
    return this.isConnected && this.db !== null;
  }

  async runFullDiagnostics(): Promise<{ success: boolean; results: DiagnosticResult[] }> {
    const results: DiagnosticResult[] = [];
    const config = this.getConfig();

    if (!config) {
      results.push({
        step: '1. Firebase Config 設定',
        status: 'ERROR',
        message: '未設定 Firebase Config',
      });
      return { success: false, results };
    }

    results.push({
      step: '1. Firebase 專案設定驗證',
      status: 'SUCCESS',
      message: `專案 ID: ${config.projectId}`,
    });

    try {
      if (!this.db) {
        this.init(config);
      }
      if (!this.db) throw new Error('Firestore 初始化失敗');

      // Test Write
      const testDocRef = doc(this.db, 'inventory_items', '_test_connection');
      await setDoc(testDocRef, {
        test: true,
        timestamp: new Date().toISOString(),
      });
      results.push({
        step: '2. 雲端寫入測試 (Write Test)',
        status: 'SUCCESS',
        message: '成功寫入測試資料至 Firestore',
      });

      // Test Read
      const snapshot = await getDocs(collection(this.db, 'inventory_items'));
      results.push({
        step: '3. 雲端讀取測試 (Read Test)',
        status: 'SUCCESS',
        message: `成功連線並讀取到 ${snapshot.size} 筆品目資料`,
      });

      // Cleanup
      await deleteDoc(testDocRef);
      results.push({
        step: '4. 測試資料清理 (Cleanup)',
        status: 'SUCCESS',
        message: '測試環境完全正常，可正常出入庫同步！',
      });

      return { success: true, results };
    } catch (err: any) {
      console.error('Diagnostic error:', err);
      let advice = '請檢查 Firebase 控制台設定。';

      if (err.message?.includes('permission-denied') || err.code === 'permission-denied') {
        advice = '【權限被拒絕】請前往 Firebase Console -> Firestore Database -> 規則 (Rules)，將規則改為 allow read, write: if true; 並點擊「發布 (Publish)」！';
      } else if (err.message?.includes('not-found') || err.code === 'not-found' || err.message?.includes('database') || err.code === 'unavailable') {
        advice = '【資料庫尚未建立】請前往 Firebase Console 左側點擊「Firestore Database」並點擊「建立資料庫 (Create database)」！';
      }

      results.push({
        step: '連線診斷失敗',
        status: 'ERROR',
        message: err.message || '無法連線至 Firestore',
        details: advice,
      });

      return { success: false, results };
    }
  }

  async fetchAllCloudItems(): Promise<ItemMaster[]> {
    if (!this.isCloudEnabled() || !this.db) return [];
    try {
      const itemsCol = collection(this.db, 'inventory_items');
      const snapshot = await getDocs(itemsCol);
      const items: ItemMaster[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as ItemMaster;
        if (data.id && data.code && data.name) {
          items.push(data);
        }
      });
      return items;
    } catch (e) {
      console.error('Failed to fetch items from Firestore:', e);
      return [];
    }
  }

  async fetchAllPendingInbounds(): Promise<PendingInbound[]> {
    if (!this.isCloudEnabled() || !this.db) return [];
    try {
      const pendingCol = collection(this.db, 'pending_inbounds');
      const snapshot = await getDocs(pendingCol);
      const list: PendingInbound[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as PendingInbound;
        if (data.id && data.itemCode) {
          list.push(data);
        }
      });
      return list;
    } catch (e) {
      console.error('Failed to fetch pending inbounds from Firestore:', e);
      return [];
    }
  }

  async syncItemToCloud(item: ItemMaster): Promise<boolean> {
    if (!this.isCloudEnabled() || !this.db) return true;
    try {
      const cleanData = sanitizeForFirestore(item);
      const itemRef = doc(this.db, 'inventory_items', item.id);
      await setDoc(itemRef, cleanData, { merge: true });
      return true;
    } catch (e) {
      console.error('Failed to sync item to Firestore:', e);
      return false;
    }
  }

  async deleteItemFromCloud(id: string): Promise<boolean> {
    if (!this.isCloudEnabled() || !this.db) return true;
    try {
      const itemRef = doc(this.db, 'inventory_items', id);
      await deleteDoc(itemRef);
      return true;
    } catch (e) {
      console.error('Failed to delete item from Firestore:', e);
      return false;
    }
  }

  async syncLogToCloud(log: InventoryLog): Promise<boolean> {
    if (!this.isCloudEnabled() || !this.db) return true;
    try {
      const cleanData = sanitizeForFirestore(log);
      const logRef = doc(this.db, 'inventory_logs', log.id);
      await setDoc(logRef, cleanData, { merge: true });
      return true;
    } catch (e) {
      console.error('Failed to sync log to Firestore:', e);
      return false;
    }
  }

  async syncPendingInboundToCloud(pending: PendingInbound): Promise<boolean> {
    if (!this.isCloudEnabled() || !this.db) return true;
    try {
      const cleanData = sanitizeForFirestore(pending);
      const ref = doc(this.db, 'pending_inbounds', pending.id);
      await setDoc(ref, cleanData, { merge: true });
      return true;
    } catch (e) {
      console.error('Failed to sync pending inbound to Firestore:', e);
      return false;
    }
  }

  async deletePendingInboundFromCloud(id: string): Promise<boolean> {
    if (!this.isCloudEnabled() || !this.db) return true;
    try {
      const ref = doc(this.db, 'pending_inbounds', id);
      await deleteDoc(ref);
      return true;
    } catch (e) {
      console.error('Failed to delete pending inbound from Firestore:', e);
      return false;
    }
  }

  listenCloudChanges(
    onRemoteItemUpdate: (item: ItemMaster, isDeleted?: boolean) => void,
    onRemoteLogUpdate: (log: InventoryLog) => void,
    onRemotePendingUpdate?: (pending: PendingInbound, isDeleted?: boolean) => void
  ) {
    if (!this.isCloudEnabled() || !this.db) return;

    if (this.unsubscribeItems) this.unsubscribeItems();
    if (this.unsubscribeLogs) this.unsubscribeLogs();
    if (this.unsubscribePending) this.unsubscribePending();

    try {
      // 1. Items Listener (Added, Modified, Removed)
      const itemsCol = collection(this.db, 'inventory_items');
      this.unsubscribeItems = onSnapshot(
        itemsCol,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'removed') {
              onRemoteItemUpdate({ id: change.doc.id } as ItemMaster, true);
            } else if (change.type === 'added' || change.type === 'modified') {
              const data = change.doc.data() as ItemMaster;
              if (data.id && data.code && data.name) {
                onRemoteItemUpdate(data, false);
              }
            }
          });
        },
        (err) => console.warn('Firestore items listener error:', err)
      );

      // 2. Logs Listener
      const logsCol = collection(this.db, 'inventory_logs');
      this.unsubscribeLogs = onSnapshot(
        logsCol,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const data = change.doc.data() as InventoryLog;
              if (data.id && data.itemId) {
                onRemoteLogUpdate(data);
              }
            }
          });
        },
        (err) => console.warn('Firestore logs listener error:', err)
      );

      // 3. Pending Inbounds Listener
      if (onRemotePendingUpdate) {
        const pendingCol = collection(this.db, 'pending_inbounds');
        this.unsubscribePending = onSnapshot(
          pendingCol,
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'removed') {
                onRemotePendingUpdate({ id: change.doc.id } as PendingInbound, true);
              } else if (change.type === 'added' || change.type === 'modified') {
                const data = change.doc.data() as PendingInbound;
                if (data.id && data.itemCode) {
                  onRemotePendingUpdate(data, false);
                }
              }
            });
          },
          (err) => console.warn('Firestore pending listener error:', err)
        );
      }
    } catch (err) {
      console.error('Error attaching Firestore listeners:', err);
    }
  }

  stopListening() {
    if (this.unsubscribeItems) this.unsubscribeItems();
    if (this.unsubscribeLogs) this.unsubscribeLogs();
    if (this.unsubscribePending) this.unsubscribePending();
    this.unsubscribeItems = null;
    this.unsubscribeLogs = null;
    this.unsubscribePending = null;
  }
}

export const cloudSync = new CloudSyncService();
export { CloudSyncService };
