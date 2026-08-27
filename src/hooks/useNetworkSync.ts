import { useState, useEffect, useCallback } from 'react';
import { SyncEngine } from '../services/syncEngine';
import { LocalDatabaseService } from '../services/db';

export function useNetworkSync(onSyncComplete?: (count: number) => void) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const queue = await LocalDatabaseService.getOfflineQueue();
      setPendingCount(queue.length);
    } catch {
      // ignore
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      const res = await SyncEngine.syncAllPendingLogs();
      await refreshPendingCount();
      if (res.successCount > 0 && onSyncComplete) {
        onSyncComplete(res.successCount);
      }
    } catch (e) {
      console.error('Auto sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [onSyncComplete, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync, refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    refreshPendingCount,
    triggerSync,
  };
}
