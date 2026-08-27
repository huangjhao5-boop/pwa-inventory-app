import { LocalDatabaseService } from './db';
import { cloudSync } from './firebase';
import { InventoryLog, ItemMaster, PendingInbound } from '../types/inventory';

export class SyncEngine {
  private static isSyncing = false;

  /**
   * オフラインキューの全データをクラウドへ同期
   */
  static async syncAllPendingLogs(onProgress?: (synced: number, total: number) => void): Promise<{ successCount: number; failCount: number }> {
    if (this.isSyncing) return { successCount: 0, failCount: 0 };
    this.isSyncing = true;

    try {
      const queue = await LocalDatabaseService.getOfflineQueue();
      if (queue.length === 0) {
        return { successCount: 0, failCount: 0 };
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < queue.length; i++) {
        const qItem = queue[i];
        let ok = false;

        if (qItem.type === 'LOG') {
          ok = await cloudSync.syncLogToCloud(qItem.payload as InventoryLog);
        } else if (qItem.type === 'ITEM') {
          ok = await cloudSync.syncItemToCloud(qItem.payload as ItemMaster);
        } else if (qItem.type === 'PENDING_INBOUND') {
          ok = await cloudSync.syncPendingInboundToCloud(qItem.payload as PendingInbound);
        }

        if (ok) {
          await LocalDatabaseService.removeOfflineQueueItem(qItem.id);
          successCount++;
        } else {
          failCount++;
        }
        if (onProgress) {
          onProgress(i + 1, queue.length);
        }
      }

      return { successCount, failCount };
    } finally {
      this.isSyncing = false;
    }
  }
}
