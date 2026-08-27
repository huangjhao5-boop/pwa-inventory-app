import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ItemMaster, InventoryLog, PendingInbound, AppSettings } from '../types/inventory';

export interface OfflineQueueItem {
  id: string;
  type: 'LOG' | 'ITEM' | 'PENDING_INBOUND';
  payload: any;
  retryCount: number;
  createdAt: number;
}

interface SmartInventoryDB extends DBSchema {
  items: {
    key: string;
    value: ItemMaster;
    indexes: {
      'by-code': string;
      'by-location': string;
      'by-category': string;
    };
  };
  logs: {
    key: string;
    value: InventoryLog;
    indexes: {
      'by-timestamp': string;
      'by-item-id': string;
      'by-operator': string;
      'by-synced': number;
    };
  };
  pending_inbounds: {
    key: string;
    value: PendingInbound;
    indexes: {
      'by-status': string;
      'by-scanned-at': string;
    };
  };
  offline_queue: {
    key: string;
    value: OfflineQueueItem;
    indexes: {
      'by-created': number;
    };
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'SmartInventoryPWA_DB';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<SmartInventoryDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<SmartInventoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Items table
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('by-code', 'code', { unique: true });
          itemStore.createIndex('by-location', 'location');
          itemStore.createIndex('by-category', 'category');
        }

        // Logs table
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'id' });
          logStore.createIndex('by-timestamp', 'timestamp');
          logStore.createIndex('by-item-id', 'itemId');
          logStore.createIndex('by-operator', 'operator');
          logStore.createIndex('by-synced', 'synced');
        }

        // Pending Inbounds table
        if (!db.objectStoreNames.contains('pending_inbounds')) {
          const pendingStore = db.createObjectStore('pending_inbounds', { keyPath: 'id' });
          pendingStore.createIndex('by-status', 'status');
          pendingStore.createIndex('by-scanned-at', 'scannedAt');
        }

        // Offline sync queue
        if (!db.objectStoreNames.contains('offline_queue')) {
          const queueStore = db.createObjectStore('offline_queue', { keyPath: 'id' });
          queueStore.createIndex('by-created', 'createdAt');
        }

        // App settings
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
};

export class LocalDatabaseService {
  static async initSeedData(): Promise<void> {
    // 模擬ファイル自動生成を削除（空のデータベースから開始）
  }

  // --- ITEM MASTER OPERATIONS ---

  static async getAllItems(): Promise<ItemMaster[]> {
    const db = await getDB();
    return db.getAll('items');
  }

  static async getItemByCode(code: string): Promise<ItemMaster | undefined> {
    const db = await getDB();
    return db.getFromIndex('items', 'by-code', code);
  }

  static async getItemById(id: string): Promise<ItemMaster | undefined> {
    const db = await getDB();
    return db.get('items', id);
  }

  static async saveItem(item: ItemMaster): Promise<void> {
    const db = await getDB();
    await db.put('items', item);
  }

  static async saveItemsBatch(items: ItemMaster[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('items', 'readwrite');
    for (const item of items) {
      await tx.store.put(item);
    }
    await tx.done;
  }

  static async deleteItem(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('items', id);
  }

  // --- PENDING INBOUND OPERATIONS ---

  static async getAllPendingInbounds(): Promise<PendingInbound[]> {
    const db = await getDB();
    return db.getAll('pending_inbounds');
  }

  static async savePendingInbound(pending: PendingInbound): Promise<void> {
    const db = await getDB();
    await db.put('pending_inbounds', pending);
  }

  static async savePendingInboundsBatch(pendings: PendingInbound[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('pending_inbounds', 'readwrite');
    for (const p of pendings) {
      await tx.store.put(p);
    }
    await tx.done;
  }

  static async deletePendingInbound(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('pending_inbounds', id);
  }

  // --- INVENTORY LOG OPERATIONS ---

  static async addLog(log: InventoryLog): Promise<void> {
    const db = await getDB();
    await db.put('logs', log);
  }

  static async getAllLogs(): Promise<InventoryLog[]> {
    const db = await getDB();
    return db.getAllFromIndex('logs', 'by-timestamp');
  }

  // --- OFFLINE QUEUE OPERATIONS ---

  static async getOfflineQueue(): Promise<OfflineQueueItem[]> {
    const db = await getDB();
    return db.getAllFromIndex('offline_queue', 'by-created');
  }

  static async addToOfflineQueue(item: OfflineQueueItem): Promise<void> {
    const db = await getDB();
    await db.put('offline_queue', item);
  }

  static async removeOfflineQueueItem(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('offline_queue', id);
  }

  // --- SETTINGS OPERATIONS ---

  static async getSettings(): Promise<Partial<AppSettings>> {
    const db = await getDB();
    const keys = await db.getAllKeys('settings');
    const settings: Record<string, any> = {};
    for (const k of keys) {
      settings[k as string] = await db.get('settings', k);
    }
    return settings;
  }

  static async saveSetting(key: string, value: any): Promise<void> {
    const db = await getDB();
    await db.put('settings', value, key);
  }
}
