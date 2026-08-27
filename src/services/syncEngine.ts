import { LocalDatabaseService } from './db';
import { CloudSyncService } from './firebase';

export class SyncEngine {
  private static isSyncing = false;

  /**
   * オフラインキューの全ログを同期
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
        const log = queue[i];
        const ok = await CloudSyncService.syncLogToCloud(log);
        if (ok) {
          await LocalDatabaseService.removeOfflineQueueItem(log.id);
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
