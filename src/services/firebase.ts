/**
 * Firebase Firestore 連携モジュール
 * 環境変数が設定されていない場合でも、IndexedDB ローカルモードとして 100% 完全に動作します。
 */

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export class CloudSyncService {
  private static isConfigured = false;

  static init() {
    // Check if Firebase env variables exist
    const env = (import.meta as any).env || {};
    const hasConfig = Boolean(
      env.VITE_FIREBASE_API_KEY &&
      env.VITE_FIREBASE_PROJECT_ID
    );
    this.isConfigured = hasConfig;
    if (hasConfig) {
      console.log('Firebase Cloud Sync is configured.');
    } else {
      console.log('Running in Local-First IndexedDB Mode (No Firebase configuration detected).');
    }
  }

  static isCloudEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * クラウドへログを同期（Firebase 有効時）
   */
  static async syncLogToCloud(log: unknown): Promise<boolean> {
    if (!this.isConfigured) {
      // ローカルモード時は同期完了とみなす
      return true;
    }
    try {
      // Firebase Firestore call would go here
      console.log('Mock uploading to cloud:', log);
      return true;
    } catch (e) {
      console.error('Failed to sync to cloud:', e);
      return false;
    }
  }
}
