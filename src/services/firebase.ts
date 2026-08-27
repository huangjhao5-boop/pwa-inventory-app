import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import { ItemMaster, InventoryLog } from '../types/inventory';

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const STORAGE_KEY = 'smart_inventory_firebase_config';

/**
 * Firestore は undefined の値を含むオブジェクトを保存できないため、
 * undefined を除去するサニタイズ関数
 */
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

class CloudSyncService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private unsubscribeItems: Unsubscribe | null = null;
  private unsubscribeLogs: Unsubscribe | null = null;
  private isConnected = false;

  constructor() {
    this.init();
  }

  /**
   * Firebase 設定の初期化（localStorage または 環境変数）
   */
  init(customConfig?: FirebaseConfigOptions) {
    try {
      const config = customConfig || this.getConfig();
      if (!config || !config.apiKey || !config.projectId) {
        console.log('Firebase: Running in Local-First IndexedDB Mode (No valid config).');
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

      // ignoreUndefinedProperties: true で undefined エラーを回避
      try {
        this.db = initializeFirestore(this.app, {
          ignoreUndefinedProperties: true,
        });
      } catch {
        this.db = getFirestore(this.app);
      }

      this.isConnected = true;
      console.log('Firebase: Firestore initialized successfully with project:', config.projectId);
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

  /**
   * 接続テスト
   */
  async testConnection(config: FirebaseConfigOptions): Promise<{ success: boolean; message: string }> {
    try {
      const tempApp = initializeApp(config, `test_app_${Date.now()}`);
      const tempDb = getFirestore(tempApp);
      const testCol = collection(tempDb, 'inventory_items');
      await getDocs(testCol);
      return { success: true, message: 'Firebase Firestore 接続成功！' };
    } catch (e: any) {
      return { success: false, message: e.message || '接続に失敗しました。Firestore Database が有効か確認してください。' };
    }
  }

  /**
   * クラウドから全品目を取得
   */
  async fetchAllCloudItems(): Promise<ItemMaster[]> {
    if (!this.isCloudEnabled() || !this.db) return [];
    try {
      const itemsCol = collection(this.db, 'inventory_items');
      const snapshot = await getDocs(itemsCol);
      const items: ItemMaster[] = [];
      snapshot.forEach((doc) => {
        items.push(doc.data() as ItemMaster);
      });
      return items;
    } catch (e) {
      console.error('Failed to fetch items from Firestore:', e);
      return [];
    }
  }

  /**
   * 品目マスターをクラウドへ保存
   */
  async syncItemToCloud(item: ItemMaster): Promise<boolean> {
    if (!this.isCloudEnabled() || !this.db) return true;
    try {
      const cleanData = sanitizeForFirestore(item);
      const itemRef = doc(this.db, 'inventory_items', item.id);
      await setDoc(itemRef, cleanData, { merge: true });
      console.log('Synced item to Firestore successfully:', item.code);
      return true;
    } catch (e) {
      console.error('Failed to sync item to Firestore:', e);
      return false;
    }
  }

  /**
   * 入出庫ログをクラウドへ保存
   */
  async syncLogToCloud(log: InventoryLog): Promise<boolean> {
    if (!this.isCloudEnabled() || !this.db) return true;
    try {
      const cleanData = sanitizeForFirestore(log);
      const logRef = doc(this.db, 'inventory_logs', log.id);
      await setDoc(logRef, cleanData, { merge: true });
      console.log('Synced log to Firestore successfully:', log.id);
      return true;
    } catch (e) {
      console.error('Failed to sync log to Firestore:', e);
      return false;
    }
  }

  /**
   * クラウドのリアルタイム変更を購読 (Realtime onSnapshot)
   */
  listenCloudChanges(
    onRemoteItemUpdate: (item: ItemMaster) => void,
    onRemoteLogUpdate: (log: InventoryLog) => void
  ) {
    if (!this.isCloudEnabled() || !this.db) return;

    if (this.unsubscribeItems) this.unsubscribeItems();
    if (this.unsubscribeLogs) this.unsubscribeLogs();

    try {
      // 1. Items Listener
      const itemsCol = collection(this.db, 'inventory_items');
      this.unsubscribeItems = onSnapshot(
        itemsCol,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const data = change.doc.data() as ItemMaster;
              onRemoteItemUpdate(data);
            }
          });
        },
        (err) => {
          console.warn('Firestore items listener error (Rules check needed?):', err);
        }
      );

      // 2. Logs Listener
      const logsCol = collection(this.db, 'inventory_logs');
      this.unsubscribeLogs = onSnapshot(
        logsCol,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const data = change.doc.data() as InventoryLog;
              onRemoteLogUpdate(data);
            }
          });
        },
        (err) => {
          console.warn('Firestore logs listener error (Rules check needed?):', err);
        }
      );
    } catch (err) {
      console.error('Error attaching Firestore listeners:', err);
    }
  }

  stopListening() {
    if (this.unsubscribeItems) this.unsubscribeItems();
    if (this.unsubscribeLogs) this.unsubscribeLogs();
    this.unsubscribeItems = null;
    this.unsubscribeLogs = null;
  }
}

export const cloudSync = new CloudSyncService();
export { CloudSyncService };
