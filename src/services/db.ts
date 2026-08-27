import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ItemMaster, InventoryLog, AppSettings } from '../types/inventory';
import { INITIAL_DEMO_ITEMS } from '../utils/demoData';

interface InventoryDBSchema extends DBSchema {
  items: {
    key: string; // item id
    value: ItemMaster;
    indexes: {
      'by-code': string;
      'by-category': string;
      'by-location': string;
    };
  };
  logs: {
    key: string; // log id
    value: InventoryLog;
    indexes: {
      'by-itemId': string;
      'by-timestamp': string;
      'by-synced': number; // 0 or 1
    };
  };
  offline_queue: {
    key: string; // log id
    value: InventoryLog;
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'smart_inventory_pwa_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<InventoryDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<InventoryDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<InventoryDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Items Store
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('by-code', 'code', { unique: false });
          itemStore.createIndex('by-category', 'category', { unique: false });
          itemStore.createIndex('by-location', 'location', { unique: false });
        }

        // Logs Store
        if (!db.objectStoreNames.contains('logs')) {
          const logStore = db.createObjectStore('logs', { keyPath: 'id' });
          logStore.createIndex('by-itemId', 'itemId', { unique: false });
          logStore.createIndex('by-timestamp', 'timestamp', { unique: false });
          logStore.createIndex('by-synced', 'synced', { unique: false });
        }

        // Offline Queue Store
        if (!db.objectStoreNames.contains('offline_queue')) {
          db.createObjectStore('offline_queue', { keyPath: 'id' });
        }

        // Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

export class LocalDatabaseService {
  /**
   * 初回起動時にデモデータを投入
   */
  static async initSeedData(): Promise<void> {
    const db = await getDB();
    const count = await db.count('items');
    if (count === 0) {
      const tx = db.transaction('items', 'readwrite');
      for (const item of INITIAL_DEMO_ITEMS) {
        await tx.store.put(item);
      }
      await tx.done;
      console.log('IndexedDB initialized with demo items.');
    }
  }

  // === Items CRUD ===
  static async getAllItems(): Promise<ItemMaster[]> {
    const db = await getDB();
    return db.getAll('items');
  }

  static async getItemById(id: string): Promise<ItemMaster | undefined> {
    const db = await getDB();
    return db.get('items', id);
  }

  static async getItemByCode(code: string): Promise<ItemMaster | undefined> {
    const db = await getDB();
    const cleanCode = code.trim();
    // 1. Exact match on code index
    const matched = await db.getFromIndex('items', 'by-code', cleanCode);
    if (matched) return matched;

    // 2. Scan all items for QR code or partial match
    const all = await db.getAll('items');
    return all.find(
      (item) =>
        item.code.toLowerCase() === cleanCode.toLowerCase() ||
        (item.qrCode && item.qrCode.toLowerCase() === cleanCode.toLowerCase()) ||
        item.qrCode?.includes(`:${cleanCode}`)
    );
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

  // === Inventory Logs ===
  static async getAllLogs(): Promise<InventoryLog[]> {
    const db = await getDB();
    const logs = await db.getAll('logs');
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  static async addLog(log: InventoryLog): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['logs', 'items', 'offline_queue'], 'readwrite');
    
    // 1. ログ追加
    await tx.objectStore('logs').put(log);

    // 2. 在庫数更新 (Delta 適用)
    const item = await tx.objectStore('items').get(log.itemId);
    if (item) {
      item.currentStock = Math.max(0, item.currentStock + log.delta);
      item.updatedAt = log.timestamp;
      await tx.objectStore('items').put(item);
    }

    // 3. 未同期キューに追加
    if (!log.synced) {
      await tx.objectStore('offline_queue').put(log);
    }

    await tx.done;
  }

  static async getOfflineQueue(): Promise<InventoryLog[]> {
    const db = await getDB();
    return db.getAll('offline_queue');
  }

  static async removeOfflineQueueItem(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('offline_queue', id);
  }

  // === Settings ===
  static async getSettings(): Promise<Partial<AppSettings>> {
    const db = await getDB();
    const res = await db.get('settings', 'app_config');
    return res || {};
  }

  static async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const db = await getDB();
    await db.put('settings', settings, 'app_config');
  }
}
